import "server-only";
import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Tx } from "@/lib/db";
import { db } from "@/lib/db";
import { billingRates, clients, contracts, grades, indexValues, invoiceLines, invoices, milestones, projectCostEstimates, subContracts, timeEntries, users, vatRates } from "@/lib/db/schema";
import {
  computeIndexRatio,
  computeInvoiceSummary,
  computeMilestoneLine,
  computeSubContractTotal,
  findIndexValue,
  isCountedStatus,
  milestoneAmounts,
  rateFor,
  resolveInvoiceIndexMonth,
  vatRateFor,
  dueDate as calcDueDate,
  type InvoiceStatus,
} from "@/lib/calc";
import { money, sumMoney } from "@/lib/calc/money";
import { getSettingFresh } from "@/lib/settings/service";
import { todayLocal } from "@/lib/i18n/format";

/** Statuses whose lines count as prior progress – the same rule as the balance engine (a draft included). */
const COUNTED: InvoiceStatus[] = (["draft", "pending_approval", "approved", "signed", "sent", "partially_paid", "paid", "cancelled"] as InvoiceStatus[]).filter(isCountedStatus);

export type LineInsert = Omit<typeof invoiceLines.$inferInsert, "invoiceId" | "id" | "createdAt" | "updatedAt" | "createdBy">;

type DbLike = Tx | typeof db;

/** Prior progress per milestone from counted invoices (credits negative). */
async function priorProgress(tx: DbLike, milestoneIds: string[], excludeInvoiceId?: string): Promise<Map<string, number>> {
  if (milestoneIds.length === 0) return new Map();
  const rows = await tx
    .select({ milestoneId: invoiceLines.milestoneId, pct: invoiceLines.progressPctThis, kind: invoices.invoiceKind, status: invoices.status, invoiceId: invoices.id })
    .from(invoiceLines)
    .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
    .where(and(inArray(invoiceLines.milestoneId, milestoneIds), inArray(invoices.status, COUNTED), isNull(invoices.deletedAt)));
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.invoiceId === excludeInvoiceId) continue;
    m.set(r.milestoneId!, (m.get(r.milestoneId!) ?? 0) + Number(r.pct ?? 0) * (r.kind === "credit" ? -1 : 1));
  }
  return m;
}

export interface SubContractContext {
  sc: typeof subContracts.$inferSelect;
  milestoneBase: number;
  discountPct: number;
}

export async function loadSubContractContexts(tx: DbLike, subContractIds: string[]): Promise<SubContractContext[]> {
  const scs = await tx.select().from(subContracts).where(and(inArray(subContracts.id, subContractIds), isNull(subContracts.deletedAt))).orderBy(subContracts.numberInContract);
  const today = todayLocal();
  const out: SubContractContext[] = [];
  for (const sc of scs) {
    let est: number | null = null;
    if (sc.pricingMethod === "pct_of_cost") {
      const rows = await tx.select().from(projectCostEstimates).where(and(eq(projectCostEstimates.subContractId, sc.id), lte(projectCostEstimates.effectiveFrom, today))).orderBy(sql`${projectCostEstimates.effectiveFrom} desc`).limit(1);
      est = rows[0] ? Number(rows[0].amount) : null;
    }
    const total = computeSubContractTotal({ pricingMethod: sc.pricingMethod, basePrice: num(sc.basePrice), discountPct: num(sc.discountPct), feePct: num(sc.feePct) }, { currentEstimate: est });
    out.push({ sc, milestoneBase: total.milestoneBase ?? 0, discountPct: Number(sc.discountPct ?? 0) });
  }
  return out;
}

/** Milestone lines with progress 0 for each milestone of fixed_price / pct_of_cost sub-contracts (spec §11.5). */
export async function buildMilestoneLines(tx: DbLike, ctx: SubContractContext, sortStart: number, excludeInvoiceId?: string, progressByMilestone?: Map<string, number>): Promise<LineInsert[]> {
  const ms = await tx.select().from(milestones).where(and(eq(milestones.subContractId, ctx.sc.id), isNull(milestones.deletedAt))).orderBy(milestones.sortOrder);
  const prior = await priorProgress(tx, ms.map((m) => m.id), excludeInvoiceId);
  const lines: LineInsert[] = [];
  let sort = sortStart;
  for (const m of ms) {
    const amounts = milestoneAmounts(ctx.milestoneBase, { id: m.id, name: m.name, pctOfSubcontract: Number(m.pctOfSubcontract), discountPct: m.discountPct === null ? null : Number(m.discountPct) }, ctx.discountPct);
    const line = computeMilestoneLine({
      milestoneId: m.id,
      stageAmount: amounts.total,
      stagePct: Number(m.pctOfSubcontract),
      openingBilledPct: Number(m.openingBilledPct),
      priorProgressPct: prior.get(m.id) ?? 0,
      progressPctThis: progressByMilestone?.get(m.id) ?? 0,
    });
    lines.push({
      subContractId: ctx.sc.id,
      milestoneId: m.id,
      lineType: "milestone",
      sortOrder: sort++,
      description: m.name,
      stagePct: line.stagePct.toFixed(3),
      stageAmount: line.stageAmount.toFixed(2),
      progressPctThis: line.progressPctThis.toFixed(3),
      cumulativePct: line.cumulativePct.toFixed(3),
      amountThis: line.amountThis.toFixed(2),
      cumulativeAmount: line.cumulativeAmount.toFixed(2),
    });
  }
  return lines;
}

