import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import { runSeed } from "../lib/db/seed/run";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql, { schema, casing: "snake_case" });
  await runSeed(db);
  await sql.end();
  console.log("seed done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
