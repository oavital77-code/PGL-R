import "server-only";
import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, contracts, departments, projects, subContractAssignments, subContracts, timeEntries, users } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings/service";
import { workDaysBetween } from "@/lib/hours/summary";
import { todayLocal } from "@/lib/i18n/format";
import { daysBetween } from "@/lib/calc/invoice";
import { defaultRange, monthsBetween, type ReportParams, type ReportResult, type ReportRow } from "../types";

const h = (minutes: number | string | null | undefined) => Math.round((Number(minutes ?? 0) / 60) * 100) / 100;

function entryWhere(p: ReportParams, from: string, to: string) {
  return and(
    isNull(timeEntries.deletedAt),
    gte(timeEntries.workDate, from),
    lte(timeEntries.workDate, to),
    p.userIds?.length ? inArray(timeEntries.userId, p.userIds) : undefined,
    p.subContractIds?.length ? inArray(timeEntries.subContractId, p.subContractIds) : undefined,
    p.projectIds?.length ? inArray(projects.id, p.projectIds) : undefined,
    p.clientIds?.length ? inArray(projects.clientId, p.clientIds) : undefined,
    p.departmentIds?.length ? inArray(users.departmentId, p.departmentIds) : undefined,
    p.pmIds?.length ? inArray(projects.projectManagerUserId, p.pmIds) : undefined,
  );
}

function baseJoin() {
  return db
    .select({
      userId: timeEntries.userId,
      userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      departmentId: users.departmentId,
      departmentName: departments.name,
      subContractId: subContracts.id,
      subName: subContracts.name,
      isDefault: subContracts.isDefault,
      projectId: projects.id,
      workNumber: projects.workNumber,
      projectName: projects.name,
      clientId: clients.id,
      clientName: clients.name,
      workDate: timeEntries.workDate,
      minutes: timeEntries.minutes,
      description: timeEntries.description,
      startTime: timeEntries.startTime,
      endTime: timeEntries.endTime,
      reportedBy: timeEntries.reportedByUserId,
      invoiceId: timeEntries.invoiceId,
      id: timeEntries.id,
    })
    .from(timeEntries)
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .leftJoin(departments, eq(departments.id, users.departmentId))
    .innerJoin(subContracts, eq(subContracts.id, timeEntries.subContractId))
    .innerJoin(contracts, eq(contracts.id, subContracts.contractId))
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId));
}

type E = Awaited<ReturnType<ReturnType<typeof baseJoin>["where"]>>[number];

function tree(entries: E[], levels: ("user" | "project" | "sub" | "client" | "department")[], pctBase: "parent" | "root" = "parent"): ReportRow[] {
  const rows: ReportRow[] = [];
  const keyOf = (e: E, l: (typeof levels)[number]) => (l === "user" ? e.userId : l === "project" ? e.projectId : l === "sub" ? e.subContractId : l === "client" ? e.clientId : (e.departmentId ?? "none"));
  const nameOf = (e: E, l: (typeof levels)[number]) => (l === "user" ? e.userName : l === "project" ? `${e.workNumber} – ${e.projectName}` : l === "sub" ? (e.isDefault ? "—" : e.subName) : l === "client" ? e.clientName : (e.departmentName ?? "—"));
  const build = (list: E[], depth: number, parentId: string | undefined, parentTotal: number, rootTotal: number) => {
    if (depth >= levels.length) return;
    const lvl = levels[depth]!;
    const groups = new Map<string, E[]>();
    for (const e of list) (groups.get(keyOf(e, lvl)) ?? groups.set(keyOf(e, lvl), []).get(keyOf(e, lvl))!).push(e);
    for (const [k, list2] of groups) {
      const minutes = list2.reduce((a, e) => a + e.minutes, 0);
      const id = `${parentId ?? "r"}|${lvl}:${k}`;
      const base = pctBase === "root" ? rootTotal : parentTotal;
      rows.push({ id, parentId, level: depth, cells: { name: nameOf(list2[0]!, lvl), hours: h(minutes), pct: base ? Math.round((minutes / base) * 1000) / 10 : null, employees: new Set(list2.map((e) => e.userId)).size }, link: lvl === "project" ? `/projects/${k}` : lvl === "sub" ? `/sub-contracts/${k}` : undefined });
      build(list2, depth + 1, id, minutes, rootTotal);
    }
  };
  const total = entries.reduce((a, e) => a + e.minutes, 0);
  build(entries, 0, undefined, total, total);
  return rows;
}

const hoursCols = [
  { key: "name", label: "name", type: "text" as const },
  { key: "hours", label: "hours", type: "hours" as const, sum: true },
  { key: "pct", label: "pct_of_parent", type: "pct" as const },
];

