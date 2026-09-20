import { sql } from "drizzle-orm";
import postgres from "postgres";
import { db, resolveDatabaseUrl } from "@/lib/db";
import { probeStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Liveness + two timed database round-trips:
 *  - `db`:   through the app's pool (a warm connection when one exists)
 *  - `cold`: a brand-new connection opened for this call only, so the cost of going through
 *            the pooler from this region is visible without server logs.
 */
export async function GET() {
  const cap = <T>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

  const pooled = await time(() => cap(db.execute(sql`select 1`), 5000));
  const cold = await time(async () => {
    const raw = process.env.DATABASE_URL;
    if (!raw) throw new Error("no DATABASE_URL");
    const fresh = postgres(resolveDatabaseUrl(raw).url, { prepare: false, max: 1, connect_timeout: 10 });
    try {
      await cap(fresh`select 1`, 10000);
    } finally {
      await fresh.end({ timeout: 1 }).catch(() => undefined);
    }
  });
  // storage: the service key must be accepted by Supabase, or no PDF can be stored
  const storage = await time(() => cap(probeStorage(), 8000));
  const ok = pooled.ok && cold.ok && storage.ok;
  const pool = process.env.DATABASE_URL ? resolveDatabaseUrl(process.env.DATABASE_URL).mode : null;
  return Response.json({ ok, ts: new Date().toISOString(), region: process.env.VERCEL_REGION ?? null, pool, db: pooled, cold, storage }, { status: ok ? 200 : 503 });
}

async function time(fn: () => Promise<unknown>): Promise<{ ok: boolean; ms: number; error?: string }> {
  const started = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - started };
  } catch (e) {
    return { ok: false, ms: Date.now() - started, error: e instanceof Error ? e.message : "error" };
  }
}
