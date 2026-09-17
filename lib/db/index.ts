import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { guardUnsafe, type Unsafe } from "./guard";
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
  // Supabase pooled connections (transaction mode) require prepare=false.
  // max_pipeline=1: one statement in flight per connection, the conservative setting for a
  // transaction-mode pooler. idle_timeout=5: a connection that is not in use is closed quickly,
  // so as few sockets as possible survive into a frozen instance; the guard handles the rest.
  // (max_pipeline is parsed by the driver but absent from its Options type.)
  const options = { prepare: false, max_pipeline: 1, max: 5, idle_timeout: 5, max_lifetime: 60 * 15, connect_timeout: 10 };
  return postgres(url, options as postgres.Options<Record<string, never>>);
}

let current: { sql: Sql; db: ReturnType<typeof makeDb> };

function makeDb(sql: Sql) {
  const guarded = new Proxy(sql, {
    get: (target, prop, receiver) => (prop === "unsafe" ? guardedUnsafe : Reflect.get(target, prop, receiver)),
  });
  return drizzle(guarded, { schema, casing: "snake_case" });
}

const guardedUnsafe = guardUnsafe(
  () => current.sql as unknown as { unsafe: Unsafe },
  async (reason) => {
    const old = current;
    const sql = createClient();
    current = { sql, db: makeDb(sql) };
    if (process.env.NODE_ENV !== "production") globalThis.__pglDb = current;
    console.warn(`[db] pool reset (${reason})`);
    await old.sql.end({ timeout: 1 }).catch(() => undefined);
  },
  QUERY_TIMEOUT_MS,
);

current = globalThis.__pglDb ?? (() => {
  const sql = createClient();
  return { sql, db: makeDb(sql) };
})();
if (process.env.NODE_ENV !== "production") globalThis.__pglDb = current;

/** Always the live Drizzle instance, even after a pool reset. */
export const db: ReturnType<typeof makeDb> = new Proxy({} as ReturnType<typeof makeDb>, {
  get: (_, prop) => Reflect.get(current.db as object, prop, current.db),
});
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
