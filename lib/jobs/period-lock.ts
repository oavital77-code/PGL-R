import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { subContractAssignments, timeEntries, users } from "@/lib/db/schema";
import { lockStartDate, monthOf } from "@/lib/calc/period-lock";
import { previousMonth } from "@/lib/calc/index-linkage";
import { todayLocal } from "@/lib/i18n/format";
import { adminUserIds } from "@/lib/notifications/service";
import { notifyEvent } from "@/lib/email/notify-email";
import { getSetting } from "@/lib/settings/service";
import { workDaysBetween } from "@/lib/hours/summary";

/**
 * Locking is computed, not stored (spec §10.7). On the first day a month becomes locked,
 * send admins a summary of employees with missing reports for that month.
 */
export async function periodLockJob() {
  const today = todayLocal();
  const hours = await getSetting("hours");
  // which month became locked today?
  let locked: string | null = null;
  for (let m = monthOf(today), i = 0; i < 4; i++, m = previousMonth(m)) {
    if (lockStartDate(m, hours.lock_rule) === today) locked = m;
  }
  if (!locked) return { skipped: "no_month_locked_today" };
  const monthEnd = previousMonth(lockStartDate(locked, "end_of_month")!); // = locked month itself
  void monthEnd;
  const lastDay = new Date(Date.UTC(Number(locked.slice(0, 4)), Number(locked.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const emps = await db
    .select({ id: users.id, name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`, workDays: users.workDays, start: users.employmentStart })
    .from(users)
    .where(and(eq(users.isActive, true), isNull(users.deletedAt)));
  const assigned = new Set((await db.select({ u: subContractAssignments.userId }).from(subContractAssignments).where(eq(subContractAssignments.isActive, true))).map((a) => a.u));
  const reported = await db
    .select({ userId: timeEntries.userId, d: timeEntries.workDate })
    .from(timeEntries)
    .where(and(isNull(timeEntries.deletedAt), inArray(timeEntries.userId, emps.map((e) => e.id)), sql`${timeEntries.workDate} between ${locked} and ${lastDay}`))
    .groupBy(timeEntries.userId, timeEntries.workDate);
  const byUser = new Map<string, Set<string>>();
  for (const r of reported) (byUser.get(r.userId) ?? byUser.set(r.userId, new Set()).get(r.userId)!).add(r.d);
  const missing: { name: string; days: number }[] = [];
  for (const e of emps) {
    if (!assigned.has(e.id)) continue;
    const from = e.start && e.start > locked ? e.start : locked;
    const wd = workDaysBetween(from, lastDay, e.workDays ?? hours.default_work_days);
    const have = byUser.get(e.id) ?? new Set();
    const miss = wd.filter((d) => !have.has(d)).length;
    if (miss > 0) missing.push({ name: e.name, days: miss });
  }
  const admins = await adminUserIds();
  const label = `${locked.slice(5, 7)}/${locked.slice(0, 4)}`;
  await notifyEvent({
    userIds: admins,
    type: "hours.month_locked",
    title: `חודש ${label} ננעל לדיווח שעות`,
    body: missing.length ? `${missing.length} עובדים עם דיווח חסר: ${missing.map((m) => `${m.name} (${m.days})`).join(", ")}` : "כל העובדים דיווחו במלואם",
    link: "/reports?report=hours.missing",
    dedupeKey: `hours.month_locked:${locked}`,
  });
  return { locked, missing: missing.length };
}
