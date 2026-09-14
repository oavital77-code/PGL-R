import "server-only";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contractStatuses, contracts, periodUnlocks, projects, subContractAssignments, subContracts, timeEntries, users } from "@/lib/db/schema";
import { isPeriodLocked, type PeriodUnlock } from "@/lib/calc/period-lock";
import { todayLocal } from "@/lib/i18n/format";
import { getSetting } from "@/lib/settings/service";

export interface AssignedSubContract {
  id: string;
  contractId: string;
  projectId: string;
  workNumber: string;
  projectName: string;
  subName: string;
  isDefault: boolean;
  label: string;
  lastUsed: string | null;
}

/**
 * Sub-contracts a user may report on (spec §10.1): active (non-terminal) status,
 * participates_in_hours on both levels, active assignment. Most recently used first.
 */
export async function assignedSubContracts(userId: string): Promise<AssignedSubContract[]> {
  const rows = await db
    .select({
      id: subContracts.id,
      contractId: contracts.id,
      projectId: projects.id,
      workNumber: projects.workNumber,
      projectName: projects.name,
      subName: subContracts.name,
      isDefault: subContracts.isDefault,
      lastUsed: sql<string | null>`(select max(te.work_date) from time_entries te where te.sub_contract_id = ${subContracts.id} and te.user_id = ${userId} and te.deleted_at is null)`,
    })
    .from(subContractAssignments)
    .innerJoin(subContracts, eq(subContracts.id, subContractAssignments.subContractId))
    .innerJoin(contracts, eq(contracts.id, subContracts.contractId))
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .leftJoin(contractStatuses, eq(contractStatuses.id, subContracts.statusId))
    .where(
      and(
        eq(subContractAssignments.userId, userId),
        eq(subContractAssignments.isActive, true),
        isNull(subContracts.deletedAt),
        isNull(contracts.deletedAt),
        isNull(projects.deletedAt),
        eq(subContracts.participatesInHours, true),
        eq(contracts.participatesInHours, true),
        eq(contracts.direction, "income"),
        sql`coalesce(${contractStatuses.isTerminal}, false) = false`,
      ),
    )
    .orderBy(desc(sql`(select max(te.work_date) from time_entries te where te.sub_contract_id = ${subContracts.id} and te.user_id = ${userId} and te.deleted_at is null)`), projects.workNumber, subContracts.numberInContract);
  return rows.map((r) => ({ ...r, label: r.isDefault ? `${r.workNumber} – ${r.projectName}` : `${r.workNumber} – ${r.projectName} – ${r.subName}` }));
}

export interface TimeEntryRow {
  id: string;
  userId: string;
  subContractId: string;
  workDate: string;
  minutes: number;
  startTime: string | null;
  endTime: string | null;
  description: string;
  reportedByUserId: string;
  reportedByName: string | null;
  invoiceId: string | null;
  label: string;
}

export async function entriesForRange(userId: string, from: string, to: string): Promise<TimeEntryRow[]> {
  const rows = await db
    .select({
      e: timeEntries,
      workNumber: projects.workNumber,
      projectName: projects.name,
      subName: subContracts.name,
      isDefault: subContracts.isDefault,
      reporter: sql<string | null>`${users.firstName} || ' ' || ${users.lastName}`,
    })
    .from(timeEntries)
    .innerJoin(subContracts, eq(subContracts.id, timeEntries.subContractId))
    .innerJoin(contracts, eq(contracts.id, subContracts.contractId))
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .leftJoin(users, eq(users.id, timeEntries.reportedByUserId))
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.deletedAt), gte(timeEntries.workDate, from), lte(timeEntries.workDate, to)))
    .orderBy(timeEntries.workDate, timeEntries.startTime, timeEntries.createdAt);
  return rows.map((r) => ({
    id: r.e.id,
    userId: r.e.userId,
    subContractId: r.e.subContractId,
    workDate: r.e.workDate,
    minutes: r.e.minutes,
    startTime: r.e.startTime,
    endTime: r.e.endTime,
    description: r.e.description,
    reportedByUserId: r.e.reportedByUserId,
    reportedByName: r.e.reportedByUserId === r.e.userId ? null : r.reporter,
    invoiceId: r.e.invoiceId,
    label: r.isDefault ? `${r.workNumber} – ${r.projectName}` : `${r.workNumber} – ${r.projectName} – ${r.subName}`,
  }));
}

export async function userHoursProfile(userId: string) {
  const [u] = await db
    .select({ id: users.id, first: users.firstName, last: users.lastName, std: users.standardHoursPerDay, workDays: users.workDays, start: users.employmentStart, departmentId: users.departmentId })
    .from(users)
    .where(eq(users.id, userId));
  const hours = await getSetting("hours");
  return {
    id: userId,
    name: u ? `${u.first} ${u.last}` : "",
    departmentId: u?.departmentId ?? null,
    stdMinutes: Math.round(Number(u?.std ?? hours.default_standard_hours_per_day) * 60),
    workDays: u?.workDays ?? hours.default_work_days,
    employmentStart: u?.start ?? null,
    settings: hours,
  };
}

export async function activeUnlocks(userId: string): Promise<PeriodUnlock[]> {
  const rows = await db
    .select({ userId: periodUnlocks.userId, month: periodUnlocks.month, until: periodUnlocks.unlockedUntil })
    .from(periodUnlocks)
    .where(and(eq(periodUnlocks.userId, userId), sql`${periodUnlocks.unlockedUntil} > now()`));
  return rows.map((r) => ({ userId: r.userId, month: r.month, unlockedUntil: r.until.toISOString() }));
}

/** Locked? – computed rule + admin unlock rows (spec §10.7). */
export async function isLockedFor(userId: string, workDate: string, opts?: { unlocks?: PeriodUnlock[]; rule?: "end_of_next_month" | "end_of_month" | "never" }): Promise<boolean> {
  const unlocks = opts?.unlocks ?? (await activeUnlocks(userId));
  const rule = opts?.rule ?? (await getSetting("hours")).lock_rule;
  return isPeriodLocked(workDate, todayLocal(), { rule, userId, unlocks, nowIso: new Date().toISOString() });
}

/** Users the current user may pick in the timesheet selector (spec §10.4 scope). */
export async function selectableUsers(scope: "all" | "department", departmentId: string | null) {
  const rows = await db
    .select({ id: users.id, first: users.firstName, last: users.lastName, departmentId: users.departmentId })
    .from(users)
    .where(and(eq(users.isActive, true), isNull(users.deletedAt), scope === "department" ? (departmentId ? eq(users.departmentId, departmentId) : inArray(users.id, [])) : undefined))
    .orderBy(users.lastName, users.firstName);
  return rows.map((r) => ({ id: r.id, name: `${r.first} ${r.last}`, departmentId: r.departmentId }));
}

export async function dayTotals(userId: string, dates: string[]): Promise<Map<string, number>> {
  if (dates.length === 0) return new Map();
  const rows = await db
    .select({ d: timeEntries.workDate, m: sql<number>`sum(${timeEntries.minutes})` })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.deletedAt), inArray(timeEntries.workDate, dates)))
    .groupBy(timeEntries.workDate);
  return new Map(rows.map((r) => [r.d, Number(r.m)]));
}
