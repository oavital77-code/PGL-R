import "server-only";
import { and, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { suppliers } from "@/lib/db/schema";

/** Distinct supplier fields for autocomplete (spec §7.2). */
export async function supplierFields(): Promise<string[]> {
  const rows = await db.selectDistinct({ f: suppliers.field }).from(suppliers).where(and(isNull(suppliers.deletedAt), sql`${suppliers.field} is not null`));
  return rows.map((r) => r.f!).filter(Boolean).sort();
}
