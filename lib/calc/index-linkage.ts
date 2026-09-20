/**
 * Consumer Price Index linkage (spec §11.7).
 */
import { dec, money, ratio6 } from "./money";

/** Month key is always the first day of the month as ISO date: yyyy-mm-01 */
export type MonthKey = string;

export interface IndexValue {
  month: MonthKey;
  value: number;
}

export function toMonthKey(date: string): MonthKey {
  return `${date.slice(0, 7)}-01`;
}

/**
 * The index a contract signed on `signedDate` is anchored to (customer decision 19/09/2026):
 * the last CPI already published on that day. The CBS publishes month M on the 15th of M+1,
 * so a contract signed on or after the 15th anchors to the previous month, and one signed
 * earlier to the month before that. Anchoring to the signing month itself, as the spec did,
 * left every new contract without a base value until the middle of the next month.
 */
export function lastPublishedIndexMonth(signedDate: string): MonthKey {
  const month = toMonthKey(signedDate);
  const day = Number(signedDate.slice(8, 10));
  return day >= 15 ? previousMonth(month) : previousMonth(previousMonth(month));
}

export function previousMonth(month: MonthKey): MonthKey {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function findIndexValue(values: readonly IndexValue[], month: MonthKey): number | null {
  const v = values.find((x) => x.month === month);
  return v ? v.value : null;
}

export type InvoiceMonthRule = "latest_known" | "previous_month";

/**
 * Decide which index month applies to an invoice.
 * - latest_known: the latest month present in `values` whose month ≤ invoice month.
 * - previous_month: the calendar month preceding the invoice date's month.
 * Returns null when nothing qualifies.
 */
export function resolveInvoiceIndexMonth(
  values: readonly IndexValue[],
  invoiceDate: string,
  rule: InvoiceMonthRule,
  override?: MonthKey | null,
): MonthKey | null {
  if (override) return override;
  const invMonth = toMonthKey(invoiceDate);
  if (rule === "previous_month") return previousMonth(invMonth);
  let best: MonthKey | null = null;
  for (const v of values) {
    if (v.month <= invMonth && (best === null || v.month > best)) best = v.month;
  }
  return best;
}

export interface LinkageInput {
  indexLinked: boolean;
  indexFloor: boolean;
  baseValue?: number | null;
  currentValue?: number | null;
}

export interface LinkageResult {
  ratio: number;
  /** true when linkage is requested but a value is missing → invoice cannot be approved */
  missingValue: boolean;
  floored: boolean;
}

/**
 * ratio = current / base; floor to 1 when index_floor and ratio < 1; 1 when not linked.
 */
export function computeIndexRatio({ indexLinked, indexFloor, baseValue, currentValue }: LinkageInput): LinkageResult {
  if (!indexLinked) return { ratio: 1, missingValue: false, floored: false };
  if (!baseValue || !currentValue || baseValue <= 0 || currentValue <= 0) {
    return { ratio: 1, missingValue: true, floored: false };
  }
  let ratio = ratio6(dec(currentValue).div(baseValue));
  let floored = false;
  if (indexFloor && ratio < 1) {
    ratio = 1;
    floored = true;
  }
  return { ratio, missingValue: false, floored };
}

/** index_diff = round(subtotal_base × (ratio − 1), 2) */
export function indexDifference(subtotalBase: number, ratio: number): number {
  return money(dec(subtotalBase).times(dec(ratio).minus(1)));
}
