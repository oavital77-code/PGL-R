/**
 * Hours period locking (spec §10.7): entries of month M are editable until 23:59 on
 * the last day of month M+1 (Asia/Jerusalem). Admin unlocks are explicit rows.
 */
export interface PeriodUnlock {
  userId: string;
  /** yyyy-mm-01 */
  month: string;
  /** ISO timestamp */
  unlockedUntil: string;
}

export type LockRule = "end_of_next_month" | "end_of_month" | "never";

export function monthOf(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function addMonths(month: string, n: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** First day (yyyy-mm-dd) after which the given month is locked. */
export function lockStartDate(month: string, rule: LockRule = "end_of_next_month"): string | null {
  if (rule === "never") return null;
  return rule === "end_of_next_month" ? addMonths(month, 2) : addMonths(month, 1);
}

/**
 * `todayLocal` is the current date in Asia/Jerusalem as yyyy-mm-dd; `nowIso` is the
 * current instant (for unlock expiry).
 */
export function isPeriodLocked(
  workDate: string,
  todayLocal: string,
  opts: { rule?: LockRule; userId?: string; unlocks?: readonly PeriodUnlock[]; nowIso?: string } = {},
): boolean {
  const month = monthOf(workDate);
  const lockFrom = lockStartDate(month, opts.rule ?? "end_of_next_month");
  if (lockFrom === null || todayLocal < lockFrom) return false;
  const now = opts.nowIso ?? new Date().toISOString();
  const unlocked = (opts.unlocks ?? []).some((u) => u.month === month && u.userId === opts.userId && u.unlockedUntil > now);
  return !unlocked;
}

export function isFutureDate(workDate: string, todayLocal: string): boolean {
  return workDate > todayLocal;
}
