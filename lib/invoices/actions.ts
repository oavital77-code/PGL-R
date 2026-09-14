"use server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/auth/authorize";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/lib/auth/errors";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { db } from "@/lib/db";
import { clients, contacts, contracts, documents, invoiceLines, invoices, projects, subContracts, timeEntries, users } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { getSettingFresh } from "@/lib/settings/service";
import { notifyEvent } from "@/lib/email/notify-email";
import { notify } from "@/lib/notifications/service";
import { sendEmail } from "@/lib/email/send";
import { renderTemplate } from "@/lib/email/templates";
import { uploadGenerated, downloadBytes } from "@/lib/storage";
import { formatDate, formatMoney, todayLocal } from "@/lib/i18n/format";
import { optionalDate, optionalNumber, optionalString, optionalUuid } from "@/lib/utils/zod";
import { computeMilestoneLine, MilestoneProgressError } from "@/lib/calc/milestones";
import { money } from "@/lib/calc/money";
import { allocateInvoiceNumber, nextPartialNumber } from "./numbering";
import { buildHoursLines, buildMilestoneLines, buildRetainerLines, buildUnitLine, loadSubContractContexts, recomputeInvoice } from "./build";
import { renderInvoicePdf } from "@/lib/pdf/invoice";
import { recomputeContractStatus } from "@/lib/contracts/status";

const EDITABLE = new Set(["draft", "pending_approval"]);

function rev(id: string, contractId?: string) {
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  if (contractId) revalidatePath(`/contracts/${contractId}`);
}

async function loadInvoice(id: string) {
  const [inv] = await db.select().from(invoices).where(and(eq(invoices.id, id), isNull(invoices.deletedAt)));
  if (!inv) throw new NotFoundError("invoice");
  return inv;
}

/* ---------------------------------- create ---------------------------------- */

const createSchema = z.object({
  contractId: z.uuid(),
  subContractIds: z.array(z.uuid()).min(1),
  invoiceDate: z.iso.date(),
  periodFrom: optionalDate,
  periodTo: optionalDate,
});

/** Step 1–3 of the wizard (spec §11.4): creates a draft with number + auto-built lines. */
export async function createInvoiceDraftAction(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("invoices.create");
    const d = createSchema.parse(input);
    const [c] = await db.select({ c: contracts, projectName: projects.name }).from(contracts).innerJoin(projects, eq(projects.id, contracts.projectId)).where(and(eq(contracts.id, d.contractId), isNull(contracts.deletedAt)));
    if (!c) throw new NotFoundError("contract");
    if (c.c.direction !== "income" || !c.c.clientId) throw new BusinessRuleError("invoices.not_client_contract");
    const settings = await getSettingFresh("invoices");
    const id = await withUser({ userId: user.id }, async (tx) => {
      const num = await allocateInvoiceNumber(tx, user.id, d.invoiceDate);
      const partial = await nextPartialNumber(tx, d.contractId);
      const [row] = await tx
        .insert(invoices)
        .values({
          invoiceNumber: num.invoiceNumber,
          sequenceNo: num.sequenceNo,
          sequenceYear: num.sequenceYear,
          contractId: d.contractId,
          clientId: c.c.clientId!,
          payingClientId: c.c.payingClientId,
          partialNumber: partial,
          status: "draft",
          invoiceDate: d.invoiceDate,
          periodFrom: d.periodFrom ?? null,
          periodTo: d.periodTo ?? null,
          subject: c.projectName,
          introText: settings.default_intro_text,
          notes: settings.default_notes || null,
          retentionPct: c.c.retentionPct,
          createdBy: user.id,
        })
        .returning({ id: invoices.id });
      const invoiceId = row!.id;
      const ctxs = await loadSubContractContexts(tx, d.subContractIds);
      let sort = 1;
      const from = d.periodFrom ?? `${d.invoiceDate.slice(0, 7)}-01`;
      const to = d.periodTo ?? d.invoiceDate;
      for (const ctx of ctxs) {
        let lines: Awaited<ReturnType<typeof buildMilestoneLines>> = [];
        switch (ctx.sc.pricingMethod) {
          case "fixed_price":
          case "pct_of_cost":
            lines = await buildMilestoneLines(tx, ctx, sort);
            break;
          case "hourly":
            lines = await buildHoursLines(tx, ctx, invoiceId, d.invoiceDate, from, to, sort, settings.hours_line_grouping, true);
            break;
          case "retainer":
            lines = buildRetainerLines(ctx, from, to, sort);
            break;
          case "per_unit":
            lines = await buildUnitLine(tx, ctx, sort);
            break;
        }
        sort += lines.length;
        if (lines.length) await tx.insert(invoiceLines).values(lines.map((l) => ({ ...l, invoiceId, createdBy: user.id })));
      }
      await recomputeInvoice(tx, invoiceId);
      return invoiceId;
    });
    rev(id, d.contractId);
    return { id };
  });
}

