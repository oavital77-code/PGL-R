/** Fixed export columns (spec §11.14). Field mapping in settings renames them for the target software. */
export const ACCOUNTING_EXPORT_FIELDS = [
  "invoice_number",
  "invoice_date",
  "due_date",
  "client_name",
  "client_tax_id",
  "work_number",
  "project_name",
  "subject",
  "before_vat",
  "vat_rate",
  "vat_amount",
  "total",
  "index_diff",
  "retention_amount",
  "status",
  "kind",
  "credit_of",
] as const;

export const ACCOUNTING_RECEIPT_FIELDS = ["receipt_date", "client_name", "client_tax_id", "amount", "method", "reference", "invoice_number", "allocated_amount"] as const;
