import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { AuthError, BusinessRuleError, NotFoundError } from "@/lib/auth/errors";
import { db, type Tx } from "@/lib/db";
import { contracts, invoiceApprovals, invoiceLines, invoices, projects, users } from "@/lib/db/schema";
import type { ApprovalStation } from "@/lib/db/schema/invoicing";
import { withUser } from "@/lib/db/with-user";
import { getSettingFresh } from "@/lib/settings/service";
import { notifyEvent } from "@/lib/email/notify-email";
import { notify } from "@/lib/notifications/service";
import { recomputeContractStatus } from "@/lib/contracts/status";
import { recomputeInvoice } from "./build";
import { buildApprovalChain, canDecide, ChainError, currentStation } from "./approval-chain";

/**
 * Approval-chain transitions of a customer invoice (customer decision 18/09/2026):
 *   draft ─submit─▶ pending_approval@1 ─approve─▶ … @n ─approve─▶ approved ─issue─▶ signed ─▶ sent
 *                        └──────────────── reject (with reason) ────────────────▶ draft
 * The server actions in actions.ts authenticate and delegate here; the integration suite
 * drives these functions directly with a plain actor.
 */
export interface Actor {
  id: string;
  role: string;
}

type Invoice = typeof invoices.$inferSelect;

async function loadInvoice(id: string): Promise<Invoice> {
  const [inv] = await db.select().from(invoices).where(and(eq(invoices.id, id), isNull(invoices.deletedAt)));
  if (!inv) throw new NotFoundError("invoice");
  return inv;
}

/**
 * Amount check before an invoice may move on (spec §11.3). The index values are required only
 * where the amounts become final – the last approval and issuing (customer decision 20/09/2026):
 * the stations before that review the content, and the index can still be entered meanwhile.
 */
export async function assertApprovable(id: string, opts: { requireIndex: boolean } = { requireIndex: true }): Promise<Invoice> {
  const inv = await loadInvoice(id);
  const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id));
  if (!lines.some((l) => Number(l.amountThis) !== 0)) throw new BusinessRuleError("invoices.no_amount");
  if (opts.requireIndex && inv.indexLinked && (!inv.indexCurrentValue || !inv.indexBaseValue)) throw new BusinessRuleError("invoices.missing_index");
  return inv;
}

/** The configured stations, resolved to people for this invoice's project. */
export async function resolveChain(contractId: string): Promise<ApprovalStation[]> {
  const settings = await getSettingFresh("invoices");
  const [pm] = await db
    .select({ id: users.id, first: users.firstName, last: users.lastName, active: users.isActive })
    .from(contracts)
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .leftJoin(users, eq(users.id, projects.projectManagerUserId))
    .where(eq(contracts.id, contractId));
  const ids = settings.approval_stations.map((s) => s.user_id).filter((x): x is string => !!x);
  const rows = ids.length ? await db.select({ id: users.id, first: users.firstName, last: users.lastName }).from(users).where(and(inArray(users.id, ids), eq(users.isActive, true), isNull(users.deletedAt))) : [];
  try {
    return buildApprovalChain(settings.approval_stations, {
      projectManager: pm?.id && pm.active ? { id: pm.id, name: `${pm.first} ${pm.last}` } : null,
      users: new Map(rows.map((u) => [u.id, { id: u.id, name: `${u.first} ${u.last}` }])),
    });
  } catch (e) {
    if (e instanceof ChainError) throw new BusinessRuleError(e.stationKind === "project_manager" ? "invoices.no_project_manager" : "invoices.station_without_user");
    throw e;
  }
}

async function finalizeInTx(tx: Tx, inv: Invoice, approverId: string) {
  await recomputeInvoice(tx, inv.id); // final snapshot (spec §11.7)
  await tx.update(invoices).set({ status: "approved", approvedBy: approverId, approvedAt: new Date() }).where(eq(invoices.id, inv.id));
  await recomputeContractStatus(tx, inv.contractId);
}

async function notifyStation(inv: Invoice, station: ApprovalStation, actorId: string) {
  await notifyEvent({ userIds: [station.userId].filter((u) => u !== actorId), type: "invoice.pending_approval", title: `חשבון ${inv.invoiceNumber} ממתין לאישורך (${station.name})`, link: `/invoices/${inv.id}` });
}