/** Hours lines from un-invoiced time entries in the period (spec §11.6.1). Marks entries with the draft id. */
export async function buildHoursLines(tx: DbLike, ctx: SubContractContext, invoiceId: string, invoiceDate: string, from: string, to: string, sortStart: number, grouping: "grade" | "employee", claim: boolean): Promise<LineInsert[]> {
  if (claim) {
    await tx
      .update(timeEntries)
      .set({ invoiceId })
      .where(and(eq(timeEntries.subContractId, ctx.sc.id), isNull(timeEntries.invoiceId), isNull(timeEntries.deletedAt), gte(timeEntries.workDate, from), lte(timeEntries.workDate, to)));
  }
  const entries = await tx
    .select({ userId: timeEntries.userId, minutes: timeEntries.minutes, gradeId: users.gradeId, first: users.firstName, last: users.lastName, gradeName: grades.name })
    .from(timeEntries)
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .leftJoin(grades, eq(grades.id, users.gradeId))
    .where(and(eq(timeEntries.invoiceId, invoiceId), eq(timeEntries.subContractId, ctx.sc.id), isNull(timeEntries.deletedAt)));
  const rates = await tx.select({ gradeId: billingRates.gradeId, effectiveFrom: billingRates.effectiveFrom, hourlyRate: billingRates.hourlyRate }).from(billingRates);
  const rateOf = (gradeId: string | null): number => {
    if (ctx.sc.hourlyMode === "custom") return Number(ctx.sc.customHourlyRate ?? 0);
    if (!gradeId) return 0;
    const r = rateFor(rates.filter((x) => x.gradeId === gradeId), invoiceDate);
    return r ? Number(r.hourlyRate) : 0;
  };
  const groups = new Map<string, { gradeId: string | null; userId: string | null; label: string; minutes: number }>();
  for (const e of entries) {
    const key = grouping === "grade" && ctx.sc.hourlyMode !== "custom" ? `g:${e.gradeId ?? "none"}` : `u:${e.userId}`;
    const g = groups.get(key);
    if (g) g.minutes += e.minutes;
    else groups.set(key, { gradeId: e.gradeId, userId: grouping === "employee" || ctx.sc.hourlyMode === "custom" ? e.userId : null, label: grouping === "grade" && ctx.sc.hourlyMode !== "custom" ? (e.gradeName ?? "—") : `${e.first} ${e.last}`, minutes: e.minutes });
  }
  const lines: LineInsert[] = [];
  let sort = sortStart;
  for (const g of groups.values()) {
    const hours = Math.round((g.minutes / 60) * 100) / 100;
    const rate = rateOf(g.gradeId);
    lines.push({ subContractId: ctx.sc.id, lineType: "hours", sortOrder: sort++, description: g.label, gradeId: g.gradeId, userId: g.userId, hours: hours.toFixed(2), hourlyRate: rate.toFixed(2), amountThis: money(hours * rate).toFixed(2) });
  }
  return lines;
}

/** Retainer: one line per month in the period (spec §11.6.2). */
export function buildRetainerLines(ctx: SubContractContext, from: string, to: string, sortStart: number): LineInsert[] {
  const lines: LineInsert[] = [];
  let sort = sortStart;
  for (let m = `${from.slice(0, 7)}-01`; m <= to; ) {
    if ((!ctx.sc.retainerStart || m >= `${ctx.sc.retainerStart.slice(0, 7)}-01`) && (!ctx.sc.retainerEnd || m <= ctx.sc.retainerEnd)) {
      lines.push({ subContractId: ctx.sc.id, lineType: "retainer", sortOrder: sort++, description: `ריטיינר ${m.slice(5, 7)}/${m.slice(0, 4)}`, retainerMonth: m, amountThis: Number(ctx.sc.monthlyAmount ?? 0).toFixed(2) });
    }
    const y = Number(m.slice(0, 4));
    const mo = Number(m.slice(5, 7));
    m = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
  }
  return lines;
}

