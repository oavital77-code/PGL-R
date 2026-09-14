"use server";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/auth/authorize";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/lib/auth/errors";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { db } from "@/lib/db";
import { importBatches } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { uploadDocument } from "@/lib/storage";
import { getEntity } from "./spec";
import { parseWorkbook, type ParsedRow } from "./parse";
import { diffReport, executeRows, rollbackCreated, validateRows } from "./engine";

interface BatchLog {
  rows: ParsedRow[];
  unknownColumns: string[];
  expected?: Record<string, { submitted: number | null; paid: number | null; remaining: number | null }>;
  error?: string;
}

/** Upload + dry-run (spec §15.1). Creates an import_batches row with the validated rows in `log`. */
export async function uploadImportAction(fd: FormData): Promise<ActionResult<{ id: string; ok: boolean; total: number; failed: number }>> {
  return runAction(async () => {
    const user = await requireCapability("import.run");
    const entity = getEntity(String(fd.get("entity")));
    if (!entity) throw new ValidationError("errors.validation");
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("errors.validation", { file: ["common.required"] });
    const bytes = Buffer.from(await file.arrayBuffer());
    const { rows, unknownColumns } = await parseWorkbook(entity, bytes);
    const outcome = await validateRows(entity.key, rows);
    const failed = outcome.rows.filter((r) => r.errors.length).length;
    const id = await withUser({ userId: user.id }, async (tx) => {
      const [b] = await tx.insert(importBatches).values({ entity: entity.key, status: outcome.ok && rows.length > 0 ? "ready" : "failed", rowsTotal: rows.length, rowsOk: rows.length - failed, rowsFailed: failed, log: { rows: outcome.rows, unknownColumns, expected: outcome.expected } satisfies BatchLog, runBy: user.id, createdBy: user.id }).returning({ id: importBatches.id });
      try {
        const doc = await uploadDocument({ bucket: "imports", entityType: "import", entityId: b!.id, file, documentType: "import", uploadedBy: user.id, allowedExtensions: ["xlsx"] }, tx);
        await tx.update(importBatches).set({ fileDocumentId: doc.id }).where(eq(importBatches.id, b!.id));
      } catch {
        /* storage optional for imports */
      }
      return b!.id;
    });
    revalidatePath("/admin/import");
    return { id, ok: outcome.ok && rows.length > 0, total: rows.length, failed };
  });
}

export async function executeImportAction(batchId: string): Promise<ActionResult<{ created: number }>> {
  return runAction(async () => {
    const user = await requireCapability("import.run");
    const [b] = await db.select().from(importBatches).where(eq(importBatches.id, batchId));
    if (!b) throw new NotFoundError("batch");
    if (b.status !== "ready") throw new BusinessRuleError("import.not_ready");
    const log = b.log as BatchLog;
    // re-validate against the current DB state right before writing
    const outcome = await validateRows(b.entity, log.rows.map((r) => ({ ...r, errors: [] })));
    if (!outcome.ok) {
      await db.update(importBatches).set({ status: "failed", log: { ...log, rows: outcome.rows }, rowsFailed: outcome.rows.filter((r) => r.errors.length).length }).where(eq(importBatches.id, batchId));
      throw new BusinessRuleError("import.revalidation_failed");
    }
    await db.update(importBatches).set({ status: "importing" }).where(eq(importBatches.id, batchId));
    try {
      const created = await executeRows(b.entity, outcome.rows, user.id);
      await db.update(importBatches).set({ status: "done", createdRecordIds: created }).where(eq(importBatches.id, batchId));
      revalidatePath("/admin/import");
      return { created: Object.values(created).reduce((a, x) => a + x.length, 0) };
    } catch (e) {
      await db.update(importBatches).set({ status: "failed", log: { ...log, error: e instanceof Error ? e.message : String(e) } }).where(eq(importBatches.id, batchId));
      throw new BusinessRuleError("import.execute_failed", e instanceof Error ? e.message : String(e));
    }
  });
}

export async function rollbackImportAction(batchId: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("import.run");
    const [b] = await db.select().from(importBatches).where(eq(importBatches.id, batchId));
    if (!b || b.status !== "done" || !b.createdRecordIds) throw new BusinessRuleError("import.cannot_rollback");
    try {
      await rollbackCreated(b.createdRecordIds, user.id);
    } catch (e) {
      throw new BusinessRuleError("import.rollback_blocked", e instanceof Error ? e.message : String(e));
    }
    await db.update(importBatches).set({ status: "rolled_back" }).where(eq(importBatches.id, batchId));
    revalidatePath("/admin/import");
    return undefined;
  });
}

export async function diffReportAction(): Promise<ActionResult<Awaited<ReturnType<typeof diffReport>>>> {
  return runAction(async () => {
    await requireCapability("import.run");
    const batches = await db.select({ log: importBatches.log }).from(importBatches).where(eq(importBatches.entity, "sub_contracts")).orderBy(desc(importBatches.createdAt));
    const expected: Record<string, { submitted: number | null; paid: number | null; remaining: number | null }> = {};
    for (const b of batches.reverse()) Object.assign(expected, (b.log as BatchLog).expected ?? {});
    return diffReport(expected);
  });
}
