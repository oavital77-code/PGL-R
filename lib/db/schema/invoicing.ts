import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { baseColumns, softDeleteColumns } from "./_common";
import { contracts, documents, milestones, subContracts } from "./contracts";
import { approvalDecisionEnum, indexSourceEnum, invoiceKindEnum, invoiceLineTypeEnum, invoiceStatusEnum, receiptMethodEnum, supplierInvoiceStatusEnum } from "./enums";
import { grades, users } from "./org";
import { clients } from "./parties";

const ts = (n: string) => timestamp(n, { withTimezone: true });

export const indexValues = pgTable("index_values", {
  ...baseColumns,
  month: date("month").notNull().unique(),
  value: numeric("value", { precision: 10, scale: 4 }).notNull(),
  source: indexSourceEnum("source").notNull().default("manual"),
  fetchedAt: ts("fetched_at"),
  enteredBy: uuid("entered_by").references(() => users.id),
});

export const vatRates = pgTable("vat_rates", {
  ...baseColumns,
  rate: numeric("rate", { precision: 5, scale: 2 }).notNull(),
  effectiveFrom: date("effective_from").notNull().unique(),
});

export const invoices = pgTable(
  "invoices",
  {
    ...baseColumns,
    ...softDeleteColumns,
    invoiceNumber: text("invoice_number").notNull().unique(),
    sequenceNo: integer("sequence_no").notNull(),
    sequenceYear: integer("sequence_year"),
    invoiceKind: invoiceKindEnum("invoice_kind").notNull().default("proforma"),
    creditOfInvoiceId: uuid("credit_of_invoice_id").references((): AnyPgColumn => invoices.id),
    contractId: uuid("contract_id").notNull().references(() => contracts.id),
    clientId: uuid("client_id").notNull().references(() => clients.id),
    payingClientId: uuid("paying_client_id").references(() => clients.id),
    partialNumber: integer("partial_number").notNull(),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    invoiceDate: date("invoice_date").notNull(),
    dueDate: date("due_date"),
    periodFrom: date("period_from"),
    periodTo: date("period_to"),
    subject: text("subject"),
    introText: text("intro_text"),
    notes: text("notes"),
    // linkage
    indexLinked: boolean("index_linked").notNull().default(false),
    indexFloor: boolean("index_floor").notNull().default(false),
    indexBaseMonth: date("index_base_month"),
    indexBaseValue: numeric("index_base_value", { precision: 10, scale: 4 }),
    indexMonth: date("index_month"),
    indexCurrentValue: numeric("index_current_value", { precision: 10, scale: 4 }),
    indexRatio: numeric("index_ratio", { precision: 12, scale: 6 }).notNull().default("1"),
    // snapshot amounts
    cumulativeBase: numeric("cumulative_base", { precision: 12, scale: 2 }).notNull().default("0"),
    receiptsBase: numeric("receipts_base", { precision: 12, scale: 2 }).notNull().default("0"),
    openBase: numeric("open_base", { precision: 12, scale: 2 }).notNull().default("0"),
    subtotalBase: numeric("subtotal_base", { precision: 12, scale: 2 }).notNull().default("0"),
    indexDiff: numeric("index_diff", { precision: 12, scale: 2 }).notNull().default("0"),
    retentionPct: numeric("retention_pct", { precision: 5, scale: 2 }),
    retentionAmount: numeric("retention_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    beforeVat: numeric("before_vat", { precision: 12, scale: 2 }).notNull().default("0"),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    vatExempt: boolean("vat_exempt").notNull().default(false),
    vatExemptReason: text("vat_exempt_reason"),
    vatOverrideReason: text("vat_override_reason"),
    vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    withholdingPct: numeric("withholding_pct", { precision: 5, scale: 2 }),
    expectedReceipt: numeric("expected_receipt", { precision: 12, scale: 2 }),
    // workflow
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: ts("approved_at"),
    signedBy: uuid("signed_by").references(() => users.id),
    signedAt: ts("signed_at"),
    signatureTitleSnapshot: text("signature_title_snapshot"),
    sentAt: ts("sent_at"),
    sentTo: jsonb("sent_to").$type<{ to: { email: string; name?: string }[]; cc: string[] }>(),
    pdfDocumentId: uuid("pdf_document_id").references(() => documents.id),
    cancelledAt: ts("cancelled_at"),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    cancelReason: text("cancel_reason"),
    accountingExportedAt: ts("accounting_exported_at"),
    accountingExportBatchId: uuid("accounting_export_batch_id"),
  },
  (t) => [
    index("invoices_contract_idx").on(t.contractId),
    index("invoices_client_idx").on(t.clientId),
    index("invoices_status_idx").on(t.status),
    index("invoices_date_idx").on(t.invoiceDate),
    unique("invoices_sequence").on(t.sequenceYear, t.sequenceNo),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    ...baseColumns,
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
    subContractId: uuid("sub_contract_id").notNull().references(() => subContracts.id),
    milestoneId: uuid("milestone_id").references(() => milestones.id),
    lineType: invoiceLineTypeEnum("line_type").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    description: text("description"),
    // milestone
    stagePct: numeric("stage_pct", { precision: 6, scale: 3 }),
    stageAmount: numeric("stage_amount", { precision: 12, scale: 2 }),
    progressPctThis: numeric("progress_pct_this", { precision: 6, scale: 3 }),
    cumulativePct: numeric("cumulative_pct", { precision: 6, scale: 3 }),
    amountThis: numeric("amount_this", { precision: 12, scale: 2 }).notNull().default("0"),
    cumulativeAmount: numeric("cumulative_amount", { precision: 12, scale: 2 }),
    // hours
    gradeId: uuid("grade_id").references(() => grades.id),
    userId: uuid("user_id").references(() => users.id),
    hours: numeric("hours", { precision: 10, scale: 2 }),
    hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
    // unit
    quantity: numeric("quantity", { precision: 12, scale: 3 }),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
    cumulativeQuantity: numeric("cumulative_quantity", { precision: 12, scale: 3 }),
    // retainer
    retainerMonth: date("retainer_month"),
  },
  (t) => [index("invoice_lines_invoice_idx").on(t.invoiceId), index("invoice_lines_sc_idx").on(t.subContractId), index("invoice_lines_milestone_idx").on(t.milestoneId)],
);

export const receipts = pgTable(
  "receipts",
  {
    ...baseColumns,
    ...softDeleteColumns,
    clientId: uuid("client_id").notNull().references(() => clients.id),
    receiptDate: date("receipt_date").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    method: receiptMethodEnum("method").notNull().default("transfer"),
    reference: text("reference"),
    notes: text("notes"),
    accountingExportedAt: ts("accounting_exported_at"),
    accountingExportBatchId: uuid("accounting_export_batch_id"),
  },
  (t) => [index("receipts_client_idx").on(t.clientId), index("receipts_date_idx").on(t.receiptDate), check("receipts_amount_positive", sql`${t.amount} > 0`)],
);

export const receiptAllocations = pgTable(
  "receipt_allocations",
  {
    ...baseColumns,
    receiptId: uuid("receipt_id").notNull().references(() => receipts.id),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    cancelledAt: ts("cancelled_at"),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    cancelReason: text("cancel_reason"),
  },
  (t) => [index("receipt_allocations_receipt_idx").on(t.receiptId), index("receipt_allocations_invoice_idx").on(t.invoiceId)],
);

export const supplierInvoices = pgTable(
  "supplier_invoices",
  {
    ...baseColumns,
    ...softDeleteColumns,
    contractId: uuid("contract_id").notNull().references(() => contracts.id),
    supplierInvoiceNumber: text("supplier_invoice_number").notNull(),
    invoiceDate: date("invoice_date").notNull(),
    receivedDate: date("received_date"),
    amountBeforeVat: numeric("amount_before_vat", { precision: 12, scale: 2 }).notNull(),
    vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    description: text("description"),
    progressPctClaimed: numeric("progress_pct_claimed", { precision: 6, scale: 3 }),
    status: supplierInvoiceStatusEnum("status").notNull().default("pending"),
    paidDate: date("paid_date"),
    notes: text("notes"),
    fileDocumentId: uuid("file_document_id").references(() => documents.id),
  },
  (t) => [index("supplier_invoices_contract_idx").on(t.contractId), index("supplier_invoices_status_idx").on(t.status)],
);

export const supplierInvoiceApprovals = pgTable(
  "supplier_invoice_approvals",
  {
    ...baseColumns,
    supplierInvoiceId: uuid("supplier_invoice_id").notNull().references(() => supplierInvoices.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    decision: approvalDecisionEnum("decision").notNull(),
    decidedAt: ts("decided_at").notNull().defaultNow(),
    comment: text("comment"),
  },
  (t) => [unique("supplier_invoice_approvals_unique").on(t.supplierInvoiceId, t.userId)],
);
