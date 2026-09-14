import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, contractStatuses, contracts, projects } from "@/lib/db/schema";
import { contractBalancesReport } from "@/lib/reports/balances";

/** Contracts eligible for a new invoice (spec §11.4 step 1): active client contracts with remaining balance or an open method. */
export async function invoiceableContracts(q?: string) {
  const rows = await db
    .select({ id: contracts.id, name: contracts.name, numberInProject: contracts.numberInProject, projectId: projects.id, workNumber: projects.workNumber, projectName: projects.name, clientName: clients.name, clientId: clients.id, statusCode: contractStatuses.code, terminal: contractStatuses.isTerminal })
    .from(contracts)
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .innerJoin(clients, eq(clients.id, contracts.clientId))
    .leftJoin(contractStatuses, eq(contractStatuses.id, contracts.statusId))
    .where(and(eq(contracts.direction, "income"), isNull(contracts.deletedAt), isNull(projects.deletedAt), sql`coalesce(${contractStatuses.isTerminal}, false) = false`, sql`coalesce(${contractStatuses.code}, '') <> 'cancelled'`, q ? sql`(${projects.workNumber} ilike ${"%" + q + "%"} or ${projects.name} ilike ${"%" + q + "%"} or ${clients.name} ilike ${"%" + q + "%"})` : undefined))
    .orderBy(projects.workNumber, contracts.numberInProject)
    .limit(100);
  if (rows.length === 0) return [];
  const rep = await contractBalancesReport({ contractIds: rows.map((r) => r.id) });
  const byId = new Map(rep.projects.flatMap((p) => p.contracts).map((c) => [c.id, c]));
  return rows
    .map((r) => {
      const c = byId.get(r.id);
      const remaining = c?.balances.remaining ?? null;
      const open = c?.subContracts.some((s) => s.isOpen) ?? false;
      return { ...r, remaining, open, subContracts: c?.subContracts.map((s) => ({ id: s.id, name: s.name, isDefault: s.isDefault, pricingMethod: s.pricingMethod, remaining: s.balances.remaining, isOpen: s.isOpen, terminal: false, statusCode: s.statusCode })) ?? [] };
    })
    .filter((r) => r.open || (r.remaining !== null && r.remaining > 0.005));
}
