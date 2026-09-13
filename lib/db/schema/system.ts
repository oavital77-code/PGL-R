import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { baseColumns } from "./_common";
import { documents } from "./contracts";
import { auditActionEnum, emailStatusEnum, exportFormatEnum, importStatusEnum, scheduleFrequencyEnum } from "./enums";
import { users } from "./org";

const ts = (n: string) => timestamp(n, { withTimezone: true });

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull().references(() => users.id),
    type: text("type").notNull(),
    /** de-duplication key, e.g. "invoice_aging:{invoiceId}:60" */
    dedupeKey: text("dedupe_key"),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    isRead: boolean("is_read").notNull().default(false),
    emailSentAt: ts("email_sent_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.isRead), index("notifications_dedupe_idx").on(t.dedupeKey)],
);

export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    resendMessageId: text("resend_message_id"),
    toAddresses: jsonb("to_addresses").$type<string[]>().notNull(),
    ccAddresses: jsonb("cc_addresses").$type<string[]>(),
    subject: text("subject").notNull(),
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: uuid("related_entity_id"),
    status: emailStatusEnum("status").notNull().default("queued"),
    events: jsonb("events").$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    error: text("error"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("email_log_resend_idx").on(t.resendMessageId), index("email_log_entity_idx").on(t.relatedEntityType, t.relatedEntityId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    tableName: text("table_name").notNull(),
    recordId: uuid("record_id").notNull(),
    action: auditActionEnum("action").notNull(),
    changedBy: uuid("changed_by"),
    changedAt: ts("changed_at").notNull().defaultNow(),
    before: jsonb("before"),
    after: jsonb("after"),
    requestId: text("request_id"),
  },
  (t) => [index("audit_log_record_idx").on(t.tableName, t.recordId), index("audit_log_user_idx").on(t.changedBy, t.changedAt)],
);

export const reportTemplates = pgTable(
  "report_templates",
  {
    ...baseColumns,
    name: text("name").notNull(),
    ownerUserId: uuid("owner_user_id").notNull().references(() => users.id),
    reportType: text("report_type").notNull(),
    config: jsonb("config").notNull(),
    isShared: boolean("is_shared").notNull().default(false),
  },
  (t) => [index("report_templates_owner_idx").on(t.ownerUserId)],
);

export const reportSchedules = pgTable(
  "report_schedules",
  {
    ...baseColumns,
    templateId: uuid("template_id").notNull().references(() => reportTemplates.id),
    frequency: scheduleFrequencyEnum("frequency").notNull(),
    dayOfWeek: integer("day_of_week"),
    dayOfMonth: integer("day_of_month"),
    hour: integer("hour").notNull().default(7),
    recipients: jsonb("recipients").$type<string[]>().notNull(),
    format: exportFormatEnum("format").notNull().default("xlsx"),
    isActive: boolean("is_active").notNull().default(true),
    lastRunAt: ts("last_run_at"),
    nextRunAt: ts("next_run_at"),
    lastError: text("last_error"),
  },
  (t) => [index("report_schedules_next_idx").on(t.isActive, t.nextRunAt)],
);

export const importBatches = pgTable("import_batches", {
  ...baseColumns,
  entity: text("entity").notNull(),
  fileDocumentId: uuid("file_document_id").references(() => documents.id),
  status: importStatusEnum("status").notNull().default("validating"),
  rowsTotal: integer("rows_total").notNull().default(0),
  rowsOk: integer("rows_ok").notNull().default(0),
  rowsFailed: integer("rows_failed").notNull().default(0),
  log: jsonb("log").$type<unknown>().notNull().default(sql`'[]'::jsonb`),
  createdRecordIds: jsonb("created_record_ids").$type<Record<string, string[]>>(),
  runBy: uuid("run_by").references(() => users.id),
});
