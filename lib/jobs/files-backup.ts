import "server-only";
import { and, isNull, or, lt, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { downloadBytes } from "@/lib/storage";
import { r2Put, r2Configured } from "@/lib/backup/r2";
import { adminUserIds } from "@/lib/notifications/service";
import { notifyEvent } from "@/lib/email/notify-email";

/** Nightly copy of new/changed files to Cloudflare R2 (spec §2.4 #7). */
export async function filesBackupJob() {
  if (!r2Configured()) return { skipped: "r2_not_configured" };
  const pending = await db
    .select({ id: documents.id, bucket: documents.storageBucket, path: documents.storagePath, updatedAt: documents.updatedAt })
    .from(documents)
    .where(and(isNull(documents.deletedAt), or(isNull(documents.backedUpAt), lt(documents.backedUpAt, documents.updatedAt))))
    .limit(500);
  let ok = 0;
  const errors: string[] = [];
  for (const d of pending) {
    try {
      const bytes = await downloadBytes(d.bucket, d.path);
      await r2Put(`${d.bucket}/${d.path}`, bytes);
      await db.update(documents).set({ backedUpAt: sql`now()` }).where(eq(documents.id, d.id));
      ok++;
    } catch (e) {
      errors.push(`${d.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (errors.length > 0) {
    await notifyEvent({ userIds: await adminUserIds(), type: "backup.failed", title: "כשל בגיבוי קבצים ל-R2", body: errors.slice(0, 10).join("\n") });
  }
  return { ok, failed: errors.length, remaining: pending.length === 500 };
}