/* ---------------------------------- edit draft ---------------------------------- */

const lineEdit = z.object({
  id: z.uuid(),
  progressPctThis: optionalNumber,
  cumulativePct: optionalNumber,
  quantity: optionalNumber,
  amountThis: optionalNumber,
  description: optionalString,
});
const linesSchema = z.object({ invoiceId: z.uuid(), lines: z.array(lineEdit) });

export async function updateInvoiceLinesAction(input: z.input<typeof linesSchema>): Promise<ActionResult<{ warnings: string[] }>> {
  return runAction(async () => {
    const user = await requireCapability("invoices.create");
    const d = linesSchema.parse(input);
    const inv = await loadInvoice(d.invoiceId);
    if (!EDITABLE.has(inv.status)) throw new BusinessRuleError("invoices.not_editable");
    const rows = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, d.invoiceId));
    const warnings: string[] = [];
    const result = await withUser({ userId: user.id }, async (tx) => {
      for (const e of d.lines) {
        const l = rows.find((r) => r.id === e.id);
        if (!l) continue;
        if (l.lineType === "milestone") {
          const prev = Number(l.cumulativePct ?? 0) - Number(l.progressPctThis ?? 0);
          const progress = e.cumulativePct !== undefined ? e.cumulativePct - prev : (e.progressPctThis ?? Number(l.progressPctThis ?? 0));
          const signedProgress = inv.invoiceKind === "credit" ? -Math.abs(progress) : progress;
          try {
            const line = computeMilestoneLine({ milestoneId: l.milestoneId!, stageAmount: Number(l.stageAmount), stagePct: Number(l.stagePct), openingBilledPct: 0, priorProgressPct: prev, progressPctThis: signedProgress });
            await tx.update(invoiceLines).set({ progressPctThis: line.progressPctThis.toFixed(3), cumulativePct: line.cumulativePct.toFixed(3), amountThis: Math.abs(line.amountThis).toFixed(2), cumulativeAmount: line.cumulativeAmount.toFixed(2), description: e.description ?? l.description }).where(eq(invoiceLines.id, l.id));
          } catch (err) {
            if (err instanceof MilestoneProgressError) throw new ValidationError(err.code === "OVER_100" ? "invoices.milestone_over_100" : "invoices.milestone_below_0", { [l.id]: [err.code] });
            throw err;
          }
        } else if (l.lineType === "unit") {
          const q = e.quantity ?? Number(l.quantity ?? 0);
          const amount = money(q * Number(l.unitPrice ?? 0));
          await tx.update(invoiceLines).set({ quantity: q.toFixed(3), amountThis: amount.toFixed(2), description: e.description ?? l.description }).where(eq(invoiceLines.id, l.id));
          const [sc] = await tx.select({ agreed: subContracts.agreedQuantity }).from(subContracts).where(eq(subContracts.id, l.subContractId));
          if (sc?.agreed && Number(l.cumulativeQuantity ?? 0) + q > Number(sc.agreed)) warnings.push("invoices.unit_over_agreed");
        } else if (l.lineType === "extra" || l.lineType === "adjustment" || l.lineType === "retainer") {
          await tx.update(invoiceLines).set({ amountThis: (e.amountThis ?? Number(l.amountThis)).toFixed(2), description: e.description ?? l.description }).where(eq(invoiceLines.id, l.id));
        } else if (e.description !== undefined) {
          await tx.update(invoiceLines).set({ description: e.description }).where(eq(invoiceLines.id, l.id));
        }
      }
      // hourly caps → warning only (spec §11.6.1)
      const hourly = rows.filter((r) => r.lineType === "hours");
      if (hourly.length) {
        const scs = await tx.select().from(subContracts).where(inArray(subContracts.id, [...new Set(hourly.map((h) => h.subContractId))]));
        for (const sc of scs) {
          const hrs = hourly.filter((h) => h.subContractId === sc.id).reduce((a, h) => a + Number(h.hours ?? 0), 0);
          const amt = hourly.filter((h) => h.subContractId === sc.id).reduce((a, h) => a + Number(h.amountThis), 0);
          if ((sc.hoursCap && hrs > Number(sc.hoursCap)) || (sc.amountCap && amt > Number(sc.amountCap))) warnings.push("invoices.hours_over_cap");
        }
      }
      return recomputeInvoice(tx, d.invoiceId);
    });
    if (result.consistencyWarning) warnings.push("invoices.consistency_warning");
    rev(d.invoiceId, inv.contractId);
    return { warnings: [...new Set(warnings)] };
  });
}