/** Per-unit: one editable quantity line (spec §11.6.4). */
export async function buildUnitLine(tx: DbLike, ctx: SubContractContext, sortStart: number, excludeInvoiceId?: string): Promise<LineInsert[]> {
  const [prev] = await tx
    .select({ q: sql<string>`coalesce(sum(${invoiceLines.quantity} * case when ${invoices.invoiceKind} = 'credit' then -1 else 1 end),0)` })
    .from(invoiceLines)
    .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
    .where(and(eq(invoiceLines.subContractId, ctx.sc.id), eq(invoiceLines.lineType, "unit"), inArray(invoices.status, COUNTED), excludeInvoiceId ? sql`${invoices.id} <> ${excludeInvoiceId}` : undefined));
  const prevQ = Number(prev?.q ?? 0);
  return [{ subContractId: ctx.sc.id, lineType: "unit", sortOrder: sortStart, description: ctx.sc.name, quantity: "0.000", unitPrice: Number(ctx.sc.unitPrice ?? 0).toFixed(2), cumulativeQuantity: prevQ.toFixed(3), amountThis: "0.00" }];
}

/* ------------------------------------------------------------------ */
/* Summary recompute                                                   */
/* ------------------------------------------------------------------ */

export interface SummaryOverrides {
  indexMonth?: string | null;
  vatRate?: number | null;
  vatExempt?: boolean | null;
}

/**
 * Recompute and persist the invoice header amounts from its lines (spec §11.7).
 * Draft only – approved invoices are snapshots.
 */
