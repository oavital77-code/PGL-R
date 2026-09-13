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
  return postgres(url, { prepare: false, max: 10, idle_timeout: 20, connect_timeout: 10 });
}

const sqlClient = globalThis.__pglSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__pglSql = sqlClient;

export const db = drizzle(sqlClient, { schema, casing: "snake_case" });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