const headerSchema = z.object({
  invoiceId: z.uuid(),
  invoiceDate: z.iso.date(),
  subject: optionalString,
  introText: optionalString,
  notes: optionalString,
  indexMonth: optionalDate,
  vatRate: optionalNumber,
  vatOverrideReason: optionalString,
  vatExempt: z.preprocess((v) => (v === "" || v == null ? undefined : v === "true" || v === "on"), z.boolean().optional()),
  vatExemptReason: optionalString,
  retentionPct: optionalNumber,
  payingClientId: optionalUuid,
});

export async function updateInvoiceHeaderAction(fd: FormData): Promise<ActionResult<{ missingIndex: boolean }>> {
  return runAction(async () => {
    const user = await requireCapability("invoices.create");
    const raw: Record<string, unknown> = {};
    for (const [k, v] of fd.entries()) raw[k] = v;
    const d = headerSchema.parse(raw);
    const inv = await loadInvoice(d.invoiceId);
    if (!EDITABLE.has(inv.status)) throw new BusinessRuleError("invoices.not_editable");
    const vatOverride = d.vatRate !== undefined && d.vatRate !== Number(inv.vatRate);
    if (vatOverride && !d.vatOverrideReason) throw new ValidationError("common.reason_required", { vatOverrideReason: ["common.reason_required"] });
    const exemptChanged = d.vatExempt !== undefined && d.vatExempt !== inv.vatExempt;
    if (exemptChanged && !d.vatExemptReason) throw new ValidationError("common.reason_required", { vatExemptReason: ["common.reason_required"] });
    const res = await withUser({ userId: user.id, reason: d.vatOverrideReason ?? d.vatExemptReason }, async (tx) => {
      await tx
        .update(invoices)
        .set({
          invoiceDate: d.invoiceDate,
          subject: d.subject ?? null,
          introText: d.introText ?? null,
          notes: d.notes ?? null,
          retentionPct: d.retentionPct === undefined ? inv.retentionPct : d.retentionPct.toFixed(2),
          payingClientId: d.payingClientId ?? inv.payingClientId,
          vatOverrideReason: vatOverride ? d.vatOverrideReason : inv.vatOverrideReason,
          vatExemptReason: exemptChanged ? d.vatExemptReason : inv.vatExemptReason,
          indexMonth: d.indexMonth ? `${d.indexMonth.slice(0, 7)}-01` : null,
        })
        .where(eq(invoices.id, d.invoiceId));
      return recomputeInvoice(tx, d.invoiceId, { indexMonth: d.indexMonth ? `${d.indexMonth.slice(0, 7)}-01` : null, vatRate: vatOverride ? d.vatRate : inv.vatOverrideReason ? Number(inv.vatRate) : null, vatExempt: d.vatExempt ?? null });
    });
    rev(d.invoiceId, inv.contractId);
    return { missingIndex: res.missingIndex };
  });
}