export async function recomputeInvoice(tx: DbLike, invoiceId: string, overrides: SummaryOverrides = {}) {
  const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!inv) throw new Error("invoice not found");
  const [contract] = await tx.select().from(contracts).where(eq(contracts.id, inv.contractId));
  const [client] = await tx.select().from(clients).where(eq(clients.id, inv.payingClientId ?? inv.clientId));
  const lines = await tx.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId)).orderBy(invoiceLines.sortOrder);
  const settings = await getSettingFresh("invoices", tx);
  const indexSettings = await getSettingFresh("index", tx);
  const sign = inv.invoiceKind === "credit" ? -1 : 1;

  const sumAmountThis = sumMoney(lines.map((l) => l.amountThis));
  // cumulative: milestone lines carry cumulative_amount; other lines: Σ amount_this of counted prior invoices of the same sub-contract + this
  const msCumulative = sumMoney(lines.filter((l) => l.lineType === "milestone").map((l) => l.cumulativeAmount));
  const otherScIds = [...new Set(lines.filter((l) => l.lineType !== "milestone" && l.lineType !== "extra" && l.lineType !== "adjustment").map((l) => l.subContractId))];
  let otherPrior = 0;
  if (otherScIds.length) {
    const [r] = await tx
      .select({ s: sql<string>`coalesce(sum(${invoiceLines.amountThis} * case when ${invoices.invoiceKind}='credit' then -1 else 1 end),0)` })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .where(and(inArray(invoiceLines.subContractId, otherScIds), sql`${invoiceLines.lineType} not in ('milestone')`, inArray(invoices.status, COUNTED), sql`${invoices.id} <> ${invoiceId}`, sql`${invoices.invoiceDate} <= ${inv.invoiceDate}`));
    otherPrior = Number(r?.s ?? 0);
  }
  const otherThis = sumMoney(lines.filter((l) => l.lineType !== "milestone").map((l) => l.amountThis)) * sign;
  const cumulativeBase = money(msCumulative + otherPrior + otherThis);

  // prior invoices of the contract (counted, not this one)
  const prior = await tx
    .select({ subtotalBase: invoices.subtotalBase, total: invoices.total, kind: invoices.invoiceKind, allocated: sql<string>`coalesce((select sum(a.amount) from receipt_allocations a where a.invoice_id = "invoices"."id" and a.cancelled_at is null),0)` })
    .from(invoices)
    .where(and(eq(invoices.contractId, inv.contractId), inArray(invoices.status, COUNTED), sql`${invoices.id} <> ${invoiceId}`, isNull(invoices.deletedAt)));
  const priorInvoices = prior.map((p) => ({ subtotalBase: Number(p.subtotalBase) * (p.kind === "credit" ? -1 : 1), total: Number(p.total), allocated: Number(p.allocated) }));

  // opening balances of milestones included
  const msIds = lines.map((l) => l.milestoneId).filter((x): x is string => Boolean(x));
  let openingBilled = 0;
  let openingPaid = 0;
  if (msIds.length) {
    const ms = await tx.select().from(milestones).where(inArray(milestones.id, msIds));
    for (const m of ms) {
      const l = lines.find((x) => x.milestoneId === m.id)!;
      openingBilled += (Number(l.stageAmount ?? 0) * Number(m.openingBilledPct)) / 100;
      openingPaid += Number(m.openingPaidAmount);
    }
  }

  // index linkage
  const scIds = [...new Set(lines.map((l) => l.subContractId))];
  const scRows = scIds.length ? await tx.select({ id: subContracts.id, indexLinked: subContracts.indexLinked, indexFloor: subContracts.indexFloor, base: subContracts.indexBaseMonth }).from(subContracts).where(inArray(subContracts.id, scIds)) : [];
  const indexLinked = contract?.indexLinked || scRows.some((s) => s.indexLinked);
  const indexFloor = contract?.indexFloor || scRows.some((s) => s.indexFloor);
  const baseMonth = scRows.find((s) => s.base)?.base ?? contract?.indexBaseMonth ?? null;
  const values = (await tx.select({ month: indexValues.month, value: indexValues.value }).from(indexValues)).map((v) => ({ month: v.month, value: Number(v.value) }));
  const indexMonth = indexLinked ? resolveInvoiceIndexMonth(values, inv.invoiceDate, indexSettings.invoice_month_rule, overrides.indexMonth === undefined ? inv.indexMonth : overrides.indexMonth) : null;
  const baseValue = baseMonth ? findIndexValue(values, baseMonth) : null;
  const currentValue = indexMonth ? findIndexValue(values, indexMonth) : null;
  const ratio = computeIndexRatio({ indexLinked, indexFloor, baseValue, currentValue });

  // VAT
  const vatRows = (await tx.select().from(vatRates)).map((v) => ({ rate: Number(v.rate), effectiveFrom: v.effectiveFrom }));
  const vatExempt = overrides.vatExempt ?? (inv.vatExemptReason ? inv.vatExempt : (client?.vatExempt ?? false));
  const vatRate = overrides.vatRate ?? (inv.vatOverrideReason ? Number(inv.vatRate) : (vatRateFor(vatRows, inv.invoiceDate) ?? 0));
  const withholding = client?.withholdingTaxPct && (!client.withholdingValidUntil || client.withholdingValidUntil >= inv.invoiceDate) ? Number(client.withholdingTaxPct) : null;

  const summary = computeInvoiceSummary({
    cumulativeBase,
    sumAmountThis: sumAmountThis * sign,
    openingBilled: money(openingBilled),
    openingPaid: money(openingPaid),
    priorInvoices,
    indexRatio: ratio.ratio,
    retentionPct: inv.retentionPct === null ? num(contract?.retentionPct) : Number(inv.retentionPct),
    vatRate,
    vatExempt,
    withholdingPct: settings.show_withholding ? withholding : null,
  });
  const terms = client?.paymentTermsDays ?? settings.default_payment_terms_days;
  await tx
    .update(invoices)
    .set({
      indexLinked,
      indexFloor,
      indexBaseMonth: baseMonth,
      indexBaseValue: baseValue?.toFixed(4) ?? null,
      indexMonth,
      indexCurrentValue: currentValue?.toFixed(4) ?? null,
      indexRatio: ratio.ratio.toFixed(6),
      cumulativeBase: summary.cumulativeBase.toFixed(2),
      receiptsBase: summary.receiptsBase.toFixed(2),
      openBase: summary.openBase.toFixed(2),
      subtotalBase: summary.subtotalBase.toFixed(2),
      indexDiff: summary.indexDiff.toFixed(2),
      retentionPct: summary.retentionPct ? summary.retentionPct.toFixed(2) : null,
      retentionAmount: summary.retentionAmount.toFixed(2),
      beforeVat: summary.beforeVat.toFixed(2),
      vatRate: vatRate.toFixed(2),
      vatExempt,
      vatAmount: summary.vatAmount.toFixed(2),
      total: summary.total.toFixed(2),
      withholdingPct: summary.withholdingPct?.toFixed(2) ?? null,
      expectedReceipt: summary.expectedReceipt?.toFixed(2) ?? null,
      dueDate: calcDueDate(inv.invoiceDate, terms),
    })
    .where(eq(invoices.id, invoiceId));
  return { summary, missingIndex: ratio.missingValue, consistencyWarning: summary.consistencyWarning };
}

function num(v: string | null | undefined): number | null {
  return v === null || v === undefined ? null : Number(v);
}