export async function employeesProjects(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const e = await baseJoin().where(entryWhere(p, from, to));
  return { columns: hoursCols, rows: tree(e, ["user", "project", "sub"]), totals: { hours: h(e.reduce((a, x) => a + x.minutes, 0)) } };
}

export async function byProject(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const e = await baseJoin().where(entryWhere(p, from, to));
  return { columns: hoursCols, rows: tree(e, ["project", "sub", "user"]), totals: { hours: h(e.reduce((a, x) => a + x.minutes, 0)) } };
}

export async function byClient(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const e = await baseJoin().where(entryWhere(p, from, to));
  return { columns: hoursCols, rows: tree(e, ["client", "project"]), totals: { hours: h(e.reduce((a, x) => a + x.minutes, 0)) } };
}

export async function byDepartment(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const e = await baseJoin().where(entryWhere(p, from, to));
  return { columns: hoursCols, rows: tree(e, ["department", "user"], "root"), totals: { hours: h(e.reduce((a, x) => a + x.minutes, 0)) } };
}

export async function projectSummary(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const today = todayLocal();
  const monthStart = `${today.slice(0, 7)}-01`;
  const all = await baseJoin().where(and(isNull(timeEntries.deletedAt), p.projectIds?.length ? inArray(projects.id, p.projectIds) : undefined, p.clientIds?.length ? inArray(projects.clientId, p.clientIds) : undefined, p.pmIds?.length ? inArray(projects.projectManagerUserId, p.pmIds) : undefined));
  const byP = new Map<string, E[]>();
  for (const e of all) (byP.get(e.projectId) ?? byP.set(e.projectId, []).get(e.projectId)!).push(e);
  const rows: ReportRow[] = [...byP.entries()].map(([id, es]) => ({
    id,
    level: 0,
    link: `/projects/${id}`,
    cells: {
      name: `${es[0]!.workNumber} – ${es[0]!.projectName}`,
      client: es[0]!.clientName,
      hours_period: h(es.filter((e) => e.workDate >= from && e.workDate <= to).reduce((a, e) => a + e.minutes, 0)),
      hours_total: h(es.reduce((a, e) => a + e.minutes, 0)),
      employees: new Set(es.map((e) => e.userId)).size,
      hours_month: h(es.filter((e) => e.workDate >= monthStart).reduce((a, e) => a + e.minutes, 0)),
    },
  }));
  return {
    columns: [
      { key: "name", label: "project", type: "text" },
      { key: "client", label: "client", type: "text" },
      { key: "hours_period", label: "hours_period", type: "hours", sum: true },
      { key: "hours_total", label: "hours_total", type: "hours", sum: true },
      { key: "employees", label: "employees", type: "number" },
      { key: "hours_month", label: "hours_month", type: "hours", sum: true },
    ],
    rows: rows.sort((a, b) => String(a.cells.name).localeCompare(String(b.cells.name))),
  };
}

export async function projectMatrix(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const months = monthsBetween(from, to);
  const e = await baseJoin().where(entryWhere(p, from, to));
  const byU = new Map<string, E[]>();
  for (const x of e) (byU.get(x.userId) ?? byU.set(x.userId, []).get(x.userId)!).push(x);
  const rows: ReportRow[] = [...byU.entries()].map(([id, es]) => {
    const cells: Record<string, unknown> = { name: es[0]!.userName };
    let total = 0;
    for (const m of months) {
      const mm = es.filter((x) => x.workDate.startsWith(m)).reduce((a, x) => a + x.minutes, 0);
      cells[`m_${m}`] = h(mm);
      total += mm;
    }
    cells.total = h(total);
    return { id, level: 0, cells };
  });
  return { columns: [{ key: "name", label: "employee", type: "text" }, ...months.map((m) => ({ key: `m_${m}`, label: m, type: "hours" as const, sum: true })), { key: "total", label: "total", type: "hours", sum: true }], rows };
}