const extraSchema = z.object({ invoiceId: z.uuid(), subContractId: z.uuid(), lineType: z.enum(["extra", "adjustment"]), description: z.string().trim().min(1).max(300), amount: z.coerce.number() });

/** Extra / adjustment lines require invoices.approve (spec §11.6.5). */
export async function addExtraLineAction(fd: FormData): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("invoices.approve");
    const d = extraSchema.parse(Object.fromEntries(fd.entries()));
    const inv = await loadInvoice(d.invoiceId);
    if (!EDITABLE.has(inv.status)) throw new BusinessRuleError("invoices.not_editable");
    await withUser({ userId: user.id }, async (tx) => {
      const [m] = await tx.select({ n: sql<number>`coalesce(max(${invoiceLines.sortOrder}),0)` }).from(invoiceLines).where(eq(invoiceLines.invoiceId, d.invoiceId));
      await tx.insert(invoiceLines).values({ invoiceId: d.invoiceId, subContractId: d.subContractId, lineType: d.lineType, sortOrder: Number(m?.n ?? 0) + 1, description: d.description, amountThis: d.amount.toFixed(2), createdBy: user.id });
      await recomputeInvoice(tx, d.invoiceId);
    });
    rev(d.invoiceId, inv.contractId);
    return undefined;
  });
}

export async function removeLineAction(lineId: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("invoices.create");
    const [l] = await db.select().from(invoiceLines).where(eq(invoiceLines.id, lineId));
    if (!l) throw new NotFoundError("line");
    const inv = await loadInvoice(l.invoiceId);
    if (!EDITABLE.has(inv.status)) throw new BusinessRuleError("invoices.not_editable");
    await withUser({ userId: user.id }, async (tx) => {
      if (l.lineType === "hours") await tx.update(timeEntries).set({ invoiceId: null }).where(and(eq(timeEntries.invoiceId, l.invoiceId), eq(timeEntries.subContractId, l.subContractId)));
      await tx.delete(invoiceLines).where(eq(invoiceLines.id, lineId));
      await recomputeInvoice(tx, l.invoiceId);
    });
    rev(l.invoiceId, inv.contractId);
    return undefined;
  });
}

/** Remove a single time entry from a draft – it stays billable in the next invoice (spec §11.6.1). */
export async function removeTimeEntryFromDraftAction(invoiceId: string, entryId: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("invoices.create");
    const inv = await loadInvoice(invoiceId);
    if (!EDITABLE.has(inv.status)) throw new BusinessRuleError("invoices.not_editable");
    const settings = await getSettingFresh("invoices");
    await withUser({ userId: user.id }, async (tx) => {
      const [e] = await tx.select().from(timeEntries).where(and(eq(timeEntries.id, entryId), eq(timeEntries.invoiceId, invoiceId)));
      if (!e) throw new NotFoundError("time_entry");
      await tx.update(timeEntries).set({ invoiceId: null }).where(eq(timeEntries.id, entryId));
      // rebuild hours lines of that sub-contract
      const [m] = await tx.select({ n: sql<number>`coalesce(min(${invoiceLines.sortOrder}),1)` }).from(invoiceLines).where(and(eq(invoiceLines.invoiceId, invoiceId), eq(invoiceLines.subContractId, e.subContractId), eq(invoiceLines.lineType, "hours")));
      await tx.delete(invoiceLines).where(and(eq(invoiceLines.invoiceId, invoiceId), eq(invoiceLines.subContractId, e.subContractId), eq(invoiceLines.lineType, "hours")));
      const [ctx] = await loadSubContractContexts(tx, [e.subContractId]);
      const lines = await buildHoursLines(tx, ctx!, invoiceId, inv.invoiceDate, inv.periodFrom ?? "1900-01-01", inv.periodTo ?? "2999-12-31", Number(m?.n ?? 1), settings.hours_line_grouping, false);
      if (lines.length) await tx.insert(invoiceLines).values(lines.map((l) => ({ ...l, invoiceId, createdBy: user.id })));
      await recomputeInvoice(tx, invoiceId);
    });
    rev(invoiceId, inv.contractId);
    return undefined;
  });
}

