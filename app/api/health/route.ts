import { sql } from "drizzle-orm";
import postgres from "postgres";
import { db } from "@/lib/db";

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
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("no DATABASE_URL");
    const fresh = postgres(url, { prepare: false, max: 1, connect_timeout: 10 });
    try {
      await cap(fresh`select 1`, 10000);
    } finally {
      await fresh.end({ timeout: 1 }).catch(() => undefined);
    }
  });
  const ok = pooled.ok && cold.ok;
  return Response.json({ ok, ts: new Date().toISOString(), region: process.env.VERCEL_REGION ?? null, db: pooled, cold }, { status: ok ? 200 : 503 });
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