export async function matrixSummary(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const months = monthsBetween(from, to);
  const e = await baseJoin().where(entryWhere(p, from, to));
  const g = p.groupBy?.[0];
  const byP = new Map<string, E[]>();
  for (const x of e) (byP.get(x.projectId) ?? byP.set(x.projectId, []).get(x.projectId)!).push(x);
  const rows: ReportRow[] = [];
  const projectRow = (id: string, es: E[], parentId?: string, level = 0): ReportRow => {
    const cells: Record<string, unknown> = { name: `${es[0]!.workNumber} – ${es[0]!.projectName}` };
    let total = 0;
    for (const m of months) {
      const mm = es.filter((x) => x.workDate.startsWith(m)).reduce((a, x) => a + x.minutes, 0);
      cells[`m_${m}`] = h(mm);
      total += mm;
    }
    cells.total = h(total);
    return { id: `${parentId ?? ""}|${id}`, parentId, level, cells, link: `/projects/${id}` };
  };
  if (g === "client" || g === "department") {
    const byG = new Map<string, E[]>();
    for (const x of e) {
      const k = g === "client" ? x.clientId : (x.departmentId ?? "none");
      (byG.get(k) ?? byG.set(k, []).get(k)!).push(x);
    }
    for (const [k, es] of byG) {
      const cells: Record<string, unknown> = { name: g === "client" ? es[0]!.clientName : (es[0]!.departmentName ?? "—") };
      let total = 0;
      for (const m of months) {
        const mm = es.filter((x) => x.workDate.startsWith(m)).reduce((a, x) => a + x.minutes, 0);
        cells[`m_${m}`] = h(mm);
        total += mm;
      }
      cells.total = h(total);
      rows.push({ id: `g:${k}`, level: 0, cells });
      const sub = new Map<string, E[]>();
      for (const x of es) (sub.get(x.projectId) ?? sub.set(x.projectId, []).get(x.projectId)!).push(x);
      for (const [pid, pes] of sub) rows.push(projectRow(pid, pes, `g:${k}`, 1));
    }
  } else for (const [pid, pes] of byP) rows.push(projectRow(pid, pes));
  return { columns: [{ key: "name", label: "project", type: "text" }, ...months.map((m) => ({ key: `m_${m}`, label: m, type: "hours" as const, sum: true })), { key: "total", label: "total", type: "hours", sum: true }], rows };
}

export async function detailed(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const e = await baseJoin().where(entryWhere(p, from, to)).orderBy(timeEntries.workDate, users.lastName).limit(20_000);
  const reporters = new Map((await db.select({ id: users.id, n: sql<string>`${users.firstName} || ' ' || ${users.lastName}` }).from(users)).map((u) => [u.id, u.n]));
  return {
    columns: [
      { key: "date", label: "date", type: "date" },
      { key: "employee", label: "employee", type: "text" },
      { key: "department", label: "department", type: "text" },
      { key: "project", label: "project", type: "text" },
      { key: "sub", label: "sub_contract", type: "text" },
      { key: "start", label: "start", type: "text" },
      { key: "end", label: "end", type: "text" },
      { key: "hours", label: "hours", type: "hours", sum: true },
      { key: "description", label: "description", type: "text" },
      { key: "reported_by", label: "reported_by", type: "text" },
      { key: "invoiced", label: "invoiced", type: "text" },
    ],
    rows: e.map((x) => ({ id: x.id, level: 0, cells: { date: x.workDate, employee: x.userName, department: x.departmentName ?? "—", project: `${x.workNumber} – ${x.projectName}`, sub: x.isDefault ? "—" : x.subName, start: x.startTime?.slice(0, 5) ?? "", end: x.endTime?.slice(0, 5) ?? "", hours: h(x.minutes), description: x.description, reported_by: x.reportedBy === x.userId ? "" : (reporters.get(x.reportedBy) ?? ""), invoiced: x.invoiceId ? "✔" : "" } })),
    totals: { hours: h(e.reduce((a, x) => a + x.minutes, 0)) },
  };
}

