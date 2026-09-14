/**
 * Storage bucket names (spec §2.4). Kept free of `server-only` so scripts (`pnpm storage:init`)
 * can share the same list as the server runtime.
 */
export type Bucket = "contracts" | "invoices" | "supplier-invoices" | "general-docs" | "signatures" | "company" | "imports" | "report-exports";

export const BUCKETS: Bucket[] = ["contracts", "invoices", "supplier-invoices", "general-docs", "signatures", "company", "imports", "report-exports"];
