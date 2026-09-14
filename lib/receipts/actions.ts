"use server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/auth/authorize";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/lib/auth/errors";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { db, type Tx } from "@/lib/db";
import { invoices, receiptAllocations, receipts } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { paymentStatus } from "@/lib/calc/invoice";
import { money } from "@/lib/calc/money";
import { optionalString, optionalUuid } from "@/lib/utils/zod";
import { uploadDocument } from "@/lib/storage";
import { recomputeContractStatus } from "@/lib/contracts/status";

const receiptSchema = z.object({
  id: optionalUuid,
  clientId: z.uuid(),
  receiptDate: z.iso.date(),
  amount: z.coerce.number().positive(),
  method: z.enum(["transfer", "check", "credit_card", "cash", "other"]).default("transfer"),
  reference: optionalString,
  notes: optionalString,
});

function rev(clientId?: string) {
  revalidatePath("/receipts");
  revalidatePath("/invoices");
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

/** Re-derive sent → partially_paid → paid from allocations (spec §11.3, §11.10). */
export async function syncInvoicePaymentStatus(tx: Tx, invoiceId: string) {
  const [inv] = await tx.select({ status: invoices.status, total: invoices.total, contractId: invoices.contractId }).from(invoices).where(eq(invoices.id, invoiceId));
  if (!inv) return;
  if (!["sent", "partially_paid", "paid"].includes(inv.status)) return;
  const [a] = await tx.select({ s: sql<string>`coalesce(sum(${receiptAllocations.amount}),0)` }).from(receiptAllocations).where(and(eq(receiptAllocations.invoiceId, invoiceId), isNull(receiptAllocations.cancelledAt)));
  const ps = paymentStatus(Number(inv.total), Number(a?.s ?? 0));
  const status = ps === "paid" ? "paid" : ps === "partially_paid" ? "partially_paid" : "sent";
  if (status !== inv.status) await tx.update(invoices).set({ status }).where(eq(invoices.id, invoiceId));
  await recomputeContractStatus(tx, inv.contractId);
}

export async function upsertReceiptAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("receipts.manage");
    const raw: Record<string, unknown> = {};
    for (const [k, v] of fd.entries()) if (k !== "file") raw[k] = v;
    const d = receiptSchema.parse(raw);
    const file = fd.get("file");
    const id = await withUser({ userId: user.id }, async (tx) => {
      const values = { clientId: d.clientId, receiptDate: d.receiptDate, amount: d.amount.toFixed(2), method: d.method, reference: d.reference ?? null, notes: d.notes ?? null };
      let id = d.id;
      if (id) {
        const [a] = await tx.select({ s: sql<string>`coalesce(sum(${receiptAllocations.amount}),0)` }).from(receiptAllocations).where(and(eq(receiptAllocations.receiptId, id), isNull(receiptAllocations.cancelledAt)));
        if (Number(a?.s ?? 0) > d.amount) throw new BusinessRuleError("receipts.amount_below_allocations");
        await tx.update(receipts).set(values).where(eq(receipts.id, id));
      } else {
        const [r] = await tx.insert(receipts).values({ ...values, createdBy: user.id }).returning({ id: receipts.id });
        id = r!.id;
      }
      if (file instanceof File && file.size > 0) await uploadDocument({ bucket: "general-docs", entityType: "receipt", entityId: id, file, documentType: "other", uploadedBy: user.id }, tx);
      return id;
    });
    rev(d.clientId);
    return { id };
  });
}

const allocSchema = z.object({ receiptId: z.uuid(), allocations: z.array(z.object({ invoiceId: z.uuid(), amount: z.coerce.number().min(0) })) });

