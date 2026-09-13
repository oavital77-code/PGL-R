import { eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "../schema";
import { CONTRACT_STATUSES, CONTRACT_TYPES, DEPARTMENTS, DOCUMENT_TYPES, GRADES, STAGE_NAMES, STAGE_TEMPLATES, UNIT_TYPES, VAT_RATES } from "./data";

type Db = PostgresJsDatabase<typeof s>;

/** Idempotent seed – safe to run on every deploy. */
export async function runSeed(db: Db) {
  for (const d of DEPARTMENTS) {
    await db.insert(s.departments).values(d).onConflictDoNothing({ target: s.departments.code });
  }
  for (const r of CONTRACT_STATUSES) {
    await db.insert(s.contractStatuses).values(r).onConflictDoNothing({ target: s.contractStatuses.code });
  }
  for (const r of CONTRACT_TYPES) {
    await db.insert(s.contractTypes).values(r).onConflictDoNothing({ target: s.contractTypes.code });
  }
  for (const r of UNIT_TYPES) {
    await db.insert(s.unitTypes).values(r).onConflictDoNothing({ target: s.unitTypes.code });
  }
  for (const r of DOCUMENT_TYPES) {
    await db.insert(s.documentTypes).values(r).onConflictDoNothing({ target: s.documentTypes.code });
  }
  for (const [i, name] of STAGE_NAMES.entries()) {
    await db.insert(s.stageNames).values({ name, sortOrder: i + 1 }).onConflictDoNothing({ target: s.stageNames.name });
  }
  const stageRows = await db.select({ id: s.stageNames.id, name: s.stageNames.name }).from(s.stageNames);
  const stageId = new Map(stageRows.map((r) => [r.name, r.id]));
  for (const t of STAGE_TEMPLATES) {
    const existing = await db.select({ id: s.stageTemplates.id }).from(s.stageTemplates).where(eq(s.stageTemplates.name, t.name));
    if (existing.length > 0) continue;
    const [tpl] = await db.insert(s.stageTemplates).values({ name: t.name }).returning({ id: s.stageTemplates.id });
    if (!tpl) continue;
    await db.insert(s.stageTemplateItems).values(
      t.items.map((it, i) => ({ templateId: tpl.id, stageNameId: stageId.get(it.stage)!, defaultPct: it.pct.toFixed(3), sortOrder: i + 1 })),
    );
  }
  for (const v of VAT_RATES) {
    await db.insert(s.vatRates).values(v).onConflictDoNothing({ target: s.vatRates.effectiveFrom });
  }
  const gradeCount = await db.select({ c: sql<number>`count(*)` }).from(s.grades);
  if (Number(gradeCount[0]?.c ?? 0) === 0) {
    await db.insert(s.grades).values(GRADES);
  }
}
