import "server-only";
import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { departments, projects, subContracts, contracts, timeEntries, users, subContractAssignments } from "@/lib/db/schema";
import { todayLocal } from "@/lib/i18n/format";
import { getSetting } from "@/lib/settings/service";

function startOfWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // Sunday
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dayOfWeek(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

export function workDaysBetween(from: string, to: string, workDays: readonly number[]): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (workDays.includes(dayOfWeek(d))) out.push(d);
  return out;
}

async function userStandard(userId: string) {
  const [u] = await db.select({ std: users.standardHoursPerDay, workDays: users.workDays, start: users.employmentStart }).from(users).where(eq(users.id, userId));
  const hours = await getSetting("hours");
  return {
    stdMinutes: Math.round(Number(u?.std ?? hours.default_standard_hours_per_day) * 60),
    workDays: u?.workDays ?? hours.default_work_days,
    employmentStart: u?.start ?? null,
  };
}

async function byProject(where: ReturnType<typeof and>) {
  const rows = await db
    .select({ name: sql<string>`${projects.workNumber} || ' – ' || ${projects.name}`, minutes: sql<number>`sum(${timeEntries.minutes})` })
    .from(timeEntries)
    .innerJoin(subContracts, eq(subContracts.id, timeEntries.subContractId))
    .innerJoin(contracts, eq(contracts.id, subContracts.contractId))
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .where(where)
    .groupBy(projects.id, projects.workNumber, projects.name)
    .orderBy(sql`sum(${timeEntries.minutes}) desc`)
    .limit(8);
  return rows.map((r) => ({ name: r.name, hours: Math.round((Number(r.minutes) / 60) * 100) / 100 }));
}

export async function employeeHoursSummary(userId: string) {
  const today = todayLocal();
  const weekStart = startOfWeek(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const { stdMinutes, workDays, employmentStart } = await userStandard(userId);
  const [week] = await db
    .select({ m: sql<number>`coalesce(sum(${timeEntries.minutes}),0)` })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.deletedAt), gte(timeEntries.workDate, weekStart), lte(timeEntries.workDate, today)));
  const [month] = await db
    .select({ m: sql<number>`coalesce(sum(${timeEntries.minutes}),0)` })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.deletedAt), gte(timeEntries.workDate, monthStart), lte(timeEntries.workDate, today)));
  const days = await db
    .select({ d: timeEntries.workDate })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.deletedAt), gte(timeEntries.workDate, monthStart), lte(timeEntries.workDate, today)))
    .groupBy(timeEntries.workDate);
  const reported = new Set(days.map((d) => d.d));
  const from = employmentStart && employmentStart > monthStart ? employmentStart : monthStart;
  const missingDays = workDaysBetween(from, addDays(today, -1), workDays).filter((d) => !reported.has(d));
  return {
    weekMinutes: Number(week?.m ?? 0),
    weekStandardMinutes: workDaysBetween(weekStart, today, workDays).length * stdMinutes,
    monthMinutes: Number(month?.m ?? 0),
    monthStandardMinutes: workDaysBetween(from, today, workDays).length * stdMinutes,
    missingDays,
    byProject: await byProject(and(eq(timeEntries.userId, userId), isNull(timeEntries.deletedAt), gte(timeEntries.workDate, monthStart))),
  };
}

export async function departmentHoursSummary(departmentId: string | null) {
  const today = todayLocal();
  const monthStart = `${today.slice(0, 7)}-01`;
  const hours = await getSetting("hours");
  const emps = await db
    .select({ id: users.id, name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`, std: users.standardHoursPerDay, workDays: users.workDays })
    .from(users)
    .where(and(eq(users.isActive, true), isNull(users.deletedAt), departmentId ? eq(users.departmentId, departmentId) : undefined));
  const ids = emps.map((e) => e.id);
  if (ids.length === 0) return { monthMinutes: 0, monthStandardMinutes: 0, behind: [], reportedCount: 0, employeeCount: 0, byProject: [] };
  const assigned = await db.select({ userId: subContractAssignments.userId }).from(subContractAssignments).where(and(inArray(subContractAssignments.userId, ids), eq(subContractAssignments.isActive, true))).groupBy(subContractAssignments.userId);
  const assignedSet = new Set(assigned.map((a) => a.userId));
  const [month] = await db
    .select({ m: sql<number>`coalesce(sum(${timeEntries.minutes}),0)` })
    .from(timeEntries)
    .where(and(inArray(timeEntries.userId, ids), isNull(timeEntries.deletedAt), gte(timeEntries.workDate, monthStart), lte(timeEntries.workDate, today)));
  const last = await db
    .select({ userId: timeEntries.userId, last: sql<string>`max(${timeEntries.workDate})` })
    .from(timeEntries)
    .where(and(inArray(timeEntries.userId, ids), isNull(timeEntries.deletedAt)))
    .groupBy(timeEntries.userId);
  const lastMap = new Map(last.map((l) => [l.userId, l.last]));
  const behind: { userId: string; name: string; lastDate: string | null; daysBehind: number }[] = [];
  let reportedCount = 0;
  let stdTotal = 0;
  for (const e of emps) {
    if (!assignedSet.has(e.id)) continue;
    const l = lastMap.get(e.id) ?? null;
    const days = l ? Math.round((Date.parse(today) - Date.parse(l)) / 86_400_000) : 999;
    if (l && l >= monthStart) reportedCount++;
    if (days > hours.reminder_days) behind.push({ userId: e.id, name: e.name, lastDate: l, daysBehind: days });
    stdTotal += workDaysBetween(monthStart, today, e.workDays ?? hours.default_work_days).length * Math.round(Number(e.std ?? hours.default_standard_hours_per_day) * 60);
  }
  return {
    monthMinutes: Number(month?.m ?? 0),
    monthStandardMinutes: stdTotal,
    behind: behind.sort((a, b) => b.daysBehind - a.daysBehind),
    reportedCount,
    employeeCount: assignedSet.size,
    byProject: await byProject(and(inArray(timeEntries.userId, ids), isNull(timeEntries.deletedAt), gte(timeEntries.workDate, monthStart))),
  };
}

export { departments };
