/** Next run time for a report schedule (spec §12.6). Hours are Asia/Jerusalem. */
export function computeNextRun(s: { frequency: "daily" | "weekly" | "monthly"; dayOfWeek?: number | null; dayOfMonth?: number | null; hour: number }, from = new Date()): Date {
  const d = new Date(from);
  d.setUTCMinutes(0, 0, 0);
  const localHourUtc = (s.hour - 3 + 24) % 24; // IL summer offset; winter runs one hour early (see DEVIATIONS)
  d.setUTCHours(localHourUtc);
  if (d <= from) d.setUTCDate(d.getUTCDate() + 1);
  if (s.frequency === "weekly") while (d.getUTCDay() !== (s.dayOfWeek ?? 0)) d.setUTCDate(d.getUTCDate() + 1);
  if (s.frequency === "monthly") while (d.getUTCDate() !== (s.dayOfMonth ?? 1)) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