/* ---------------------------------- workflow ---------------------------------- */

async function assertApprovable(id: string) {
  const inv = await loadInvoice(id);
  const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id));
  if (!lines.some((l) => Number(l.amountThis) !== 0)) throw new BusinessRuleError("invoices.no_amount");
  if (inv.indexLinked && (!inv.indexCurrentValue || !inv.indexBaseValue)) throw new BusinessRuleError("invoices.missing_index");
  return inv;
}

export async function submitForApprovalAction(id: string): Promise<ActionResult<{ status: string }>> {
  return runAction(async () => {
    const user = await requireCapability("invoices.create");
    const inv = await assertApprovable(id);
    if (inv.status !== "draft") throw new BusinessRuleError("invoices.invalid_transition");
    const settings = await getSettingFresh("invoices");
    if (!settings.require_second_approval) return approveInternal(id, user.id);
    await withUser({ userId: user.id }, (tx) => tx.update(invoices).set({ status: "pending_approval" }).where(eq(invoices.id, id)));
    const approvers = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.isActive, true)));
    await notifyEvent({ userIds: approvers.map((a) => a.id).filter((a) => a !== user.id), type: "invoice.pending_approval", title: `חשבון ${inv.invoiceNumber} ממתין לאישור`, link: `/invoices/${id}` });
    rev(id, inv.contractId);
    return { status: "pending_approval" };
  });
}

async function approveInternal(id: string, approverId: string) {
  const inv = await assertApprovable(id);
  await withUser({ userId: approverId }, async (tx) => {
    await recomputeInvoice(tx, id); // final snapshot (spec §11.7)
    await tx.update(invoices).set({ status: "approved", approvedBy: approverId, approvedAt: new Date() }).where(eq(invoices.id, id));
    await recomputeContractStatus(tx, inv.contractId);
  });
  await notify({ userIds: inv.createdBy && inv.createdBy !== approverId ? [inv.createdBy] : [], type: "invoice.approved", title: `חשבון ${inv.invoiceNumber} אושר`, link: `/invoices/${id}` });
  // contract progress alerts (spec §13.2) are evaluated by the contract-alerts cron
  rev(id, inv.contractId);
  return { status: "approved" };
}

export async function approveInvoiceAction(id: string): Promise<ActionResult<{ status: string }>> {
  return runAction(async () => {
    const user = await requireCapability("invoices.approve");
    const inv = await loadInvoice(id);
    if (inv.status !== "pending_approval" && inv.status !== "draft") throw new BusinessRuleError("invoices.invalid_transition");
    const settings = await getSettingFresh("invoices");
    if (settings.require_second_approval && inv.status === "pending_approval" && inv.createdBy === user.id) throw new BusinessRuleError("invoices.second_approver_required");
    return approveInternal(id, user.id);
  });
}

