import "server-only";
import type { ReportDef } from "./types";
import * as hours from "./queries/hours";
import * as fin from "./queries/financial";

/** Report registry (spec §12.2): adding a report = adding an entry. */
export const REPORTS: ReportDef[] = [
  { key: "hours.monthly_by_employee", group: "hours", requiredCapability: "reports.hours", filters: ["month", "departments", "users", "includeInactive"], chartOptions: [{ metric: "total", kinds: ["bar"] }], query: hours.monthlyByEmployee },
  { key: "hours.employees_projects", group: "hours", requiredCapability: "reports.hours", filters: ["dateRange", "departments", "users", "projects", "includeInactive"], chartOptions: [{ metric: "hours", kinds: ["bar", "pie"] }], query: hours.employeesProjects },
  { key: "hours.by_project", group: "hours", requiredCapability: "reports.hours", filters: ["dateRange", "clients", "projects", "departments", "users"], chartOptions: [{ metric: "hours", kinds: ["bar", "pie"] }], query: hours.byProject },
  { key: "hours.project_summary", group: "hours", requiredCapability: "reports.hours", filters: ["dateRange", "clients", "projects", "pms"], chartOptions: [{ metric: "hours_period", kinds: ["bar"] }], query: hours.projectSummary },
  { key: "hours.project_matrix", group: "hours", requiredCapability: "reports.hours", filters: ["dateRange", "projects"], chartOptions: [{ metric: "total", kinds: ["bar"] }], query: hours.projectMatrix },
  { key: "hours.matrix_summary", group: "hours", requiredCapability: "reports.hours", filters: ["dateRange", "clients", "departments"], groupByOptions: ["client", "department"], chartOptions: [{ metric: "total", kinds: ["bar", "line"] }], query: hours.matrixSummary },
  { key: "hours.by_client", group: "hours", requiredCapability: "reports.hours", filters: ["dateRange", "clients"], chartOptions: [{ metric: "hours", kinds: ["bar", "pie"] }], query: hours.byClient },
  { key: "hours.detailed", group: "hours", requiredCapability: "reports.hours", filters: ["dateRange", "users", "projects", "subContracts", "departments"], chartOptions: [], query: hours.detailed },
  { key: "hours.by_department", group: "hours", requiredCapability: "reports.hours", filters: ["dateRange", "departments"], chartOptions: [{ metric: "hours", kinds: ["pie", "bar"] }], query: hours.byDepartment },
  { key: "hours.missing", group: "hours", requiredCapability: "reports.hours", filters: ["dateRange", "departments", "users"], chartOptions: [{ metric: "missing_days", kinds: ["bar"] }], query: hours.missing },
  { key: "fin.contract_balances", group: "contracts", requiredCapability: "reports.financial", filters: ["dateRange", "clients", "projects", "pms", "statuses", "pricingMethods", "includeInactive", "showMonths", "incomeMode"], chartOptions: [{ metric: "remaining", kinds: ["bar"] }, { metric: "profit", kinds: ["bar"] }], query: fin.contractBalances },
  { key: "fin.hours_and_cost", group: "financial", requiredCapability: "reports.financial", filters: ["dateRange", "projects", "users", "departments"], chartOptions: [{ metric: "cost", kinds: ["bar"] }], query: fin.hoursAndCost },
  { key: "fin.cost_by_project", group: "financial", requiredCapability: "reports.financial", filters: ["dateRange", "clients", "projects", "pms"], chartOptions: [{ metric: "total_cost", kinds: ["bar"] }], query: fin.costByProject },
  { key: "fin.profit_by_client", group: "financial", requiredCapability: "reports.financial", filters: ["clients", "incomeMode", "includeInactive"], chartOptions: [{ metric: "profit", kinds: ["bar"] }], query: fin.profitByClient },
  { key: "fin.profit_by_project", group: "financial", requiredCapability: "reports.financial", filters: ["clients", "projects", "pms", "incomeMode", "includeInactive"], chartOptions: [{ metric: "profit", kinds: ["bar"] }], query: fin.profitByProject },
  { key: "fin.profit_by_subcontract", group: "financial", requiredCapability: "reports.financial", filters: ["clients", "projects", "pricingMethods", "incomeMode", "includeInactive"], chartOptions: [{ metric: "profit", kinds: ["bar"] }], query: fin.profitBySubContract },
  { key: "fin.income_plan_vs_actual", group: "financial", requiredCapability: "reports.financial", filters: ["dateRange", "clients", "projects"], chartOptions: [{ metric: "actual", kinds: ["bar", "line"] }], query: fin.incomePlanVsActual },
  { key: "fin.invoices", group: "contracts", requiredCapability: "reports.financial", filters: ["dateRange", "clients", "projects", "invoiceStatuses"], chartOptions: [{ metric: "total", kinds: ["bar"] }], query: fin.invoicesReport },
  { key: "fin.aging", group: "contracts", requiredCapability: "reports.financial", filters: ["clients"], chartOptions: [{ metric: "balance", kinds: ["bar", "pie"] }], query: fin.aging },
  { key: "fin.receipts", group: "contracts", requiredCapability: "reports.financial", filters: ["dateRange", "clients"], chartOptions: [{ metric: "amount", kinds: ["bar"] }], query: fin.receiptsReport },
  { key: "sup.budget_vs_actual", group: "suppliers", requiredCapability: "reports.financial", filters: ["suppliers", "projects", "includeInactive"], chartOptions: [{ metric: "approved", kinds: ["bar"] }], query: fin.supplierBudgetVsActual },
  { key: "sup.invoices", group: "suppliers", requiredCapability: "reports.financial", filters: ["dateRange", "suppliers", "projects"], chartOptions: [{ metric: "before_vat", kinds: ["bar"] }], query: fin.supplierInvoicesReport },
  { key: "payroll.export", group: "payroll", requiredCapability: "reports.hours", filters: ["month", "departments", "users", "includeInactive"], chartOptions: [], query: hours.payrollExport },
  { key: "sys.audit", group: "system", requiredCapability: "audit.view", filters: ["dateRange", "users"], chartOptions: [], query: fin.auditReport },
];

export function getReport(key: string): ReportDef | undefined {
  return REPORTS.find((r) => r.key === key);
}
