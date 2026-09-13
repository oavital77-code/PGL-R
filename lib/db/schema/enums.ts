import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "employee"]);
export const localeEnum = pgEnum("locale", ["he", "en"]);
export const clientKindEnum = pgEnum("client_kind", ["company", "authority", "private", "other"]);
export const contractDirectionEnum = pgEnum("contract_direction", ["income", "expense"]);
export const pricingMethodEnum = pgEnum("pricing_method", ["fixed_price", "hourly", "retainer", "pct_of_cost", "per_unit"]);
export const hourlyModeEnum = pgEnum("hourly_mode", ["rate_card", "custom"]);
export const estimateTypeEnum = pgEnum("estimate_type", ["initial", "tender", "execution", "actual", "other"]);
export const documentEntityEnum = pgEnum("document_entity", [
  "project",
  "contract",
  "sub_contract",
  "invoice",
  "supplier_invoice",
  "client",
  "supplier",
  "receipt",
  "company",
  "user",
  "import",
  "report_export",
]);
export const indexSourceEnum = pgEnum("index_source", ["cbs_api", "manual"]);
export const invoiceKindEnum = pgEnum("invoice_kind", ["proforma", "credit"]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "pending_approval",
  "approved",
  "signed",
  "sent",
  "partially_paid",
  "paid",
  "cancelled",
]);
export const invoiceLineTypeEnum = pgEnum("invoice_line_type", ["milestone", "hours", "retainer", "unit", "extra", "adjustment"]);
export const receiptMethodEnum = pgEnum("receipt_method", ["transfer", "check", "credit_card", "cash", "other"]);
export const supplierInvoiceStatusEnum = pgEnum("supplier_invoice_status", ["pending", "partially_approved", "approved", "rejected", "paid"]);
export const approvalDecisionEnum = pgEnum("approval_decision", ["approved", "rejected"]);
export const emailStatusEnum = pgEnum("email_status", ["queued", "sent", "delivered", "opened", "bounced", "failed"]);
export const auditActionEnum = pgEnum("audit_action", ["insert", "update", "delete"]);
export const scheduleFrequencyEnum = pgEnum("schedule_frequency", ["daily", "weekly", "monthly"]);
export const exportFormatEnum = pgEnum("export_format", ["xlsx", "pdf"]);
export const importStatusEnum = pgEnum("import_status", ["validating", "ready", "importing", "done", "failed", "rolled_back"]);
