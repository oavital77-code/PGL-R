import { sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, text, time, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { baseColumns, softDeleteColumns } from "./_common";
import { subContracts } from "./contracts";
import { users } from "./org";
import { invoices } from "./invoicing";

export const timeEntries = pgTable(
  "time_entries",
  {
    ...baseColumns,
    ...softDeleteColumns,
    userId: uuid("user_id").notNull().references(() => users.id),
    subContractId: uuid("sub_contract_id").notNull().references(() => subContracts.id),
    workDate: date("work_date").notNull(),
    minutes: integer("minutes").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    description: text("description").notNull(),
    reportedByUserId: uuid("reported_by_user_id").notNull().references(() => users.id),
    invoiceId: uuid("invoice_id").references((): AnyPgColumn => invoices.id),
  },
  (t) => [
    index("time_entries_user_date_idx").on(t.userId, t.workDate),
    index("time_entries_sc_date_idx").on(t.subContractId, t.workDate),
    index("time_entries_invoice_idx").on(t.invoiceId),
    check("time_entries_minutes_range", sql`${t.minutes} > 0 and ${t.minutes} <= 1440`),
    check("time_entries_description_len", sql`length(trim(${t.description})) >= 3`),
  ],
);

export const periodUnlocks = pgTable(
  "period_unlocks",
  {
    ...baseColumns,
    userId: uuid("user_id").notNull().references(() => users.id),
    month: date("month").notNull(),
    unlockedBy: uuid("unlocked_by").notNull().references(() => users.id),
    unlockedUntil: timestamp("unlocked_until", { withTimezone: true }).notNull(),
    reason: text("reason").notNull(),
  },
  (t) => [index("period_unlocks_user_month_idx").on(t.userId, t.month)],
);