/** Render + store the final PDF with the signer's signature (spec §11.3, §11.8). */
export async function signInvoiceAction(id: string, signerUserId?: string): Promise<ActionResult<{ documentId: string }>> {
  return runAction(async () => {
    const user = await requireCapability("invoices.sign");
    const inv = await loadInvoice(id);
    if (inv.status !== "approved") throw new BusinessRuleError("invoices.invalid_transition");
    const settings = await getSettingFresh("invoices");
    const signerId = signerUserId ?? settings.default_signer_user_id ?? user.id;
    const [signer] = await db.select().from(users).where(eq(users.id, signerId));
    if (!signer || signer.role !== "admin" || !signer.signatureImagePath) throw new BusinessRuleError("invoices.signer_without_signature");
    const [contract] = await db.select({ workNumber: projects.workNumber }).from(contracts).innerJoin(projects, eq(projects.id, contracts.projectId)).where(eq(contracts.id, inv.contractId));
    const pdf = await renderInvoicePdf(id, { draft: false, signer: { id: signer.id, name: `${signer.firstName} ${signer.lastName}`, title: signer.signatureTitle ?? "", signaturePath: signer.signatureImagePath } });
    const documentId = await withUser({ userId: user.id }, async (tx) => {
      const r = await uploadGenerated({ bucket: "invoices", entityType: "invoice", entityId: id, fileName: `PGL_חשבון_${inv.invoiceNumber}_${contract?.workNumber ?? ""}.pdf`, mime: "application/pdf", bytes: pdf, documentType: "invoice", userId: user.id, pathOverride: `${inv.invoiceDate.slice(0, 4)}/${id}.pdf` }, tx);
      await tx.update(invoices).set({ status: "signed", signedBy: signer.id, signedAt: new Date(), signatureTitleSnapshot: signer.signatureTitle, pdfDocumentId: r.id }).where(eq(invoices.id, id));
      return r.id;
    });
    await notify({ userIds: inv.createdBy && inv.createdBy !== user.id ? [inv.createdBy] : [], type: "invoice.signed", title: `חשבון ${inv.invoiceNumber} נחתם`, link: `/invoices/${id}` });
    rev(id, inv.contractId);
    return { documentId };
  });
}

const sendSchema = z.object({ invoiceId: z.uuid(), to: z.array(z.email()).min(1), cc: z.array(z.email()).default([]), subject: z.string().trim().min(1), body: z.string().trim().min(1) });

export async function sendInvoiceAction(input: z.input<typeof sendSchema>): Promise<ActionResult<{ status: string }>> {
  return runAction(async () => {
    const user = await requireCapability("invoices.send");
    const d = sendSchema.parse(input);
    const inv = await loadInvoice(d.invoiceId);
    if (inv.status !== "signed" || !inv.pdfDocumentId) throw new BusinessRuleError("invoices.invalid_transition");
    const [doc] = await db.select().from(documents).where(eq(documents.id, inv.pdfDocumentId));
    if (!doc) throw new NotFoundError("pdf");
    const pdf = await downloadBytes(doc.storageBucket, doc.storagePath);
    const names = await db.select({ email: contacts.email, first: contacts.firstName }).from(contacts).where(and(inArray(contacts.email, d.to), isNull(contacts.deletedAt)));
    const res = await sendEmail({
      to: d.to.map((email) => ({ email, name: names.find((n) => n.email === email)?.first })),
      cc: d.cc,
      subject: d.subject,
      text: d.body,
      attachments: [{ filename: doc.fileName, content: pdf }],
      relatedEntityType: "invoice",
      relatedEntityId: d.invoiceId,
    });
    if (res.status === "failed") throw new BusinessRuleError("invoices.email_failed", res.error);
    await withUser({ userId: user.id }, (tx) => tx.update(invoices).set({ status: "sent", sentAt: new Date(), sentTo: { to: d.to.map((email) => ({ email })), cc: d.cc } }).where(eq(invoices.id, d.invoiceId)));
    await notify({ userIds: inv.createdBy && inv.createdBy !== user.id ? [inv.createdBy] : [], type: "invoice.sent", title: `חשבון ${inv.invoiceNumber} נשלח`, link: `/invoices/${d.invoiceId}` });
    rev(d.invoiceId, inv.contractId);
    return { status: "sent" };
  });
}

