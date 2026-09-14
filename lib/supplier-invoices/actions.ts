"use server";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/auth/authorize";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/lib/auth/errors";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { db } from "@/lib/db";
import { contracts, supplierInvoiceApprovals, supplierInvoices } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { getSetting } from "@/lib/settings/service";
import { notifyEvent } from "@/lib/email/notify-email";
import { uploadDocument } from "@/lib/storage";
import { optionalDate, optionalNumber, optionalString, optionalUuid } from "@/lib/utils/zod";

const schema = z.object({
  id: optionalUuid,
  contractId: z.uuid(),
  supplierInvoiceNumber: z.string().trim().min(1).max(100),
  invoiceDate: z.iso.date(),
  receivedDate: optionalDate,
  amountBeforeVat: z.coerce.number().min(0),
  vatAmount: z.coerce.number().min(0).default(0),
  total: optionalNumber,
  description: optionalString,
  progressPctClaimed: optionalNumber,
  notes: optionalString,
});

function rev(id: string, contractId: string) {
  revalidatePath("/supplier-invoices");
  revalidatePath(`/supplier-invoices/${id}`);
  revalidatePath(`/contracts/${contractId}`);
}

/** Record a supplier invoice – file is mandatory (spec §11.13). */
export async function upsertSupplierInvoiceAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("supplier_invoices.manage");
    const raw: Record<string, unknown> = {};
    for (const [k, v] of fd.entries()) if (k !== "file") raw[k] = v;
    const d = schema.parse(raw);
    const file = fd.get("file");
    const [c] = await db.select({ id: contracts.id, direction: contracts.direction }).from(contracts).where(and(eq(contracts.id, d.contractId), isNull(contracts.deletedAt)));
    if (!c || c.direction !== "expense") throw new BusinessRuleError("supplier_invoices.not_supplier_contract");
    if (!d.id && !(file instanceof File && file.size > 0)) throw new ValidationError("supplier_invoices.file_required", { file: ["supplier_invoices.file_required"] });
    const total = d.total ?? d.amountBeforeVat + d.vatAmount;
    const id = await withUser({ userId: user.id }, async (tx) => {
      const values = { contractId: d.contractId, supplierInvoiceNumber: d.supplierInvoiceNumber, invoiceDate: d.invoiceDate, receivedDate: d.receivedDate ?? null, amountBeforeVat: d.amountBeforeVat.toFixed(2), vatAmount: d.vatAmount.toFixed(2), total: total.toFixed(2), description: d.description ?? null, progressPctClaimed: d.progressPctClaimed?.toFixed(3) ?? null, notes: d.notes ?? null };
      let id = d.id;
      if (id) {
        const [ex] = await tx.select({ status: supplierInvoices.status }).from(supplierInvoices).where(eq(supplierInvoices.id, id));
        if (ex && ex.status !== "pending") throw new BusinessRuleError("supplier_invoices.not_editable");
        await tx.update(supplierInvoices).set(values).where(eq(supplierInvoices.id, id));
      } else {
        const [r] = await tx.insert(supplierInvoices).values({ ...values, createdBy: user.id }).returning({ id: supplierInvoices.id });
        id = r!.id;
      }
      if (file instanceof File && file.size > 0) {
        const doc = await uploadDocument({ bucket: "supplier-invoices", entityType: "supplier_invoice", entityId: id, file, documentType: "invoice", uploadedBy: user.id }, tx);
        await tx.update(supplierInvoices).set({ fileDocumentId: doc.id }).where(eq(supplierInvoices.id, id));
      }
      return id;
    });
    const settings = await getSetting("suppliers");
    await notifyEvent({ userIds: settings.approver_user_ids, type: "supplier_invoice.pending_approval", title: `חשבונית ספק ${d.supplierInvoiceNumber} ממתינה לאישורך`, link: `/supplier-invoices/${id}`, dedupeKey: `si.pending:${id}` });
    rev(id, d.contractId);
    return { id };
  });
}

