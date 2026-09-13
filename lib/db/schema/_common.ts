import { sql } from "drizzle-orm";
import { timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { users } from "./org";

/** id / created_at / updated_at / created_by – present on every table. */
export const baseColumns = {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid("created_by").references((): AnyPgColumn => users.id),
};

/** Soft delete for business entities – physical delete is forbidden. */
export const softDeleteColumns = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};
