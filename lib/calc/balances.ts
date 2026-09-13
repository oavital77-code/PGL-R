/**
 * Balance engine (spec §9). All amounts are "base prices" (before index linkage, before VAT).
 * Invoices in draft / pending_approval / cancelled are NOT counted. Credit invoices count negative.
 */
import { dec, money, pctOf, sumMoney } from "./money";

export type InvoiceStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "signed"
  | "sent"
  | "partially_paid"
  | "paid"
  | "cancelled";
export type InvoiceKind = "proforma" | "credit";

const COUNTED: ReadonlySet<InvoiceStatus> = new Set(["approved", "signed", "sent", "partially_paid", "paid"]);

export function isCountedStatus(status: InvoiceStatus): boolean {
  return COUNTED.has(status);
}

/** Sign multiplier: proforma +1, credit −1 */
export function kindSign(kind: InvoiceKind): 1 | -1 {
  return kind === "credit" ? -1 : 1;
}

export interface BalanceMilestone {
  total: number;
  openingBilledPct?: number | null;
  openingPaidAmount?: number | null;
}

export interface BalanceInvoiceLine {
  invoiceId: string;
  invoiceStatus: InvoiceStatus;
  invoiceKind: InvoiceKind;
  /** amount_this of the line (base prices). For credit invoices the stored amount is already negative OR positive – we normalise using kind sign when `amountIsSigned` is false. */
  amountThis: number;
}

export interface BalanceInvoiceRef {
  invoiceId: string;
  status: InvoiceStatus;
  kind: InvoiceKind;
  /** invoice.subtotal_base (base prices, this invoice only) */
  subtotalBase: number;
  /** invoice.total (incl. index diff, retention, VAT) */
  total: number;
  /** Σ receipt_allocations.amount for this invoice */
  allocated: number;
  /** share of this sub-contract in the invoice's subtotal_base (Σ its lines' amount_this). When omitted, the whole invoice is attributed. */
  subcontractShareBase?: number;
}

export interface SubContractBalanceInput {
  /** null when the pricing method is open-ended (no ceiling) */
  totalAmount: number | null;
  milestones: readonly BalanceMilestone[];
  lines: readonly BalanceInvoiceLine[];
  invoices: readonly BalanceInvoiceRef[];
  /** set true when credit lines are stored with negative amounts already */
  amountIsSigned?: boolean;
}

export interface Balances {
  totalAmount: number | null;
  openingBilled: number;
  openingPaid: number;
  submitted: number;
  paid: number;
  openBalance: number;
  remaining: number | null;
  progressPct: number | null;
}

/** opening_billed = Σ total × opening_billed_pct/100 */
export function openingBilled(milestones: readonly BalanceMilestone[]): number {
  let acc = dec(0);
  for (const m of milestones) acc = acc.plus(dec(m.total).times(dec(m.openingBilledPct)).div(100));
  return money(acc);
}

export function openingPaid(milestones: readonly BalanceMilestone[]): number {
  return sumMoney(milestones.map((m) => m.openingPaidAmount));
}

/** Σ amount_this of counted invoice lines, credits negative. */
export function submittedFromLines(lines: readonly BalanceInvoiceLine[], amountIsSigned = false): number {
  let acc = dec(0);
  for (const l of lines) {
    if (!isCountedStatus(l.invoiceStatus)) continue;
    const sign = amountIsSigned ? 1 : kindSign(l.invoiceKind);
    acc = acc.plus(dec(l.amountThis).times(sign));
  }
  return money(acc);
}

/**
 * Convert a receipt allocation back to base prices:
 * allocated × subtotal_base / total. When a sub-contract share is given, the
 * allocation is apportioned by the sub-contract's share of the invoice's base.
 */
export function allocationToBase(inv: BalanceInvoiceRef): number {
  if (!isCountedStatus(inv.status)) return 0;
  const total = dec(inv.total);
  if (total.isZero()) return 0;
  const shareBase = inv.subcontractShareBase === undefined ? inv.subtotalBase : inv.subcontractShareBase;
  // allocated × (shareBase / total)
  return money(dec(inv.allocated).times(shareBase).div(total).times(kindSign(inv.kind)));
}

export function paidFromInvoices(invoices: readonly BalanceInvoiceRef[]): number {
  return sumMoney(invoices.map(allocationToBase));
}

export function computeSubContractBalances(input: SubContractBalanceInput): Balances {
  const ob = openingBilled(input.milestones);
  const op = openingPaid(input.milestones);
  const submitted = money(dec(ob).plus(submittedFromLines(input.lines, input.amountIsSigned)));
  const paid = money(dec(op).plus(paidFromInvoices(input.invoices)));
  const openBalance = money(dec(submitted).minus(paid));
  const total = input.totalAmount;
  const remaining = total === null ? null : money(dec(total).minus(submitted));
  const progressPct = total === null || total === 0 ? null : pctOf(submitted, total);
  return { totalAmount: total, openingBilled: ob, openingPaid: op, submitted, paid, openBalance, remaining, progressPct };
}

/** Aggregate balances of several sub-contracts (contract / project / client level). */
export function aggregateBalances(items: readonly Balances[]): Balances {
  const anyOpen = items.some((b) => b.totalAmount === null);
  const allOpen = items.length > 0 && items.every((b) => b.totalAmount === null);
  const closedTotal = sumMoney(items.map((b) => b.totalAmount));
  const totalAmount = allOpen ? null : closedTotal;
  const submitted = sumMoney(items.map((b) => b.submitted));
  const paid = sumMoney(items.map((b) => b.paid));
  const remaining = anyOpen ? null : money(dec(closedTotal).minus(submitted));
  return {
    totalAmount,
    openingBilled: sumMoney(items.map((b) => b.openingBilled)),
    openingPaid: sumMoney(items.map((b) => b.openingPaid)),
    submitted,
    paid,
    openBalance: money(dec(submitted).minus(paid)),
    remaining,
    progressPct: anyOpen || !totalAmount ? null : pctOf(submitted, totalAmount),
  };
}

/* ------------------------------ hours & costs ------------------------------ */

export interface CostRate {
  effectiveFrom: string; // yyyy-mm-dd
  hourlyCost: number;
}

/** Cost rate in effect at `date`: latest effective_from ≤ date. */
export function rateFor<T extends { effectiveFrom: string }>(rates: readonly T[], date: string): T | null {
  let best: T | null = null;
  for (const r of rates) {
    if (r.effectiveFrom <= date && (best === null || r.effectiveFrom > best.effectiveFrom)) best = r;
  }
  return best;
}

export interface TimeEntryLike {
  userId: string;
  workDate: string;
  minutes: number;
}

export function hoursTotal(entries: readonly TimeEntryLike[]): number {
  let acc = dec(0);
  for (const e of entries) acc = acc.plus(dec(e.minutes).div(60));
  return money(acc);
}

/** Σ (minutes/60 × hourly cost of the employee in effect at work_date) */
export function hoursCost(entries: readonly TimeEntryLike[], ratesByUser: ReadonlyMap<string, readonly CostRate[]>): number {
  let acc = dec(0);
  for (const e of entries) {
    const r = rateFor(ratesByUser.get(e.userId) ?? [], e.workDate);
    if (!r) continue;
    acc = acc.plus(dec(e.minutes).div(60).times(r.hourlyCost));
  }
  return money(acc);
}

export function hoursByMonth(entries: readonly TimeEntryLike[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) {
    const key = e.workDate.slice(0, 7);
    out.set(key, money(dec(out.get(key) ?? 0).plus(dec(e.minutes).div(60))));
  }
  return out;
}
