import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { Tx } from "@/lib/db";
import { contractStatuses, contracts, projects, subContracts } from "@/lib/db/schema";
import { contractBalancesReport } from "@/lib/reports/balances";

async function codeToId(tx: Tx, code: string) {
  const [r] = await tx.select({ id: contractStatuses.id }).from(contractStatuses).where(eq(contractStatuses.code, code));
  return r?.id ?? null;
}

/**
 * Contract status rules (spec §8.2): draft without signed_date; active with signed_date;
 * completed when 100% submitted AND 100% paid. Manual override wins.
 */
export async function recomputeContractStatus(tx: Tx, contractId: string): Promise<string | null> {
  const [c] = await tx.select({ id: contracts.id, projectId: contracts.projectId, statusManual: contracts.statusManual, signedDate: contracts.signedDate }).from(contracts).where(eq(contracts.id, contractId));
  if (!c) return null;
  if (!c.statusManual) {
    let code = c.signedDate ? "active" : "draft";
    if (c.signedDate) {
      const rep = await contractBalancesReport({ contractIds: [contractId] });
      const b = rep.projects[0]?.contracts[0]?.balances;
      if (b && b.totalAmount && b.totalAmount > 0 && b.submitted >= b.totalAmount && b.paid >= b.totalAmount) code = "completed";
    }
    const id = await codeToId(tx, code);
    await tx.update(contracts).set({ statusId: id }).where(eq(contracts.id, contractId));
    // sub-contracts without manual status follow the contract
    await tx.update(subContracts).set({ statusId: id }).where(and(eq(subContracts.contractId, contractId), isNull(subContracts.deletedAt)));
  }
  await recomputeProjectStatus(tx, c.projectId);
  return c.projectId;
}

/** Project status rules (spec §8.1.5). */
export async function recomputeProjectStatus(tx: Tx, projectId: string) {
  const [p] = await tx.select({ statusManual: projects.statusManual }).from(projects).where(eq(projects.id, projectId));
  if (!p || p.statusManual) return;
  const rows = await tx
    .select({ code: contractStatuses.code, terminal: contractStatuses.isTerminal })
    .from(contracts)
    .leftJoin(contractStatuses, eq(contractStatuses.id, contracts.statusId))
    .where(and(eq(contracts.projectId, projectId), eq(contracts.direction, "income"), isNull(contracts.deletedAt)));
  let code = "draft";
  if (rows.length > 0) {
    if (rows.every((r) => r.code === "cancelled")) code = "cancelled";
    else if (rows.every((r) => r.terminal)) code = "completed";
    else {
      const open = rows.filter((r) => !r.terminal);
      if (open.length > 0 && open.every((r) => r.code === "on_hold")) code = "on_hold";
      else if (open.every((r) => r.code === "draft")) code = "draft";
      else code = "active";
    }
  }
  await tx.update(projects).set({ statusId: await codeToId(tx, code) }).where(eq(projects.id, projectId));
}
