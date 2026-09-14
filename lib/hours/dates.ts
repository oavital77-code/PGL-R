/** Pure date helpers for the timesheet (yyyy-mm-dd strings, Sunday-first weeks). */
export function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function weekStartOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return shiftDays(iso, -d.getUTCDay());
}
export function monthStartOf(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}
export function monthEndOf(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
export function addMonths(iso: string, n: number): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}
export function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}
export function daysBetweenInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = shiftDays(d, 1)) out.push(d);
  return out;
}
