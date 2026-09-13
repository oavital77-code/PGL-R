/**
 * Milestone (אבן דרך) amounts and invoice milestone lines (spec §8.3, §11.5).
 */
import { applyDiscount, applyPct, dec, money, pct, pctOf, sumMoney, sumPct } from "./money";

export interface MilestoneDefinition {
  id: string;
  name: string;
  /** % of the sub-contract base (numeric(6,3)) */
  pctOfSubcontract: number;
  /** discount override; null → sub-contract discount */
  discountPct?: number | null;
  /** opening balance: % already billed before the system */
  openingBilledPct?: number | null;
  /** opening balance: amount already paid before the system (base prices) */
  openingPaidAmount?: number | null;
  expectedDate?: string | null;
}

export interface MilestoneAmounts {
  /** base × pct/100 (before discount) */
  amount: number;
  /** amount × (1 − discount/100) */
  total: number;
  discountPct: number;
}

/**
 * amount = base × pct/100 ; total = amount × (1 − discount/100)
 * `base` is the sub-contract base_price (fixed_price) or fee (pct_of_cost).
 */
export function milestoneAmounts(base: number, m: MilestoneDefinition, subcontractDiscountPct: number): MilestoneAmounts {
  const discountPct = m.discountPct ?? subcontractDiscountPct;
  const amount = applyPct(base, m.pctOfSubcontract);
  const total = applyDiscount(amount, discountPct);
  return { amount, total, discountPct };
}

export interface MilestoneTotalsRow {
  sumPct: number;
  sumAmount: number;
  sumTotal: number;
  /** true when Σ pct == 100 (green); false → orange warning, never blocking */
  isComplete: boolean;
}

export function milestoneTotals(rows: readonly { pctOfSubcontract: number; amount: number; total: number }[]): MilestoneTotalsRow {
  const sPct = sumPct(rows.map((r) => r.pctOfSubcontract));
  return {
    sumPct: sPct,
    sumAmount: sumMoney(rows.map((r) => r.amount)),
    sumTotal: sumMoney(rows.map((r) => r.total)),
    isComplete: sPct === 100,
  };
}

/* ------------------------------------------------------------------ */
/* Invoice milestone lines                                             */
/* ------------------------------------------------------------------ */

export interface PriorBilling {
  /** Σ progress_pct_this of prior invoices with status ≥ approved (credits negative) */
  priorProgressPct: number;
}

export interface MilestoneLineInput {
  milestoneId: string;
  /** milestone.total (after discount) */
  stageAmount: number;
  /** milestone.pct_of_subcontract – informative on the PDF */
  stagePct: number;
  openingBilledPct: number;
  priorProgressPct: number;
  /** requested progress in this invoice (may be negative in a credit invoice) */
  progressPctThis: number;
}

export interface MilestoneLine {
  milestoneId: string;
  stagePct: number;
  stageAmount: number;
  prevCumulativePct: number;
  maxThis: number;
  progressPctThis: number;
  cumulativePct: number;
  amountThis: number;
  cumulativeAmount: number;
}

export class MilestoneProgressError extends Error {
  constructor(
    public readonly code: "OVER_100" | "BELOW_0",
    public readonly milestoneId: string,
    public readonly cumulativePct: number,
  ) {
    super(`milestone ${milestoneId}: cumulative ${cumulativePct}% ${code === "OVER_100" ? "exceeds 100%" : "is below 0%"}`);
    this.name = "MilestoneProgressError";
  }
}

/**
 * prev_cum_pct   = opening_billed_pct + Σ progress_pct_this (prior, ≥ approved)
 * max_this       = 100 − prev_cum_pct
 * amount_this    = round(stage_amount × progress_pct_this / 100, 2)
 * cumulative_pct = prev_cum_pct + progress_pct_this   (must be within [0,100])
 * cumulative_amount = round(stage_amount × cumulative_pct / 100, 2)
 */
export function computeMilestoneLine(input: MilestoneLineInput): MilestoneLine {
  const prev = pct(dec(input.openingBilledPct).plus(input.priorProgressPct));
  const maxThis = pct(dec(100).minus(prev));
  const progress = pct(input.progressPctThis);
  const cumulativePct = pct(dec(prev).plus(progress));
  if (cumulativePct > 100) throw new MilestoneProgressError("OVER_100", input.milestoneId, cumulativePct);
  if (cumulativePct < 0) throw new MilestoneProgressError("BELOW_0", input.milestoneId, cumulativePct);
  return {
    milestoneId: input.milestoneId,
    stagePct: input.stagePct,
    stageAmount: money(input.stageAmount),
    prevCumulativePct: prev,
    maxThis,
    progressPctThis: progress,
    cumulativePct,
    amountThis: applyPct(input.stageAmount, progress),
    cumulativeAmount: applyPct(input.stageAmount, cumulativePct),
  };
}

/** Given a desired *new cumulative* %, derive progress_pct_this. */
export function progressFromCumulative(openingBilledPct: number, priorProgressPct: number, newCumulativePct: number): number {
  return pct(dec(newCumulativePct).minus(openingBilledPct).minus(priorProgressPct));
}

export interface SubcontractLinesTotals {
  sumStagePct: number;
  sumStageAmount: number;
  /** Σ amount_this / Σ stage_amount × 100 */
  progressPctThisInvoice: number | null;
  /** Σ cumulative_amount / Σ stage_amount × 100 */
  cumulativePct: number | null;
  sumAmountThis: number;
  sumCumulativeAmount: number;
}

export function subcontractLinesTotals(lines: readonly MilestoneLine[]): SubcontractLinesTotals {
  const sumStageAmount = sumMoney(lines.map((l) => l.stageAmount));
  const sumAmountThis = sumMoney(lines.map((l) => l.amountThis));
  const sumCumulativeAmount = sumMoney(lines.map((l) => l.cumulativeAmount));
  return {
    sumStagePct: sumPct(lines.map((l) => l.stagePct)),
    sumStageAmount,
    progressPctThisInvoice: pctOf(sumAmountThis, sumStageAmount),
    cumulativePct: pctOf(sumCumulativeAmount, sumStageAmount),
    sumAmountThis,
    sumCumulativeAmount,
  };
}
