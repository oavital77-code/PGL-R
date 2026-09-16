import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __pglSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Supabase pooled connections (transaction mode) require prepare=false.
  // max_pipeline=1: one statement in flight per connection – the conservative setting for a
  // transaction-mode pooler; concurrency comes from the pool, not from pipelining on a socket.
  // Short idle/lifetime windows: a socket that sat through a frozen serverless instance is
  // closed by its own timer on thaw instead of being reused dead.
  // (max_pipeline is parsed by the driver but absent from its Options type.)
  const options = { prepare: false, max_pipeline: 1, max: 5, idle_timeout: 10, max_lifetime: 60, connect_timeout: 10 };
  return postgres(url, options as postgres.Options<Record<string, never>>);
}

const sqlClient = globalThis.__pglSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__pglSql = sqlClient;

export const db = drizzle(sqlClient, { schema, casing: "snake_case" });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
