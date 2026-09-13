import { sql } from "drizzle-orm";
import { bigint, boolean, char, check, date, index, integer, numeric, pgTable, text, timestamp, unique, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { baseColumns, softDeleteColumns } from "./_common";
import { contractDirectionEnum, documentEntityEnum, estimateTypeEnum, hourlyModeEnum, pricingMethodEnum } from "./enums";
import { departments, users } from "./org";
import { clients, contacts, suppliers } from "./parties";

const ts = (n: string) => timestamp(n, { withTimezone: true });

/* ---------------------------------- lookups ---------------------------------- */

export const contractStatuses = pgTable("contract_statuses", {
  ...baseColumns,
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  isTerminal: boolean("is_terminal").notNull().default(false),
});

export const contractTypes = pgTable("contract_types", {
  ...baseColumns,
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const unitTypes = pgTable("unit_types", {
  ...baseColumns,
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const stageNames = pgTable("stage_names", {
  ...baseColumns,
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const stageTemplates = pgTable("stage_templates", {
  ...baseColumns,
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
});

export const stageTemplateItems = pgTable(
  "stage_template_items",
  {
    ...baseColumns,
    templateId: uuid("template_id").notNull().references(() => stageTemplates.id, { onDelete: "cascade" }),
    stageNameId: uuid("stage_name_id").notNull().references(() => stageNames.id),
    defaultPct: numeric("default_pct", { precision: 6, scale: 3 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("stage_template_items_template_idx").on(t.templateId)],
);

export const documentTypes = pgTable("document_types", {
  ...baseColumns,
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* ---------------------------------- projects ---------------------------------- */

export const projects = pgTable(
  "projects",
  {
    ...baseColumns,
    ...softDeleteColumns,
    workNumber: text("work_number").notNull().unique(),
    name: text("name").notNull(),
    clientId: uuid("client_id").notNull().references(() => clients.id),
    payingClientId: uuid("paying_client_id").references(() => clients.id),
    projectManagerUserId: uuid("project_manager_user_id").references(() => users.id),
    departmentId: uuid("department_id").references(() => departments.id),
    statusId: uuid("status_id").references(() => contractStatuses.id),
    statusManual: boolean("status_manual").notNull().default(false),
    description: text("description"),
    startDate: date("start_date"),
    targetDate: date("target_date"),
    actualEndDate: date("actual_end_date"),
    notes: text("notes"),
  },
  (t) => [
    index("projects_client_idx").on(t.clientId),
    index("projects_pm_idx").on(t.projectManagerUserId),
    index("projects_department_idx").on(t.departmentId),
    index("projects_status_idx").on(t.statusId),
    index("projects_name_idx").on(t.name),
  ],
);

/* ---------------------------------- contracts ---------------------------------- */

export const contracts = pgTable(
  "contracts",
  {
    ...baseColumns,
    ...softDeleteColumns,
    projectId: uuid("project_id").notNull().references(() => projects.id),
    direction: contractDirectionEnum("direction").notNull(),
    clientId: uuid("client_id").references(() => clients.id),
    payingClientId: uuid("paying_client_id").references(() => clients.id),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    numberInProject: integer("number_in_project").notNull(),
    name: text("name").notNull(),
    orderNumber: text("order_number"),
    contractTypeId: uuid("contract_type_id").references(() => contractTypes.id),
    statusId: uuid("status_id").references(() => contractStatuses.id),
    statusManual: boolean("status_manual").notNull().default(false),
    signedDate: date("signed_date"),
    openingDate: date("opening_date"),
    targetDate: date("target_date"),
    actualEndDate: date("actual_end_date"),
    description: text("description"),
    currency: char("currency", { length: 3 }).notNull().default("ILS"),
    indexLinked: boolean("index_linked").notNull().default(false),
    indexBaseMonth: date("index_base_month"),
    indexFloor: boolean("index_floor").notNull().default(false),
    participatesInHours: boolean("participates_in_hours").notNull().default(true),
    retentionPct: numeric("retention_pct", { precision: 5, scale: 2 }),
    budgetAmount: numeric("budget_amount", { precision: 12, scale: 2 }),
    isLocked: boolean("is_locked").notNull().default(false),
    notes: text("notes"),
  },
  (t) => [
    unique("contracts_project_direction_number").on(t.projectId, t.direction, t.numberInProject),
    index("contracts_project_idx").on(t.projectId),
    index("contracts_client_idx").on(t.clientId),
    index("contracts_supplier_idx").on(t.supplierId),
    index("contracts_status_idx").on(t.statusId),
    check("contracts_party_by_direction", sql`(${t.direction} = 'income' and ${t.clientId} is not null) or (${t.direction} = 'expense' and ${t.supplierId} is not null)`),
    check("contracts_index_base_when_linked", sql`${t.indexLinked} = false or ${t.indexBaseMonth} is not null`),
    check("contracts_currency_ils", sql`${t.currency} = 'ILS'`),
  ],
);

export const subContracts = pgTable(
  "sub_contracts",
  {
    ...baseColumns,
    ...softDeleteColumns,
    contractId: uuid("contract_id").notNull().references(() => contracts.id),
    numberInContract: integer("number_in_contract").notNull(),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    statusId: uuid("status_id").references(() => contractStatuses.id),
    openingDate: date("opening_date"),
    departmentId: uuid("department_id").references(() => departments.id),
    pricingMethod: pricingMethodEnum("pricing_method").notNull(),
    // fixed_price
    basePrice: numeric("base_price", { precision: 12, scale: 2 }),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }).notNull().default("0"),
    // hourly
    hourlyMode: hourlyModeEnum("hourly_mode"),
    customHourlyRate: numeric("custom_hourly_rate", { precision: 10, scale: 2 }),
    hoursCap: numeric("hours_cap", { precision: 10, scale: 2 }),
    amountCap: numeric("amount_cap", { precision: 12, scale: 2 }),
    // retainer
    monthlyAmount: numeric("monthly_amount", { precision: 12, scale: 2 }),
    retainerStart: date("retainer_start"),
    retainerEnd: date("retainer_end"),
    retainerBillingDay: integer("retainer_billing_day"),
    // pct_of_cost
    feePct: numeric("fee_pct", { precision: 6, scale: 3 }),
    // per_unit
    unitTypeId: uuid("unit_type_id").references(() => unitTypes.id),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
    agreedQuantity: numeric("agreed_quantity", { precision: 12, scale: 3 }),
    // general
    indexLinked: boolean("index_linked").notNull().default(false),
    indexFloor: boolean("index_floor").notNull().default(false),
    indexBaseMonth: date("index_base_month"),
    participatesInHours: boolean("participates_in_hours").notNull().default(true),
    isLocked: boolean("is_locked").notNull().default(false),
    notes: text("notes"),
  },
  (t) => [
    unique("sub_contracts_contract_number").on(t.contractId, t.numberInContract),
    index("sub_contracts_contract_idx").on(t.contractId),
    index("sub_contracts_status_idx").on(t.statusId),
    index("sub_contracts_department_idx").on(t.departmentId),
    check("sub_contracts_retainer_day", sql`${t.retainerBillingDay} is null or (${t.retainerBillingDay} between 1 and 28)`),
  ],
);

export const projectCostEstimates = pgTable(
  "project_cost_estimates",
  {
    ...baseColumns,
    subContractId: uuid("sub_contract_id").notNull().references(() => subContracts.id),
    estimateType: estimateTypeEnum("estimate_type").notNull().default("initial"),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    effectiveFrom: date("effective_from").notNull(),
    note: text("note"),
  },
  (t) => [index("project_cost_estimates_sc_idx").on(t.subContractId)],
);

export const milestones = pgTable(
  "milestones",
  {
    ...baseColumns,
    ...softDeleteColumns,
    subContractId: uuid("sub_contract_id").notNull().references(() => subContracts.id),
    sortOrder: integer("sort_order").notNull().default(0),
    stageNameId: uuid("stage_name_id").references(() => stageNames.id),
    name: text("name").notNull(),
    pctOfSubcontract: numeric("pct_of_subcontract", { precision: 6, scale: 3 }).notNull(),
    discountPct: numeric("discount_pct", { precision: 5, scale: 2 }),
    openingBilledPct: numeric("opening_billed_pct", { precision: 6, scale: 3 }).notNull().default("0"),
    openingPaidAmount: numeric("opening_paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    expectedDate: date("expected_date"),
    notes: text("notes"),
  },
  (t) => [
    index("milestones_sc_idx").on(t.subContractId),
    check("milestones_pct_range", sql`${t.pctOfSubcontract} >= 0 and ${t.pctOfSubcontract} <= 100`),
    check("milestones_opening_pct_range", sql`${t.openingBilledPct} >= 0 and ${t.openingBilledPct} <= 100`),
  ],
);

export const contractRoles = pgTable(
  "contract_roles",
  {
    ...baseColumns,
    ...softDeleteColumns,
    contractId: uuid("contract_id").notNull().references(() => contracts.id),
    roleTitle: text("role_title").notNull(),
    userId: uuid("user_id").references(() => users.id),
    contactId: uuid("contact_id").references(() => contacts.id),
    freeName: text("free_name"),
    notes: text("notes"),
  },
  (t) => [index("contract_roles_contract_idx").on(t.contractId)],
);

export const contractNotes = pgTable(
  "contract_notes",
  {
    ...baseColumns,
    ...softDeleteColumns,
    contractId: uuid("contract_id").notNull().references(() => contracts.id),
    subContractId: uuid("sub_contract_id").references(() => subContracts.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    body: text("body").notNull(),
  },
  (t) => [index("contract_notes_contract_idx").on(t.contractId), index("contract_notes_sc_idx").on(t.subContractId)],
);

export const documents = pgTable(
  "documents",
  {
    ...baseColumns,
    ...softDeleteColumns,
    entityType: documentEntityEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    documentType: text("document_type"),
    fileName: text("file_name").notNull(),
    storageBucket: text("storage_bucket").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    version: integer("version").notNull().default(1),
    supersedesDocumentId: uuid("supersedes_document_id").references((): AnyPgColumn => documents.id),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    backedUpAt: ts("backed_up_at"),
  },
  (t) => [index("documents_entity_idx").on(t.entityType, t.entityId), unique("documents_bucket_path").on(t.storageBucket, t.storagePath)],
);

export const subContractAssignments = pgTable(
  "sub_contract_assignments",
  {
    ...baseColumns,
    subContractId: uuid("sub_contract_id").notNull().references(() => subContracts.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    assignedBy: uuid("assigned_by").references(() => users.id),
    assignedAt: ts("assigned_at").notNull().defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [unique("sub_contract_assignments_sc_user").on(t.subContractId, t.userId), index("sub_contract_assignments_user_idx").on(t.userId)],
);
