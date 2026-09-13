/**
 * Creates the first admin row in `users` (spec §6.1). The Clerk user must exist (created in the
 * Clerk dashboard); on first sign-in the row is linked by e-mail.
 *   pnpm tsx scripts/bootstrap-admin.ts admin@pgl.co.il "עידו" "כהן"
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../lib/db/schema";

async function main() {
  const [email, firstName, lastName] = process.argv.slice(2);
  if (!email || !firstName || !lastName) throw new Error("usage: bootstrap-admin.ts <email> <first> <last>");
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL is not set");
  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);
  await db
    .insert(users)
    .values({ email: email.toLowerCase(), firstName, lastName, role: "admin", isActive: true })
    .onConflictDoUpdate({ target: users.email, set: { role: "admin", isActive: true } });
  await sql.end();
  console.log(`admin ${email} ready`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
