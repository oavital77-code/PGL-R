import { sql } from "drizzle-orm";
import { boolean, date, index, integer, numeric, pgTable, text, timestamp, unique, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { localeEnum, userRoleEnum } from "./enums";

const ts = (n: string) => timestamp(n, { withTimezone: true });

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  managerUserId: uuid("manager_user_id").references((): AnyPgColumn => users.id),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references((): AnyPgColumn => users.id),
});

export const grades = pgTable("grades", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references((): AnyPgColumn => users.id),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    clerkUserId: text("clerk_user_id").unique(),
    email: text("email").notNull().unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    role: userRoleEnum("role").notNull().default("employee"),
    departmentId: uuid("department_id").references(() => departments.id),
    gradeId: uuid("grade_id").references(() => grades.id),
    standardHoursPerDay: numeric("standard_hours_per_day", { precision: 4, scale: 2 }),
    workDays: integer("work_days").array().notNull().default(sql`'{0,1,2,3,4}'::int[]`),
    employmentStart: date("employment_start"),
    employmentEnd: date("employment_end"),
    isActive: boolean("is_active").notNull().default(true),
    locale: localeEnum("locale").notNull().default("he"),
    phone: text("phone"),
    signatureImagePath: text("signature_image_path"),
    signatureTitle: text("signature_title"),
    externalPayrollId: text("external_payroll_id"),
    invitedAt: ts("invited_at"),
    lastSeenAt: ts("last_seen_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references((): AnyPgColumn => users.id),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("users_department_idx").on(t.departmentId), index("users_role_idx").on(t.role)],
);

export const employeeCostRates = pgTable(
  "employee_cost_rates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull().references(() => users.id),
    hourlyCost: numeric("hourly_cost", { precision: 10, scale: 2 }).notNull(),
    effectiveFrom: date("effective_from").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (t) => [unique("employee_cost_rates_user_from").on(t.userId, t.effectiveFrom), index("employee_cost_rates_user_idx").on(t.userId)],
);

export const billingRates = pgTable(
  "billing_rates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    gradeId: uuid("grade_id").notNull().references(() => grades.id),
    hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull(),
    effectiveFrom: date("effective_from").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (t) => [unique("billing_rates_grade_from").on(t.gradeId, t.effectiveFrom), index("billing_rates_grade_idx").on(t.gradeId)],
);