/** Multi-approver decision (spec §11.13): N approvals → approved; one rejection → rejected. */
export async function decideSupplierInvoiceAction(id: string, decision: "approved" | "rejected", comment: string): Promise<ActionResult<{ status: string }>> {
  return runAction(async () => {
    const user = await requireCapability("supplier_invoices.approve");
    const settings = await getSetting("suppliers");
    if (!settings.approver_user_ids.includes(user.id) && user.role !== "admin") throw new BusinessRuleError("supplier_invoices.not_approver");
    if (decision === "rejected" && comment.trim().length < 2) throw new ValidationError("common.reason_required");
    const [si] = await db.select().from(supplierInvoices).where(and(eq(supplierInvoices.id, id), isNull(supplierInvoices.deletedAt)));
    if (!si) throw new NotFoundError("supplier_invoice");
    if (si.status !== "pending" && si.status !== "partially_approved") throw new BusinessRuleError("supplier_invoices.not_pending");
    const status = await withUser({ userId: user.id, reason: comment || undefined }, async (tx) => {
      await tx
        .insert(supplierInvoiceApprovals)
        .values({ supplierInvoiceId: id, userId: user.id, decision, comment: comment || null, createdBy: user.id })
        .onConflictDoUpdate({ target: [supplierInvoiceApprovals.supplierInvoiceId, supplierInvoiceApprovals.userId], set: { decision, comment: comment || null, decidedAt: new Date() } });
      const all = await tx.select().from(supplierInvoiceApprovals).where(eq(supplierInvoiceApprovals.supplierInvoiceId, id));
      let status: "pending" | "partially_approved" | "approved" | "rejected" = "pending";
      if (all.some((a) => a.decision === "rejected")) status = "rejected";
      else {
        const approvals = all.filter((a) => a.decision === "approved").length;
        status = approvals >= settings.required_approvals ? "approved" : approvals > 0 ? "partially_approved" : "pending";
      }
      await tx.update(supplierInvoices).set({ status }).where(eq(supplierInvoices.id, id));
      return status;
    });
    if ((status === "approved" || status === "rejected") && si.createdBy) {
      await notifyEvent({ userIds: [si.createdBy], type: "supplier_invoice.decided", title: `חשבונית ספק ${si.supplierInvoiceNumber} ${status === "approved" ? "אושרה" : "נדחתה"}`, body: comment || undefined, link: `/supplier-invoices/${id}` });
    }
    rev(id, si.contractId);
    return { status };
  });
}

export async function markSupplierInvoicePaidAction(id: string, paidDate: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("supplier_invoices.manage");
    const date = z.iso.date().parse(paidDate);
    const [si] = await db.select({ status: supplierInvoices.status, contractId: supplierInvoices.contractId }).from(supplierInvoices).where(eq(supplierInvoices.id, id));
    if (!si) throw new NotFoundError("supplier_invoice");
    if (si.status !== "approved") throw new BusinessRuleError("supplier_invoices.not_approved");
    await withUser({ userId: user.id }, (tx) => tx.update(supplierInvoices).set({ status: "paid", paidDate: date }).where(eq(supplierInvoices.id, id)));
    rev(id, si.contractId);
    return undefined;
  });
}

export async function deleteSupplierInvoiceAction(id: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("supplier_invoices.manage");
    const [si] = await db.select({ status: supplierInvoices.status, contractId: supplierInvoices.contractId }).from(supplierInvoices).where(eq(supplierInvoices.id, id));
    if (!si) return undefined;
    if (si.status === "approved" || si.status === "paid") throw new BusinessRuleError("supplier_invoices.not_editable");
    await withUser({ userId: user.id }, (tx) => tx.update(supplierInvoices).set({ deletedAt: new Date() }).where(eq(supplierInvoices.id, id)));
    rev(id, si.contractId);
    return undefined;
  });
}
