/**
 * Invoice summary block (spec §11.7 – "חשבון עסקה 16835" structure).
 */
import { dec, money, applyPct } from "./money";
import { indexDifference } from "./index-linkage";
import { computeVat, expectedReceipt } from "./vat";

export interface PriorInvoiceForSummary {
  /** subtotal_base of the prior counted invoice (credits negative) */
  subtotalBase: number;
  /** invoice.total */
  total: number;
  /** Σ allocations from receipts */
  allocated: number;
}

export interface InvoiceSummaryInput {
  /** Σ cumulative_amount of all lines in this invoice (milestone lines) + Σ amount_this of non-milestone lines across all invoices incl. this one */
  cumulativeBase: number;
  /** Σ amount_this of this invoice's lines (all types) – used for the consistency check */
  sumAmountThis: number;
  /** Σ opening_billed of the milestones included in this invoice (base) */
  openingBilled: number;
  /** Σ opening_paid_amount of the milestones included in this invoice */
  openingPaid: number;
  priorInvoices: readonly PriorInvoiceForSummary[];
  indexRatio: number;
  retentionPct?: number | null;
  vatRate: number;
  vatExempt?: boolean;
  withholdingPct?: number | null;
}

export interface InvoiceSummary {
  cumulativeBase: number;
  receiptsBase: number;
  openBase: number;
  subtotalBase: number;
  /** subtotal_base − Σ amount_this ; |diff| > 0.01 → warning to the approver */
  consistencyDiff: number;
  consistencyWarning: boolean;
  indexRatio: number;
  indexDiff: number;
  gross: number;
  retentionPct: number;
  retentionAmount: number;
  beforeVat: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  withholdingPct: number | null;
  expectedReceipt: number | null;
}

/** prior allocations converted to base prices: allocated × subtotal_base / total */
export function priorReceiptsBase(prior: readonly PriorInvoiceForSummary[]): number {
  let acc = dec(0);
  for (const p of prior) {
    if (dec(p.total).isZero()) continue;
    acc = acc.plus(dec(p.allocated).times(p.subtotalBase).div(p.total));
  }
  return money(acc);
}

export function computeInvoiceSummary(i: InvoiceSummaryInput): InvoiceSummary {
  const receiptsBase = money(dec(priorReceiptsBase(i.priorInvoices)).plus(i.openingPaid));
  // prior billing in base = opening billed + Σ prior subtotal_base; open = prior billing − receipts
  const priorBilled = money(dec(i.openingBilled).plus(i.priorInvoices.reduce((a, p) => a.plus(p.subtotalBase), dec(0))));
  const openBase = money(dec(priorBilled).minus(receiptsBase));
  const subtotalBase = money(dec(i.cumulativeBase).minus(receiptsBase).minus(openBase));
  const consistencyDiff = money(dec(subtotalBase).minus(i.sumAmountThis));
  const indexDiff = indexDifference(subtotalBase, i.indexRatio);
  const gross = money(dec(subtotalBase).plus(indexDiff));
  const retentionPct = i.retentionPct ?? 0;
  const retentionAmount = applyPct(gross, retentionPct);
  const beforeVat = money(dec(gross).minus(retentionAmount));
  const vat = computeVat({ beforeVat, vatRate: i.vatRate, vatExempt: i.vatExempt ?? false });
  const withholdingPct = i.withholdingPct ?? null;
  return {
    cumulativeBase: money(i.cumulativeBase),
    receiptsBase,
    openBase,
    subtotalBase,
    consistencyDiff,
    consistencyWarning: Math.abs(consistencyDiff) > 0.01,
    indexRatio: i.indexRatio,
    indexDiff,
    gross,
    retentionPct,
    retentionAmount,
    beforeVat,
    vatRate: vat.vatRate,
    vatAmount: vat.vatAmount,
    total: vat.total,
    withholdingPct,
    expectedReceipt: withholdingPct ? expectedReceipt(vat.total, beforeVat, withholdingPct) : null,
  };
}

/** due_date = invoice_date + payment_terms_days */
export function dueDate(invoiceDate: string, paymentTermsDays: number): string {
  const d = new Date(`${invoiceDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + paymentTermsDays);
  return d.toISOString().slice(0, 10);
}

/** Payment status derived from allocations. */
export function paymentStatus(total: number, allocated: number): "unpaid" | "partially_paid" | "paid" {
  if (allocated <= 0) return "unpaid";
  return allocated >= total ? "paid" : "partially_paid";
}

/** Aging bucket by days overdue. */
export function agingBucket(daysOverdue: number, thresholds: readonly number[] = [30, 60, 90]): string {
  if (daysOverdue <= 0) return "current";
  const sorted = [...thresholds].sort((a, b) => a - b);
  let prev = 0;
  for (const t of sorted) {
    if (daysOverdue <= t) return `${prev + 1}-${t}`;
    prev = t;
  }
  return `${prev}+`;
}

export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}