/** Default recipients / subject / body for the send dialog (spec §11.3). */
export async function sendDefaultsAction(invoiceId: string) {
  await requireCapability("invoices.send");
  const inv = await loadInvoice(invoiceId);
  const [email, company] = await Promise.all([getSettingFresh("email"), getSettingFresh("company")]);
  const [ctx] = await db.select({ workNumber: projects.workNumber, projectName: projects.name, clientName: clients.name }).from(contracts).innerJoin(projects, eq(projects.id, contracts.projectId)).innerJoin(clients, eq(clients.id, contracts.clientId)).where(eq(contracts.id, inv.contractId));
  const targets = await db.select({ email: contacts.email, first: contacts.firstName, last: contacts.lastName }).from(contacts).where(and(eq(contacts.clientId, inv.payingClientId ?? inv.clientId), eq(contacts.receivesInvoices, true), isNull(contacts.deletedAt)));
  const vars = { client_name: ctx?.clientName, contact_first_name: targets[0]?.first ?? "", invoice_number: inv.invoiceNumber, project_name: ctx?.projectName, work_number: ctx?.workNumber, total: formatMoney(inv.total, { symbol: false }), due_date: formatDate(inv.dueDate), sender_name: email.from_name, company_name: company.name };
  return {
    to: targets.filter((t) => t.email).map((t) => ({ email: t.email!, name: `${t.first} ${t.last}` })),
    cc: email.invoice_cc,
    subject: renderTemplate(email.templates.invoice.subject, vars),
    body: renderTemplate(email.templates.invoice.body, vars),
  };
}

export async function cancelInvoiceAction(id: string, reason: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("invoices.cancel");
    const inv = await loadInvoice(id);
    if (inv.status === "cancelled") throw new BusinessRuleError("invoices.invalid_transition");
    const [alloc] = await db.select({ s: sql<string>`coalesce(sum(a.amount),0)` }).from(sql`receipt_allocations a`).where(sql`a.invoice_id = ${id} and a.cancelled_at is null`);
    if (Number(alloc?.s ?? 0) > 0) throw new BusinessRuleError("invoices.has_receipts");
    if (reason.trim().length < 2) throw new ValidationError("common.reason_required");
    await withUser({ userId: user.id, reason }, async (tx) => {
      await tx.update(invoices).set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: user.id, cancelReason: reason }).where(eq(invoices.id, id));
      await tx.update(timeEntries).set({ invoiceId: null }).where(eq(timeEntries.invoiceId, id));
      await recomputeContractStatus(tx, inv.contractId);
    });
    if (inv.status === "sent" || inv.status === "partially_paid") {
      const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.isActive, true)));
      await notifyEvent({ userIds: admins.map((a) => a.id), type: "invoice.cancelled", title: `חשבון ${inv.invoiceNumber} שנשלח בוטל`, body: reason, link: `/invoices/${id}` });
    }
    rev(id, inv.contractId);
    return undefined;
  });
}

export async function backToDraftAction(id: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("invoices.approve");
    if (user.role !== "admin") throw new BusinessRuleError("errors.forbidden");
    const inv = await loadInvoice(id);
    if (inv.status !== "approved" && inv.status !== "signed" && inv.status !== "pending_approval") throw new BusinessRuleError("invoices.invalid_transition");
    await withUser({ userId: user.id }, async (tx) => {
      if (inv.pdfDocumentId) await tx.update(documents).set({ deletedAt: new Date() }).where(eq(documents.id, inv.pdfDocumentId));
      await tx.update(invoices).set({ status: "draft", approvedBy: null, approvedAt: null, signedBy: null, signedAt: null, signatureTitleSnapshot: null, pdfDocumentId: null }).where(eq(invoices.id, id));
      await recomputeInvoice(tx, id);
      await recomputeContractStatus(tx, inv.contractId);
    });
    rev(id, inv.contractId);
    return undefined;
  });
}

/* ---------------------------------- credit ---------------------------------- */

