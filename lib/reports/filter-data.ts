import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, contractStatuses, departments, projects, subContracts, contracts, suppliers, users, reportTemplates, reportSchedules } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/authorize";

/** Option lists for the filter panel (spec §12.1). */
export async function filterData(user: SessionUser) {
  const fin = can(user, "reports.financial");
  const [cl, pr, sc, de, us, st, su, tpl, sch] = await Promise.all([
    fin ? db.select({ id: clients.id, name: clients.name }).from(clients).where(isNull(clients.deletedAt)).orderBy(clients.name) : [],
    db.select({ id: projects.id, name: projects.name, workNumber: projects.workNumber, pm: projects.projectManagerUserId }).from(projects).where(isNull(projects.deletedAt)).orderBy(projects.workNumber),
    db.select({ id: subContracts.id, name: subContracts.name, contractId: subContracts.contractId, projectId: contracts.projectId, isDefault: subContracts.isDefault }).from(subContracts).innerJoin(contracts, eq(contracts.id, subContracts.contractId)).where(isNull(subContracts.deletedAt)),
    db.select({ id: departments.id, name: departments.name }).from(departments).where(eq(departments.isActive, true)).orderBy(departments.sortOrder),
    db.select({ id: users.id, first: users.firstName, last: users.lastName, departmentId: users.departmentId, isActive: users.isActive }).from(users).where(isNull(users.deletedAt)).orderBy(users.lastName),
    db.select({ code: contractStatuses.code, name: contractStatuses.name }).from(contractStatuses).orderBy(contractStatuses.sortOrder),
    fin ? db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(isNull(suppliers.deletedAt)).orderBy(suppliers.name) : [],
    db.select().from(reportTemplates).where(and(user.role === "admin" ? undefined : eq(reportTemplates.ownerUserId, user.id))),
    db.select().from(reportSchedules),
  ]);
  const visibleUsers = user.othersScope === "department" && user.role !== "admin" ? us.filter((u) => u.departmentId === user.departmentId) : us;
  return {
    clients: cl,
    projects: pr.map((p) => ({ id: p.id, label: `${p.workNumber} – ${p.name}` })),
    subContracts: sc.map((s) => ({ id: s.id, projectId: s.projectId, label: s.isDefault ? pr.find((p) => p.id === s.projectId)?.name ?? s.name : s.name })),
    departments: de,
    users: visibleUsers.map((u) => ({ id: u.id, name: `${u.first} ${u.last}`, isActive: u.isActive })),
    pms: [...new Set(pr.map((p) => p.pm).filter(Boolean))].map((id) => ({ id: id!, name: us.find((u) => u.id === id) ? `${us.find((u) => u.id === id)!.first} ${us.find((u) => u.id === id)!.last}` : id! })),
    statuses: st,
    suppliers: su,
    templates: tpl.filter((t) => t.isShared || t.ownerUserId === user.id).map((t) => ({ id: t.id, name: t.name, reportType: t.reportType, config: t.config as Record<string, unknown>, isShared: t.isShared, mine: t.ownerUserId === user.id })),
    schedules: sch.map((s) => ({ id: s.id, templateId: s.templateId, frequency: s.frequency, dayOfWeek: s.dayOfWeek, dayOfMonth: s.dayOfMonth, hour: s.hour, recipients: s.recipients, format: s.format, isActive: s.isActive, lastRunAt: s.lastRunAt?.toISOString() ?? null, nextRunAt: s.nextRunAt?.toISOString() ?? null, lastError: s.lastError })),
  };
}
export type FilterData = Awaited<ReturnType<typeof filterData>>;