async function activeEmployees(p: ReportParams) {
  return db
    .select({ id: users.id, name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`, std: users.standardHoursPerDay, workDays: users.workDays, start: users.employmentStart, end: users.employmentEnd, departmentName: departments.name, payroll: users.externalPayrollId, isActive: users.isActive })
    .from(users)
    .leftJoin(departments, eq(departments.id, users.departmentId))
    .where(and(isNull(users.deletedAt), p.includeInactive ? undefined : eq(users.isActive, true), p.departmentIds?.length ? inArray(users.departmentId, p.departmentIds) : undefined, p.userIds?.length ? inArray(users.id, p.userIds) : undefined))
    .orderBy(users.lastName, users.firstName);
}

export async function monthlyByEmployee(p: ReportParams): Promise<ReportResult> {
  const month = p.month ?? todayLocal().slice(0, 7);
  const from = `${month}-01`;
  const to = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const days = Number(to.slice(8, 10));
  const [emps, settings] = await Promise.all([activeEmployees(p), getSetting("hours")]);
  const e = emps.length ? await db.select({ userId: timeEntries.userId, d: timeEntries.workDate, m: sql<number>`sum(${timeEntries.minutes})` }).from(timeEntries).where(and(isNull(timeEntries.deletedAt), inArray(timeEntries.userId, emps.map((x) => x.id)), gte(timeEntries.workDate, from), lte(timeEntries.workDate, to))).groupBy(timeEntries.userId, timeEntries.workDate) : [];
  const rows: ReportRow[] = emps.map((u) => {
    const cells: Record<string, unknown> = { name: u.name, department: u.departmentName ?? "—" };
    let total = 0;
    for (let d = 1; d <= days; d++) {
      const iso = `${month}-${String(d).padStart(2, "0")}`;
      const m = Number(e.find((x) => x.userId === u.id && x.d === iso)?.m ?? 0);
      cells[`d_${d}`] = m ? h(m) : null;
      total += m;
    }
    const wd = workDaysBetween(u.start && u.start > from ? u.start : from, u.end && u.end < to ? u.end : to, u.workDays ?? settings.default_work_days).length;
    const std = wd * Number(u.std ?? settings.default_standard_hours_per_day);
    cells.total = h(total);
    cells.standard = Math.round(std * 100) / 100;
    cells.gap = Math.round((h(total) - std) * 100) / 100;
    return { id: u.id, level: 0, cells, link: `/hours?user=${u.id}&view=monthly&date=${from}` };
  });
  return {
    columns: [{ key: "name", label: "employee", type: "text" }, { key: "department", label: "department", type: "text" }, ...Array.from({ length: days }, (_, i) => ({ key: `d_${i + 1}`, label: String(i + 1), type: "hours" as const })), { key: "total", label: "total", type: "hours", sum: true }, { key: "standard", label: "standard", type: "hours", sum: true }, { key: "gap", label: "gap", type: "hours", sum: true }],
    rows,
  };
}

export async function missing(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const today = todayLocal();
  const end = to > today ? today : to;
  const [emps, settings] = await Promise.all([activeEmployees(p), getSetting("hours")]);
  const assigned = new Set((await db.select({ u: subContractAssignments.userId }).from(subContractAssignments).where(eq(subContractAssignments.isActive, true))).map((a) => a.u));
  const e = emps.length ? await db.select({ userId: timeEntries.userId, d: timeEntries.workDate, m: sql<number>`sum(${timeEntries.minutes})` }).from(timeEntries).where(and(isNull(timeEntries.deletedAt), inArray(timeEntries.userId, emps.map((x) => x.id)), gte(timeEntries.workDate, from), lte(timeEntries.workDate, end))).groupBy(timeEntries.userId, timeEntries.workDate) : [];
  const last = await db.select({ userId: timeEntries.userId, last: sql<string>`max(${timeEntries.workDate})` }).from(timeEntries).where(isNull(timeEntries.deletedAt)).groupBy(timeEntries.userId);
  const rows: ReportRow[] = emps
    .filter((u) => assigned.has(u.id))
    .map((u) => {
      const std = Number(u.std ?? settings.default_standard_hours_per_day) * 60;
      const wd = workDaysBetween(u.start && u.start > from ? u.start : from, u.end && u.end < end ? u.end : end, u.workDays ?? settings.default_work_days);
      const mine = e.filter((x) => x.userId === u.id);
      const missingDays = wd.filter((d) => !mine.some((x) => x.d === d));
      const partial = wd.filter((d) => {
        const m = mine.find((x) => x.d === d);
        return m && Number(m.m) < std;
      });
      const l = last.find((x) => x.userId === u.id)?.last ?? null;
      return { id: u.id, level: 0, link: `/hours?user=${u.id}`, cells: { name: u.name, department: u.departmentName ?? "—", missing_days: missingDays.length, partial_days: partial.length, last_report: l, days_since: l ? daysBetween(l, today) : null } };
    });
  return {
    columns: [{ key: "name", label: "employee", type: "text" }, { key: "department", label: "department", type: "text" }, { key: "missing_days", label: "missing_days", type: "number", sum: true }, { key: "partial_days", label: "partial_days", type: "number", sum: true }, { key: "last_report", label: "last_report", type: "date" }, { key: "days_since", label: "days_since", type: "number" }],
    rows: rows.sort((a, b) => Number(b.cells.missing_days) - Number(a.cells.missing_days)),
  };
}

/** Payroll export (spec §10.9). */
export async function payrollExport(p: ReportParams): Promise<ReportResult> {
  const res = await monthlyByEmployee(p);
  const emps = await activeEmployees(p);
  const payroll = new Map(emps.map((u) => [u.id, u.payroll]));
  const rows = res.rows.map((r) => ({ ...r, cells: { payroll_id: payroll.get(r.id) ?? "", ...r.cells, days_reported: Object.entries(r.cells).filter(([k, v]) => k.startsWith("d_") && v).length } }));
  return { columns: [{ key: "payroll_id", label: "payroll_id", type: "text" }, ...res.columns.filter((c) => c.key !== "gap" && c.key !== "standard"), { key: "days_reported", label: "days_reported", type: "number" }], rows };
}
