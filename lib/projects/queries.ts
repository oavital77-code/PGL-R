import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { contractStatuses, projects } from "@/lib/db/schema";
import { getSettingFresh, setSetting } from "@/lib/settings/service";

/** Allocate the next automatic work number (spec §8.1) – must run inside withUser tx (row-locked settings). */
export async function allocateWorkNumber(tx: Tx, userId: string): Promise<string> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('numbering.work_number'))`);
  const n = await getSettingFresh("numbering", tx);
  let next = n.work_number.next;
  let candidate = `${n.work_number.prefix}${next}`;
  // skip numbers that already exist (manual mode used before)
  while ((await tx.select({ id: projects.id }).from(projects).where(eq(projects.workNumber, candidate)).limit(1)).length > 0) {
    next++;
    candidate = `${n.work_number.prefix}${next}`;
  }
  await setSetting("numbering", { ...n, work_number: { ...n.work_number, next: next + 1 } }, userId, tx);
  return candidate;
}

export async function workNumberExists(workNumber: string, exceptId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workNumber, workNumber), isNull(projects.deletedAt)))
    .limit(1);
  return rows.some((r) => r.id !== exceptId);
}

export async function statusIdByCode(tx: Tx | typeof db, code: string): Promise<string | null> {
  const [r] = await tx.select({ id: contractStatuses.id }).from(contractStatuses).where(eq(contractStatuses.code, code)).limit(1);
  return r?.id ?? null;
}
