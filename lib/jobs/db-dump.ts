import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { r2Configured, r2Put } from "@/lib/backup/r2";
import { adminUserIds } from "@/lib/notifications/service";
import { notifyEvent } from "@/lib/email/notify-email";

const exec = promisify(execFile);

/**
 * Weekly logical dump to R2 (spec §2.4 #7). Requires `pg_dump` on the runtime; on Vercel
 * serverless it is not available, so this job reports and relies on Supabase PITR – see DEVIATIONS.md.
 */
export async function dbDumpJob() {
  if (!r2Configured()) return { skipped: "r2_not_configured" };
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) return { skipped: "no_database_url" };
  try {
    const { stdout } = await exec("pg_dump", ["--no-owner", "--no-privileges", "--format=plain", url], { maxBuffer: 512 * 1024 * 1024 });
    const key = `db/pgl-${new Date().toISOString().slice(0, 10)}.sql`;
    await r2Put(key, Buffer.from(stdout));
    return { ok: true, key, bytes: stdout.length };
  } catch (e) {
    await notifyEvent({ userIds: await adminUserIds(), type: "backup.failed", title: "כשל ב-dump שבועי של ה-DB", body: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
