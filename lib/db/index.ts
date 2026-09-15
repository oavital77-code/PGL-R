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
  // Serverless hygiene: few connections per instance, recycle them before the pooler does,
  // TCP keep-alive so a socket dropped while the instance was frozen is noticed, and no
  // type-fetch round-trip on connect.
  return postgres(url, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    max_lifetime: 60 * 5,
    connect_timeout: 10,
    keep_alive: 30,
    fetch_types: false,
  });
}

const sqlClient = globalThis.__pglSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__pglSql = sqlClient;

export const db = drizzle(sqlClient, { schema, casing: "snake_case" });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