/** Manual allocation: Σ ≤ receipt amount, per invoice ≤ open balance (spec §5.5, §11.10). */
export async function allocateReceiptAction(input: z.input<typeof allocSchema>): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("receipts.manage");
    const d = allocSchema.parse(input);
    const [rc] = await db.select().from(receipts).where(and(eq(receipts.id, d.receiptId), isNull(receipts.deletedAt)));
    if (!rc) throw new NotFoundError("receipt");
    await withUser({ userId: user.id }, async (tx) => {
      const [already] = await tx.select({ s: sql<string>`coalesce(sum(${receiptAllocations.amount}),0)` }).from(receiptAllocations).where(and(eq(receiptAllocations.receiptId, d.receiptId), isNull(receiptAllocations.cancelledAt)));
      const newSum = d.allocations.reduce((a, x) => a + x.amount, 0);
      if (Number(already?.s ?? 0) + newSum > Number(rc.amount) + 0.005) throw new ValidationError("receipts.over_receipt");
      for (const a of d.allocations) {
        if (a.amount <= 0) continue;
        const [inv] = await tx.select({ id: invoices.id, total: invoices.total, status: invoices.status, clientId: invoices.clientId, payingClientId: invoices.payingClientId }).from(invoices).where(eq(invoices.id, a.invoiceId));
        if (!inv || !["sent", "partially_paid"].includes(inv.status)) throw new BusinessRuleError("receipts.invoice_not_open");
        if (inv.clientId !== rc.clientId && inv.payingClientId !== rc.clientId) throw new BusinessRuleError("receipts.client_mismatch");
        const [paid] = await tx.select({ s: sql<string>`coalesce(sum(${receiptAllocations.amount}),0)` }).from(receiptAllocations).where(and(eq(receiptAllocations.invoiceId, a.invoiceId), isNull(receiptAllocations.cancelledAt)));
        if (Number(paid?.s ?? 0) + a.amount > Number(inv.total) + 0.005) throw new ValidationError("receipts.over_invoice");
        await tx.insert(receiptAllocations).values({ receiptId: d.receiptId, invoiceId: a.invoiceId, amount: money(a.amount).toFixed(2), createdBy: user.id });
        await syncInvoicePaymentStatus(tx, a.invoiceId);
      }
    });
    rev(rc.clientId);
    return undefined;
  });
}

/** "Allocate automatically oldest first" (spec §11.10). */
export async function autoAllocateReceiptAction(receiptId: string): Promise<ActionResult<{ allocated: number }>> {
  return runAction(async () => {
    const user = await requireCapability("receipts.manage");
    const [rc] = await db.select().from(receipts).where(and(eq(receipts.id, receiptId), isNull(receipts.deletedAt)));
    if (!rc) throw new NotFoundError("receipt");
    const allocated = await withUser({ userId: user.id }, async (tx) => {
      const [already] = await tx.select({ s: sql<string>`coalesce(sum(${receiptAllocations.amount}),0)` }).from(receiptAllocations).where(and(eq(receiptAllocations.receiptId, receiptId), isNull(receiptAllocations.cancelledAt)));
      let remaining = money(Number(rc.amount) - Number(already?.s ?? 0));
      const open = await tx
        .select({ id: invoices.id, total: invoices.total, paid: sql<string>`coalesce((select sum(a.amount) from receipt_allocations a where a.invoice_id = "invoices"."id" and a.cancelled_at is null),0)` })
        .from(invoices)
        .where(and(inArray(invoices.status, ["sent", "partially_paid"]), isNull(invoices.deletedAt), sql`(${invoices.clientId} = ${rc.clientId} or ${invoices.payingClientId} = ${rc.clientId})`))
        .orderBy(invoices.invoiceDate, invoices.sequenceNo);
      let total = 0;
      for (const inv of open) {
        if (remaining <= 0) break;
        const due = money(Number(inv.total) - Number(inv.paid));
        if (due <= 0) continue;
        const amt = Math.min(due, remaining);
        await tx.insert(receiptAllocations).values({ receiptId, invoiceId: inv.id, amount: amt.toFixed(2), createdBy: user.id });
        await syncInvoicePaymentStatus(tx, inv.id);
        remaining = money(remaining - amt);
        total += amt;
      }
      return money(total);
    });
    rev(rc.clientId);
    return { allocated };
  });
}

export async function cancelAllocationAction(id: string, reason: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("receipts.manage");
    if (user.role !== "admin") throw new BusinessRuleError("errors.forbidden");
    if (reason.trim().length < 2) throw new ValidationError("common.reason_required");
    const [a] = await db.select().from(receiptAllocations).where(eq(receiptAllocations.id, id));
    if (!a) throw new NotFoundError("allocation");
    await withUser({ userId: user.id, reason }, async (tx) => {
      await tx.update(receiptAllocations).set({ cancelledAt: new Date(), cancelledBy: user.id, cancelReason: reason }).where(eq(receiptAllocations.id, id));
      await syncInvoicePaymentStatus(tx, a.invoiceId);
    });
    rev();
    return undefined;
  });
}

export async function deleteReceiptAction(id: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("receipts.manage");
    const [a] = await db.select({ s: sql<string>`coalesce(sum(${receiptAllocations.amount}),0)` }).from(receiptAllocations).where(and(eq(receiptAllocations.receiptId, id), isNull(receiptAllocations.cancelledAt)));
    if (Number(a?.s ?? 0) > 0) throw new BusinessRuleError("receipts.has_allocations");
    await withUser({ userId: user.id }, (tx) => tx.update(receipts).set({ deletedAt: new Date() }).where(eq(receipts.id, id)));
    rev();
    return undefined;
  });
}
