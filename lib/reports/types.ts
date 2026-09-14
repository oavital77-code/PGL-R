import type { Capability } from "@/lib/auth/capabilities";
import type { SessionUser } from "@/lib/auth/current-user";

export type ColumnType = "text" | "money" | "pct" | "hours" | "number" | "date" | "month";

export interface ReportColumn {
  key: string;
  /** i18n key under reports.columns (falls back to the key itself) */
  label: string;
  type: ColumnType;
  /** hidden for users without reports.financial */
  financial?: boolean;
  /** column group (spec §12.4 contract balances) */
  group?: string;
  /** hidden by default – toggle in the column picker */
  hidden?: boolean;
  /** summed in the totals row */
  sum?: boolean;
  /** inline-editable status note (contract balances) */
  editable?: "note";
}

export interface ReportRow {
  id: string;
  parentId?: string;
  level: number;
  cells: Record<string, unknown>;
  link?: string;
  warnings?: string[];
  /** entity for inline edits */
  entity?: { type: string; id: string };
}

export interface ReportResult {
  columns: ReportColumn[];
  rows: ReportRow[];
  totals?: Record<string, number>;
}

export interface ReportParams {
  from?: string;
  to?: string;
  month?: string;
  clientIds?: string[];
  projectIds?: string[];
  contractIds?: string[];
  subContractIds?: string[];
  departmentIds?: string[];
  userIds?: string[];
  pmIds?: string[];
  statusCodes?: string[];
  pricingMethods?: string[];
  supplierIds?: string[];
  invoiceStatuses?: string[];
  includeInactive?: boolean;
  groupBy?: string[];
  showMonths?: boolean;
  incomeMode?: "submitted" | "completed_milestones";
  compare?: boolean;
}

export type FilterKey = "dateRange" | "month" | "clients" | "projects" | "contracts" | "subContracts" | "departments" | "users" | "pms" | "statuses" | "pricingMethods" | "suppliers" | "invoiceStatuses" | "includeInactive" | "incomeMode" | "showMonths";

export type ReportGroup = "hours" | "financial" | "contracts" | "suppliers" | "payroll" | "system";

export interface ReportDef {
  key: string;
  group: ReportGroup;
  requiredCapability: Capability;
  filters: FilterKey[];
  groupByOptions?: string[];
  defaultGroupBy?: string[];
  chartOptions: { metric: string; kinds: ("bar" | "line" | "pie")[] }[];
  query: (p: ReportParams, user: SessionUser) => Promise<ReportResult>;
}

export function defaultRange(p: ReportParams): { from: string; to: string } {
  const today = new Date().toISOString().slice(0, 10);
  return { from: p.from ?? `${today.slice(0, 4)}-01-01`, to: p.to ?? today };
}

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const ey = Number(to.slice(0, 4));
  const em = Number(to.slice(5, 7));
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
