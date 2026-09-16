import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __pglDb: { sql: ReturnType<typeof postgres>; db: ReturnType<typeof makeDb> } | undefined;
}

/** A query that has not answered in this long is treated as lost: it fails fast and the pool is rebuilt. */
const QUERY_TIMEOUT_MS = 20_000;

export class DbTimeoutError extends Error {
  constructor() {
    super(`database query exceeded ${QUERY_TIMEOUT_MS}ms`);
    this.name = "DbTimeoutError";
  }
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Supabase pooled connections (transaction mode) require prepare=false.
  // max_pipeline=1: postgres.js pipelines up to 100 statements per socket by default; through a
  // transaction-mode pooler that crossed parameters between concurrent statements (a uuid filter
  // received the "false" of a neighbouring is_read = $1) and left requests waiting forever.
  // One statement in flight per connection is what the pooler actually supports.
  // Short idle/lifetime windows: a socket that sat through a frozen serverless instance is
  // closed by its own timer on thaw instead of being reused dead.
  // (max_pipeline is parsed by the driver but absent from its Options type.)
  const options = { prepare: false, max_pipeline: 1, max: 5, idle_timeout: 10, max_lifetime: 60, connect_timeout: 10 };
  return postgres(url, options as postgres.Options<Record<string, never>>);
}

type Sql = ReturnType<typeof postgres>;
type Pending = ReturnType<Sql["unsafe"]>;

function timed<T>(p: PromiseLike<T>, onTimeout: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new DbTimeoutError());
    }, QUERY_TIMEOUT_MS);
  });
  return Promise.race([p, guard]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/** Wrap the driver so every statement Drizzle issues is bounded by QUERY_TIMEOUT_MS. */
function guarded(sql: Sql): Sql {
  const unsafe = ((query: string, params?: unknown[], options?: unknown) => {
    const pending = (sql.unsafe as (q: string, p?: unknown[], o?: unknown) => Pending)(query, params, options);
    const lost = () => {
      void resetDb("query timeout");
      (pending as unknown as { cancel?: () => Promise<unknown> }).cancel?.().catch(() => undefined);
    };
    const wrapped = timed(pending, lost) as Promise<unknown> & Record<string, unknown>;
    for (const m of ["values", "raw", "execute", "describe"] as const) {
      const fn = (pending as unknown as Record<string, () => PromiseLike<unknown>>)[m];
      if (typeof fn === "function") wrapped[m] = () => timed(fn.call(pending), lost);
    }
    return wrapped;
  }) as unknown as Sql["unsafe"];
  return new Proxy(sql, { get: (target, prop, receiver) => (prop === "unsafe" ? unsafe : Reflect.get(target, prop, receiver)) });
}

function makeDb(sql: Sql) {
  return drizzle(guarded(sql), { schema, casing: "snake_case" });
}

let current = globalThis.__pglDb ?? { sql: createClient(), db: undefined as unknown as ReturnType<typeof makeDb> };
if (!current.db) current = { sql: current.sql, db: makeDb(current.sql) };
if (process.env.NODE_ENV !== "production") globalThis.__pglDb = current;

/** Drop every socket and start over – after a lost query the pool may hold dead connections. */
export async function resetDb(reason: string): Promise<void> {
  const old = current;
  const sql = createClient();
  current = { sql, db: makeDb(sql) };
  if (process.env.NODE_ENV !== "production") globalThis.__pglDb = current;
  console.warn(`[db] pool reset (${reason})`);
  await old.sql.end({ timeout: 1 }).catch(() => undefined);
}

/** Always the live Drizzle instance, even after a pool reset. */
export const db: ReturnType<typeof makeDb> = new Proxy({} as ReturnType<typeof makeDb>, {
  get: (_, prop) => Reflect.get(current.db as object, prop, current.db),
});
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
