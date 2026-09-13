import "server-only";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, users } from "@/lib/db/schema";

export interface AuditFilter {
  table?: string;
  recordId?: string;
  recordIds?: string[];
  userId?: string;
  action?: "insert" | "update" | "delete";
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function queryAudit(f: AuditFilter) {
  const where = and(
    f.table ? eq(auditLog.tableName, f.table) : undefined,
    f.recordId ? eq(auditLog.recordId, f.recordId) : undefined,
    f.recordIds && f.recordIds.length ? inArray(auditLog.recordId, f.recordIds) : undefined,
    f.userId ? eq(auditLog.changedBy, f.userId) : undefined,
    f.action ? eq(auditLog.action, f.action) : undefined,
    f.from ? gte(auditLog.changedAt, new Date(`${f.from}T00:00:00+03:00`)) : undefined,
    f.to ? lte(auditLog.changedAt, new Date(`${f.to}T23:59:59+03:00`)) : undefined,
  );
  const rows = await db
    .select({ a: auditLog, userName: sql<string | null>`${users.firstName} || ' ' || ${users.lastName}` })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.changedBy))
    .where(where)
    .orderBy(desc(auditLog.changedAt))
    .limit(f.limit ?? 100)
    .offset(f.offset ?? 0);
  return rows;
}

export async function auditTables(): Promise<string[]> {
  const rows = await db.selectDistinct({ t: auditLog.tableName }).from(auditLog).orderBy(auditLog.tableName);
  return rows.map((r) => r.t);
}

/** Field-by-field diff for the UI (spec §14). */
export function diffRecord(before: unknown, after: unknown): { field: string; before: unknown; after: unknown }[] {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const out: { field: string; before: unknown; after: unknown }[] = [];
  for (const k of keys) {
    if (k === "updated_at") continue;
    if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) out.push({ field: k, before: b[k], after: a[k] });
  }
  return out;
}
