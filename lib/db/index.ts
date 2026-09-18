import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import { after } from "next/server";
import postgres from "postgres";
import { guardUnsafe, type Unsafe } from "./guard";
import { makeReleaser } from "./release";
import { resolveDatabaseUrl } from "./url";
import * as schema from "./schema";

export { DbTimeoutError } from "./guard";
export { resolveDatabaseUrl } from "./url";

declare global {
  var __pglDb: { sql: ReturnType<typeof postgres>; db: ReturnType<typeof makeDb> } | undefined;
}

/** A statement that has not answered in this long is treated as lost (see guard.ts). */
const QUERY_TIMEOUT_MS = 8_000;

type Sql = ReturnType<typeof postgres>;

function createClient(): Sql {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  const { url } = resolveDatabaseUrl(raw);
  // Transaction-mode pooler: prepare=false (no named statements across server connections) and
  // max_pipeline=1 (one statement in flight per connection – the pooler crossed the parameters
  // of pipelined statements). Connections are released after every response (release.ts), so
  // every request opens its own: max=3 keeps that to three handshakes per request, and
  // connect_timeout=5 turns a stalled handshake into a CONNECT_TIMEOUT the guard retries on a
  // fresh pool well before its own 8 s limit. idle_timeout is only the fallback for code that
  // runs outside a request. (max_pipeline is parsed by the driver but absent from its Options type.)
  const options = { prepare: false, max_pipeline: 1, max: 3, idle_timeout: 5, max_lifetime: 60 * 15, connect_timeout: 5 };
  return postgres(url, options as postgres.Options<Record<string, never>>);
}

let current: { sql: Sql; db: ReturnType<typeof makeDb> };

function makeDb(sql: Sql) {
  const guarded = new Proxy(sql, {
    get: (target, prop, receiver) => (prop === "unsafe" ? guardedUnsafe : Reflect.get(target, prop, receiver)),
  });
  return drizzle(guarded, { schema, casing: "snake_case" });
}

/** Replaces the live pool with an empty one; the old pool closes as its connections go idle. */
async function swapPool(): Promise<Sql> {
  const old = current;
  const sql = createClient();
  current = { sql, db: makeDb(sql) };
  if (process.env.NODE_ENV !== "production") globalThis.__pglDb = current;
  return old.sql;
}

const releaseAfterResponse = makeReleaser(after, async () => {
  const old = await swapPool();
  await old.end().catch(() => undefined);
});

const guardedUnsafe = guardUnsafe(
  () => {
    releaseAfterResponse();
    return current.sql as unknown as { unsafe: Unsafe };
  },
  async (reason) => {
    const old = await swapPool();
    console.warn(`[db] pool reset (${reason})`);
    await old.end({ timeout: 1 }).catch(() => undefined);
  },
  QUERY_TIMEOUT_MS,
);

current = globalThis.__pglDb ?? (() => {
  const sql = createClient();
  return { sql, db: makeDb(sql) };
})();
if (process.env.NODE_ENV !== "production") globalThis.__pglDb = current;

/** Always the live Drizzle instance, even after a pool swap. */
export const db: ReturnType<typeof makeDb> = new Proxy({} as ReturnType<typeof makeDb>, {
  get: (_, prop) => Reflect.get(current.db as object, prop, current.db),
});
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
