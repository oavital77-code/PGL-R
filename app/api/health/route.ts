import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + a timed database round-trip, so a hang can be attributed without server logs. */
export async function GET() {
  const started = Date.now();
  const dbCheck = await Promise.race([
    db
      .execute(sql`select 1`)
      .then(() => ({ ok: true as const, ms: Date.now() - started }))
      .catch((e: unknown) => ({ ok: false as const, ms: Date.now() - started, error: e instanceof Error ? e.message : "error" })),
    new Promise<{ ok: false; ms: number; error: string }>((resolve) => setTimeout(() => resolve({ ok: false, ms: Date.now() - started, error: "timeout" }), 5000)),
  ]);
  return Response.json({ ok: dbCheck.ok, ts: new Date().toISOString(), db: dbCheck }, { status: dbCheck.ok ? 200 : 503 });
}