const creditSchema = z.object({ invoiceId: z.uuid(), lines: z.array(z.object({ lineId: z.uuid(), pct: z.coerce.number().min(0).max(100).optional(), amount: z.coerce.number().min(0).optional() })).min(1) });

/** Credit invoice referencing an existing one (spec §11.11). */
export async function createCreditInvoiceAction(input: z.input<typeof creditSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("invoices.create");
    const d = creditSchema.parse(input);
    const src = await loadInvoice(d.invoiceId);
    if (!["approved", "signed", "sent", "partially_paid", "paid"].includes(src.status)) throw new BusinessRuleError("invoices.invalid_transition");
    const srcLines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, d.invoiceId));
    const settings = await getSettingFresh("invoices");
    const id = await withUser({ userId: user.id }, async (tx) => {
      const today = todayLocal();
      const num = await allocateInvoiceNumber(tx, user.id, today);
      const partial = await nextPartialNumber(tx, src.contractId);
      const [row] = await tx
        .insert(invoices)
        .values({
          invoiceNumber: num.invoiceNumber,
          sequenceNo: num.sequenceNo,
          sequenceYear: num.sequenceYear,
          invoiceKind: "credit",
          creditOfInvoiceId: src.id,
          contractId: src.contractId,
          clientId: src.clientId,
          payingClientId: src.payingClientId,
          partialNumber: partial,
          status: "draft",
          invoiceDate: today,
          subject: src.subject,
          introText: settings.default_intro_text,
          retentionPct: src.retentionPct,
          createdBy: user.id,
        })
        .returning({ id: invoices.id });
      const creditId = row!.id;
      let sort = 1;
      for (const sel of d.lines) {
        const l = srcLines.find((x) => x.id === sel.lineId);
        if (!l) continue;
        if (l.lineType === "milestone") {
          const pct = sel.pct ?? (sel.amount ? (sel.amount / Number(l.stageAmount)) * 100 : Number(l.progressPctThis));
          const prevCum = Number(l.cumulativePct); // after source
          const line = computeMilestoneLine({ milestoneId: l.milestoneId!, stageAmount: Number(l.stageAmount), stagePct: Number(l.stagePct), openingBilledPct: 0, priorProgressPct: prevCum, progressPctThis: -pct });
          await tx.insert(invoiceLines).values({ invoiceId: creditId, subContractId: l.subContractId, milestoneId: l.milestoneId, lineType: "milestone", sortOrder: sort++, description: l.description, stagePct: l.stagePct, stageAmount: l.stageAmount, progressPctThis: line.progressPctThis.toFixed(3), cumulativePct: line.cumulativePct.toFixed(3), amountThis: Math.abs(line.amountThis).toFixed(2), cumulativeAmount: line.cumulativeAmount.toFixed(2), createdBy: user.id });
        } else {
          const amount = sel.amount ?? (sel.pct !== undefined ? (Number(l.amountThis) * sel.pct) / 100 : Number(l.amountThis));
          await tx.insert(invoiceLines).values({ invoiceId: creditId, subContractId: l.subContractId, lineType: l.lineType, sortOrder: sort++, description: l.description, hours: l.hours, hourlyRate: l.hourlyRate, quantity: l.quantity, unitPrice: l.unitPrice, retainerMonth: l.retainerMonth, amountThis: money(amount).toFixed(2), createdBy: user.id });
        }
      }
      await recomputeInvoice(tx, creditId);
      return creditId;
    });
    rev(id, src.contractId);
    return { id };
  });
}

/** Preview PDF (draft watermark) – returns the document id of a temporary render. */
export async function previewInvoicePdfAction(id: string): Promise<ActionResult<{ base64: string }>> {
  return runAction(async () => {
    await requireCapability("invoices.view");
    const inv = await loadInvoice(id);
    const pdf = await renderInvoicePdf(id, { draft: inv.status !== "signed" && inv.status !== "sent" && inv.status !== "partially_paid" && inv.status !== "paid" });
    return { base64: pdf.toString("base64") };
  });
}