async function notifyCreator(inv: Invoice, actorId: string, type: "invoice.approved" | "invoice.rejected", title: string, body?: string) {
  const ids = inv.createdBy && inv.createdBy !== actorId ? [inv.createdBy] : [];
  if (type === "invoice.rejected") await notifyEvent({ userIds: ids, type, title, body, link: `/invoices/${inv.id}` });
  else await notify({ userIds: ids, type, title, body, link: `/invoices/${inv.id}` });
}

/** draft → first station, or straight to approved when no stations are configured. */
export async function submitDraft(actor: Actor, id: string): Promise<"pending_approval" | "approved"> {
  const inv = await assertApprovable(id, { requireIndex: false });
  if (inv.status !== "draft") throw new BusinessRuleError("invoices.invalid_transition");
  const chain = await resolveChain(inv.contractId);
  if (chain.length === 0) {
    await assertApprovable(id); // approved at once: the amounts are final here
    await withUser({ userId: actor.id }, (tx) => finalizeInTx(tx, inv, actor.id));
    await notifyCreator(inv, actor.id, "invoice.approved", `חשבון ${inv.invoiceNumber} אושר`);
    return "approved";
  }
  await withUser({ userId: actor.id }, (tx) => tx.update(invoices).set({ status: "pending_approval", approvalChain: chain, approvalStep: 1 }).where(eq(invoices.id, id)));
  await notifyStation(inv, chain[0]!, actor.id);
  return "pending_approval";
}

/** The person at the current station approves (advance / finish) or rejects (back to draft). */
export async function decide(actor: Actor, id: string, decision: "approved" | "rejected", comment: string | null): Promise<"pending_approval" | "approved" | "draft"> {
  const inv = await loadInvoice(id);
  if (inv.status !== "pending_approval") throw new BusinessRuleError("invoices.invalid_transition");
  if (!canDecide(inv, actor)) throw new AuthError("FORBIDDEN", "not at this station");
  const station = currentStation(inv)!;
  const chain = inv.approvalChain!;
  const last = inv.approvalStep >= chain.length;
  if (decision === "approved") await assertApprovable(id, { requireIndex: last });
  await withUser({ userId: actor.id }, async (tx) => {
    await tx.insert(invoiceApprovals).values({ invoiceId: id, step: inv.approvalStep, stationKey: station.key, stationName: station.name, userId: actor.id, decision, comment, createdBy: actor.id });
    if (decision === "rejected") await tx.update(invoices).set({ status: "draft", approvalStep: 0, approvalChain: null }).where(eq(invoices.id, id));
    else if (!last) await tx.update(invoices).set({ approvalStep: inv.approvalStep + 1 }).where(eq(invoices.id, id));
    else await finalizeInTx(tx, inv, actor.id);
  });
  if (decision === "rejected") {
    await notifyCreator(inv, actor.id, "invoice.rejected", `חשבון ${inv.invoiceNumber} נדחה בתחנה "${station.name}"`, comment ?? undefined);
    return "draft";
  }
  if (!last) {
    await notifyStation(inv, chain[inv.approvalStep]!, actor.id);
    return "pending_approval";
  }
  await notifyCreator(inv, actor.id, "invoice.approved", `חשבון ${inv.invoiceNumber} אושר בכל התחנות – מוכן להפקה`);
  return "approved";
}

/** Decisions taken on an invoice, oldest first (for the stepper and the history table). */
export async function listDecisions(invoiceId: string) {
  return db
    .select({ id: invoiceApprovals.id, step: invoiceApprovals.step, stationKey: invoiceApprovals.stationKey, stationName: invoiceApprovals.stationName, decision: invoiceApprovals.decision, comment: invoiceApprovals.comment, decidedAt: invoiceApprovals.decidedAt, first: users.firstName, last: users.lastName })
    .from(invoiceApprovals)
    .innerJoin(users, eq(users.id, invoiceApprovals.userId))
    .where(eq(invoiceApprovals.invoiceId, invoiceId))
    .orderBy(invoiceApprovals.decidedAt);
}
