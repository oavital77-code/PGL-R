import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, contractStatuses, contractTypes, departments, stageTemplates, unitTypes, users } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings/service";
import type { ProjectFormLookups } from "@/components/projects/project-form";

export async function projectFormLookups(): Promise<ProjectFormLookups> {
  const [cl, us, de, st, numbering] = await Promise.all([
    db.select({ id: clients.id, name: clients.name }).from(clients).where(and(isNull(clients.deletedAt), eq(clients.isActive, true))).orderBy(clients.name),
    db.select({ id: users.id, first: users.firstName, last: users.lastName }).from(users).where(and(isNull(users.deletedAt), eq(users.isActive, true))).orderBy(users.lastName),
    db.select({ id: departments.id, name: departments.name }).from(departments).where(eq(departments.isActive, true)).orderBy(departments.sortOrder),
    db.select({ code: contractStatuses.code, name: contractStatuses.name }).from(contractStatuses).where(eq(contractStatuses.isActive, true)).orderBy(contractStatuses.sortOrder),
    getSetting("numbering"),
  ]);
  return { clients: cl, users: us.map((u) => ({ id: u.id, name: `${u.first} ${u.last}` })), departments: de, statuses: st, workNumberMode: numbering.work_number.mode };
}

export async function contractFormLookups() {
  const [cl, ty, st, tpl, un, de] = await Promise.all([
    db.select({ id: clients.id, name: clients.name, paymentTermsDays: clients.paymentTermsDays, indexLinkedDefault: clients.indexLinkedDefault, vatExempt: clients.vatExempt }).from(clients).where(and(isNull(clients.deletedAt), eq(clients.isActive, true))).orderBy(clients.name),
    db.select({ id: contractTypes.id, code: contractTypes.code, name: contractTypes.name }).from(contractTypes).where(eq(contractTypes.isActive, true)).orderBy(contractTypes.sortOrder),
    db.select({ id: contractStatuses.id, code: contractStatuses.code, name: contractStatuses.name }).from(contractStatuses).where(eq(contractStatuses.isActive, true)).orderBy(contractStatuses.sortOrder),
    db.select({ id: stageTemplates.id, name: stageTemplates.name }).from(stageTemplates).where(eq(stageTemplates.isActive, true)).orderBy(stageTemplates.name),
    db.select({ id: unitTypes.id, name: unitTypes.name }).from(unitTypes).where(eq(unitTypes.isActive, true)).orderBy(unitTypes.sortOrder),
    db.select({ id: departments.id, name: departments.name }).from(departments).where(eq(departments.isActive, true)).orderBy(departments.sortOrder),
  ]);
  return { clients: cl, contractTypes: ty, statuses: st, templates: tpl, unitTypes: un, departments: de };
}
export type ContractFormLookups = Awaited<ReturnType<typeof contractFormLookups>>;
