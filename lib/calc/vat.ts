/**
 * VAT calculation (spec §11.7).
 */
import { applyPct, money, dec } from "./money";

export interface VatRate {
  /** Percent, e.g. 18 */
  rate: number;
  /** ISO date (yyyy-mm-dd) from which the rate applies (inclusive). */
  effectiveFrom: string;
}

/**
 * Pick the VAT rate in effect for a given date: the row with the latest
 * effectiveFrom ≤ date. Returns null when no rate applies.
 */
export function vatRateFor(rates: readonly VatRate[], date: string): number | null {
  let best: VatRate | null = null;
  for (const r of rates) {
    if (r.effectiveFrom <= date && (best === null || r.effectiveFrom > best.effectiveFrom)) best = r;
  }
  return best ? best.rate : null;
}

export interface VatInput {
  beforeVat: number;
  vatRate: number;
  vatExempt?: boolean;
}

export interface VatResult {
  beforeVat: number;
  vatRate: number;
  vatAmount: number;
  total: number;
}

export function computeVat({ beforeVat, vatRate, vatExempt = false }: VatInput): VatResult {
  const vatAmount = vatExempt ? 0 : applyPct(beforeVat, vatRate);
  return {
    beforeVat: money(beforeVat),
    vatRate: vatExempt ? 0 : vatRate,
    vatAmount,
    total: money(dec(beforeVat).plus(vatAmount)),
  };
}

/**
 * Withholding tax at source (ניכוי מס במקור) – informative only.
 * expected_receipt = total − round(before_vat × pct/100, 2)
 */
export function expectedReceipt(total: number, beforeVat: number, withholdingPct: number | null | undefined): number {
  if (!withholdingPct) return money(total);
  return money(dec(total).minus(applyPct(beforeVat, withholdingPct)));
}
