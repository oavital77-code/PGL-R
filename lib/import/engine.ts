import "server-only";
import { isNull, sql, inArray } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { getSettingFresh, setSetting } from "@/lib/settings/service";
import { contractBalancesReport } from "@/lib/reports/balances";
import { parseHHMM } from "@/lib/i18n/format";
import type { ParsedRow } from "./parse";

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const f2 = (v: unknown) => (v === null || v === undefined ? null : Number(v).toFixed(2));
const f3 = (v: unknown) => (v === null || v === undefined ? null : Number(v).toFixed(3));
const bool = (v: unknown, d: boolean) => (v === null || v === undefined ? d : Boolean(v));

/** Lookup maps loaded once per batch. */
async function ctxMaps(tx: Tx | typeof db) {
  const [dep, gr, st, users, cl, su, ut, ct, sn, pr, co, sc, ms, inv, rc] = await Promise.all([
    tx.select({ id: s.departments.id, code: s.departments.code }).from(s.departments),
    tx.select({ id: s.grades.id, name: s.grades.name }).from(s.grades),
    tx.select({ id: s.contractStatuses.id, code: s.contractStatuses.code }).from(s.contractStatuses),
    tx.select({ id: s.users.id, email: s.users.email }).from(s.users),
    tx.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(isNull(s.clients.deletedAt)),
    tx.select({ id: s.suppliers.id, name: s.suppliers.name }).from(s.suppliers).where(isNull(s.suppliers.deletedAt)),
    tx.select({ id: s.unitTypes.id, code: s.unitTypes.code }).from(s.unitTypes),
    tx.select({ id: s.contractTypes.id, code: s.contractTypes.code }).from(s.contractTypes),
    tx.select({ id: s.stageNames.id, name: s.stageNames.name }).from(s.stageNames),
    tx.select({ id: s.projects.id, wn: s.projects.workNumber, clientId: s.projects.clientId }).from(s.projects).where(isNull(s.projects.deletedAt)),
    tx.select({ id: s.contracts.id, projectId: s.contracts.projectId, direction: s.contracts.direction, n: s.contracts.numberInProject, clientId: s.contracts.clientId }).from(s.contracts).where(isNull(s.contracts.deletedAt)),
    tx.select({ id: s.subContracts.id, contractId: s.subContracts.contractId, n: s.subContracts.numberInContract }).from(s.subContracts).where(isNull(s.subContracts.deletedAt)),
    tx.select({ id: s.milestones.id, subContractId: s.milestones.subContractId, sort: s.milestones.sortOrder, opening: s.milestones.openingBilledPct }).from(s.milestones).where(isNull(s.milestones.deletedAt)),
    tx.select({ id: s.invoices.id, number: s.invoices.invoiceNumber, contractId: s.invoices.contractId, total: s.invoices.total }).from(s.invoices),
    tx.select({ id: s.receipts.id, ref: s.receipts.reference, clientId: s.receipts.clientId }).from(s.receipts).where(isNull(s.receipts.deletedAt)),
  ]);
  const projectByWn = new Map(pr.map((p) => [p.wn, p]));
  const contractKey = (projectId: string, direction: string, n: number) => `${projectId}|${direction}|${n}`;
  const contracts = new Map(co.map((c) => [contractKey(c.projectId, c.direction, c.n), c]));
  const subs = new Map(sc.map((x) => [`${x.contractId}|${x.n}`, x]));
  return {
    dep: new Map(dep.map((d) => [d.code, d.id])),
    gr: new Map(gr.map((g) => [g.name, g.id])),
    st: new Map(st.map((x) => [x.code, x.id])),
    users: new Map(users.map((u) => [u.email, u.id])),
    cl: new Map(cl.map((c) => [c.name, c.id])),
    su: new Map(su.map((c) => [c.name, c.id])),
    ut: new Map(ut.map((u) => [u.code, u.id])),
    ct: new Map(ct.map((c) => [c.code, c.id])),
    sn: new Map(sn.map((x) => [x.name, x.id])),
    projectByWn,
    contract: (wn: string, direction: string, n: number) => {
      const p = projectByWn.get(wn);
      return p ? contracts.get(contractKey(p.id, direction, n)) : undefined;
    },
    sub: (contractId: string, n: number) => subs.get(`${contractId}|${n}`),
    milestone: (subContractId: string, sort: number) => ms.find((m) => m.subContractId === subContractId && m.sort === sort),
    invoices: new Map(inv.map((i) => [i.number, i])),
    receipts: new Map(rc.map((r) => [r.ref ?? "", r])),
  };
}
type Ctx = Awaited<ReturnType<typeof ctxMaps>>;

/** Per-entity: validate a row against the DB context and return the insert plan. Errors are i18n-free codes. */
type Plan = { table: string; values: Record<string, unknown>; after?: (tx: Tx, id: string) => Promise<void> };
type Resolver = (row: Row, ctx: Ctx, seen: Map<string, Row>) => { errors: string[]; plan?: Plan };

function need<T>(v: T | undefined, code: string, errors: string[]): T | undefined {
  if (v === undefined) errors.push(code);
  return v;
}

const RESOLVERS: Record<string, Resolver> = {
  departments: (r) => ({ errors: [], plan: { table: "departments", values: { code: str(r.code), name: str(r.name), sortOrder: num(r.sort_order) ?? 0 } } }),
  grades: (r) => ({ errors: [], plan: { table: "grades", values: { name: str(r.name), sortOrder: num(r.sort_order) ?? 0 }, after: r.hourly_rate ? async (tx, id) => void (await tx.insert(s.billingRates).values({ gradeId: id, hourlyRate: f2(r.hourly_rate)!, effectiveFrom: str(r.rate_effective_from) ?? "2000-01-01" })) : undefined } }),
  stage_names: (r) => ({ errors: [], plan: { table: "stage_names", values: { name: str(r.name), sortOrder: num(r.sort_order) ?? 0 } } }),
  users: (r, c) => {
    const errors: string[] = [];
    if (c.users.has(String(r.email))) errors.push("email_exists");
    const departmentId = r.department_code ? need(c.dep.get(String(r.department_code)), "unknown_department", errors) : null;
    const gradeId = r.grade_name ? need(c.gr.get(String(r.grade_name)), "unknown_grade", errors) : null;
    const workDays = r.work_days ? String(r.work_days).split(/[,;\s]+/).filter(Boolean).map(Number) : [0, 1, 2, 3, 4];
    if (workDays.some((d) => Number.isNaN(d) || d < 0 || d > 6)) errors.push("invalid_work_days");
    return { errors, plan: { table: "users", values: { email: str(r.email), firstName: str(r.first_name), lastName: str(r.last_name), role: r.role, departmentId, gradeId, standardHoursPerDay: f2(r.standard_hours_per_day), workDays, employmentStart: str(r.employment_start), employmentEnd: str(r.employment_end), externalPayrollId: str(r.external_payroll_id), isActive: bool(r.is_active, true) } } };
  },
  employee_cost_rates: (r, c) => {
    const errors: string[] = [];
    const userId = need(c.users.get(String(r.user_email)), "unknown_user", errors);
    return { errors, plan: { table: "employee_cost_rates", values: { userId, hourlyCost: f2(r.hourly_cost), effectiveFrom: str(r.effective_from) } } };
  },
  clients: (r, c) => {
    const errors: string[] = [];
    if (c.cl.has(String(r.name))) errors.push("client_exists");
    return { errors, plan: { table: "clients", values: { name: str(r.name), taxId: str(r.tax_id), clientKind: r.client_kind ?? "company", addressStreet: str(r.address_street), addressCity: str(r.address_city), addressZip: str(r.address_zip), phone: str(r.phone), email: str(r.email), website: str(r.website), paymentTermsDays: num(r.payment_terms_days), indexLinkedDefault: r.index_linked_default ?? null, vatExempt: bool(r.vat_exempt, false), withholdingTaxPct: f2(r.withholding_tax_pct), withholdingValidUntil: str(r.withholding_valid_until), notes: str(r.notes), isActive: bool(r.is_active, true) } } };
  },
  suppliers: (r, c) => {
    const errors: string[] = [];
    if (c.su.has(String(r.name))) errors.push("supplier_exists");
    return { errors, plan: { table: "suppliers", values: { name: str(r.name), taxId: str(r.tax_id), field: str(r.field), addressStreet: str(r.address_street), addressCity: str(r.address_city), phone: str(r.phone), email: str(r.email), paymentTermsDays: num(r.payment_terms_days), notes: str(r.notes), isActive: bool(r.is_active, true) } } };
  },
  contacts: (r, c) => {
    const errors: string[] = [];
    const clientId = r.client_name ? need(c.cl.get(String(r.client_name)), "unknown_client", errors) : null;
    const supplierId = r.supplier_name ? need(c.su.get(String(r.supplier_name)), "unknown_supplier", errors) : null;
    if (!clientId && !supplierId) errors.push("owner_required");
    if (clientId && supplierId) errors.push("one_owner_only");
    return { errors, plan: { table: "contacts", values: { clientId: clientId ?? null, supplierId: supplierId ?? null, firstName: str(r.first_name), lastName: str(r.last_name) ?? "", roleTitle: str(r.role_title), email: str(r.email), phone: str(r.phone), receivesInvoices: bool(r.receives_invoices, false), isPrimary: bool(r.is_primary, false) } } };
  },
  projects: (r, c) => {
    const errors: string[] = [];
    if (c.projectByWn.has(String(r.work_number))) errors.push("work_number_exists");
    const clientId = need(c.cl.get(String(r.client_name)), "unknown_client", errors);
    const payingClientId = r.paying_client_name ? need(c.cl.get(String(r.paying_client_name)), "unknown_paying_client", errors) : null;
    const pmId = r.project_manager_email ? need(c.users.get(String(r.project_manager_email)), "unknown_pm", errors) : null;
    const departmentId = r.department_code ? need(c.dep.get(String(r.department_code)), "unknown_department", errors) : null;
    const statusId = c.st.get(String(r.status_code ?? "active")) ?? null;
    return { errors, plan: { table: "projects", values: { workNumber: str(r.work_number), name: str(r.name), clientId, payingClientId, projectManagerUserId: pmId, departmentId, statusId, statusManual: Boolean(r.status_code), startDate: str(r.start_date), targetDate: str(r.target_date), actualEndDate: str(r.actual_end_date), description: str(r.description), notes: str(r.notes) } } };
  },
  contracts: (r, c) => {
    const errors: string[] = [];
    const p = need(c.projectByWn.get(String(r.work_number)), "unknown_project", errors);
    if (p && c.contract(String(r.work_number), String(r.direction), Number(r.contract_number))) errors.push("contract_exists");
    const clientId = r.direction === "income" ? (r.client_name ? need(c.cl.get(String(r.client_name)), "unknown_client", errors) : p?.clientId) : null;
    const supplierId = r.direction === "expense" ? need(c.su.get(String(r.supplier_name)), "unknown_supplier", errors) : null;
    const payingClientId = r.paying_client_name ? need(c.cl.get(String(r.paying_client_name)), "unknown_paying_client", errors) : null;
    if (r.index_linked && !r.index_base_month) errors.push("index_base_month_required");
    return { errors, plan: { table: "contracts", values: { projectId: p?.id, direction: r.direction, clientId: clientId ?? null, payingClientId, supplierId: supplierId ?? null, numberInProject: num(r.contract_number), name: str(r.name), orderNumber: str(r.order_number), contractTypeId: r.contract_type_code ? (c.ct.get(String(r.contract_type_code)) ?? null) : null, statusId: c.st.get(String(r.status_code ?? (r.signed_date ? "active" : "draft"))) ?? null, statusManual: Boolean(r.status_code), signedDate: str(r.signed_date), openingDate: str(r.opening_date) ?? str(r.signed_date), targetDate: str(r.target_date), actualEndDate: str(r.actual_end_date), indexLinked: bool(r.index_linked, false), indexBaseMonth: str(r.index_base_month), indexFloor: bool(r.index_floor, false), participatesInHours: r.direction === "expense" ? false : bool(r.participates_in_hours, true), retentionPct: f2(r.retention_pct), budgetAmount: f2(r.budget_amount), isLocked: bool(r.is_locked, false), description: str(r.description), notes: str(r.notes) } } };
  },
  sub_contracts: (r, c) => {
    const errors: string[] = [];
    const co = need(c.contract(String(r.work_number), String(r.direction), Number(r.contract_number)), "unknown_contract", errors);
    if (co && c.sub(co.id, Number(r.sub_contract_number))) errors.push("sub_contract_exists");
    const m = String(r.pricing_method);
    if (m === "fixed_price" && r.base_price === null) errors.push("base_price_required");
    if (m === "retainer" && (r.monthly_amount === null || r.retainer_start === null)) errors.push("retainer_fields_required");
    if (m === "pct_of_cost" && r.fee_pct === null) errors.push("fee_pct_required");
    if (m === "per_unit" && r.unit_price === null) errors.push("unit_price_required");
    const departmentId = r.department_code ? need(c.dep.get(String(r.department_code)), "unknown_department", errors) : null;
    const unitTypeId = r.unit_type_code ? need(c.ut.get(String(r.unit_type_code)), "unknown_unit_type", errors) : null;
    return {
      errors,
      plan: {
        table: "sub_contracts",
        values: { contractId: co?.id, numberInContract: num(r.sub_contract_number), name: str(r.name), isDefault: bool(r.is_default, false), pricingMethod: m, basePrice: f2(r.base_price), discountPct: f2(r.discount_pct) ?? "0", hourlyMode: m === "hourly" ? (r.hourly_mode ?? "rate_card") : null, customHourlyRate: f2(r.custom_hourly_rate), hoursCap: f2(r.hours_cap), amountCap: f2(r.amount_cap), monthlyAmount: f2(r.monthly_amount), retainerStart: str(r.retainer_start), retainerEnd: str(r.retainer_end), feePct: f3(r.fee_pct), unitTypeId, unitPrice: f2(r.unit_price), agreedQuantity: f3(r.agreed_quantity), statusId: r.status_code ? (c.st.get(String(r.status_code)) ?? null) : null, openingDate: str(r.opening_date), departmentId, indexLinked: bool(r.index_linked, false), indexFloor: bool(r.index_floor, false), participatesInHours: r.direction === "expense" ? false : bool(r.participates_in_hours, true), isLocked: bool(r.is_locked, false), notes: str(r.notes) },
        after: r.cost_estimate ? async (tx, id) => void (await tx.insert(s.projectCostEstimates).values({ subContractId: id, estimateType: "initial", amount: f2(r.cost_estimate)!, effectiveFrom: str(r.opening_date) ?? "2000-01-01" })) : undefined,
      },
    };
  },
  milestones: (r, c) => {
    const errors: string[] = [];
    const co = c.contract(String(r.work_number), String(r.direction), Number(r.contract_number));
    const sub = co ? need(c.sub(co.id, Number(r.sub_contract_number)), "unknown_sub_contract", errors) : (errors.push("unknown_contract"), undefined);
    if (sub && c.milestone(sub.id, Number(r.sort_order))) errors.push("milestone_exists");
    const stageNameId = c.sn.get(String(r.stage_name)) ?? null;
    return { errors, plan: { table: "milestones", values: { subContractId: sub?.id, sortOrder: num(r.sort_order), stageNameId, name: str(r.stage_name), pctOfSubcontract: f3(r.pct), discountPct: f2(r.discount_pct), openingBilledPct: f3(r.opening_billed_pct) ?? "0", openingPaidAmount: f2(r.opening_paid_amount) ?? "0", expectedDate: str(r.expected_date), notes: str(r.notes) } } };
  },
  time_entries: (r, c) => {
    const errors: string[] = [];
    const userId = need(c.users.get(String(r.user_email)), "unknown_user", errors);
    const co = c.contract(String(r.work_number), "income", Number(r.contract_number ?? 1));
    const sub = co ? need(c.sub(co.id, Number(r.sub_contract_number ?? 1)), "unknown_sub_contract", errors) : (errors.push("unknown_contract"), undefined);
    const hs = String(r.hours ?? "");
    let minutes = hs.includes(":") ? parseHHMM(hs) : Math.round(Number(hs) * 60);
    if (minutes === null || Number.isNaN(minutes) || minutes <= 0 || minutes > 1440) {
      errors.push("invalid_hours");
      minutes = 0;
    }
    if (String(r.description ?? "").trim().length < 3) errors.push("description_min_3");
    const reportedBy = r.reported_by_email ? (c.users.get(String(r.reported_by_email)) ?? userId) : userId;
    return { errors, plan: { table: "time_entries", values: { userId, subContractId: sub?.id, workDate: str(r.work_date), minutes, startTime: str(r.start_time), endTime: str(r.end_time), description: str(r.description), reportedByUserId: reportedBy } } };
  },
  invoices: (r, c) => {
    const errors: string[] = [];
    if (c.invoices.has(String(r.invoice_number))) errors.push("invoice_number_exists");
    const co = need(c.contract(String(r.work_number), "income", Number(r.contract_number ?? 1)), "unknown_contract", errors);
    const creditOf = r.credit_of_invoice_number ? need(c.invoices.get(String(r.credit_of_invoice_number))?.id, "unknown_credit_of", errors) : null;
    const seq = Number(String(r.invoice_number).replace(/\D/g, "")) || 0;
    return { errors, plan: { table: "invoices", values: { invoiceNumber: str(r.invoice_number), sequenceNo: seq, sequenceYear: null, invoiceKind: r.kind ?? "proforma", creditOfInvoiceId: creditOf, contractId: co?.id, clientId: co?.clientId, partialNumber: num(r.partial_number), status: r.status, invoiceDate: str(r.invoice_date), dueDate: str(r.due_date), subject: str(r.subject), indexLinked: Boolean(r.index_month), indexBaseMonth: str(r.index_base_month), indexMonth: str(r.index_month), subtotalBase: f2(r.subtotal_base), cumulativeBase: f2(r.subtotal_base), indexDiff: f2(r.index_diff) ?? "0", retentionAmount: f2(r.retention_amount) ?? "0", beforeVat: f2(r.before_vat), vatRate: f2(r.vat_rate), vatAmount: f2(r.vat_amount), total: f2(r.total), notes: str(r.notes), sentAt: new Date(String(r.invoice_date)) } } };
  },
  invoice_lines: (r, c) => {
    const errors: string[] = [];
    const inv = need(c.invoices.get(String(r.invoice_number)), "unknown_invoice", errors);
    const sub = inv ? need(c.sub(inv.contractId, Number(r.sub_contract_number ?? 1)), "unknown_sub_contract", errors) : undefined;
    let milestoneId: string | null = null;
    if (r.line_type === "milestone") {
      const m = sub ? need(c.milestone(sub.id, Number(r.milestone_sort_order)), "unknown_milestone", errors) : undefined;
      milestoneId = m?.id ?? null;
      if (m && Number(m.opening) > 0) errors.push("milestone_has_opening_balance");
      if (r.progress_pct_this === null) errors.push("progress_pct_required");
    }
    return { errors, plan: { table: "invoice_lines", values: { invoiceId: inv?.id, subContractId: sub?.id, milestoneId, lineType: r.line_type, sortOrder: num(r.milestone_sort_order) ?? 0, description: str(r.description), progressPctThis: f3(r.progress_pct_this), cumulativePct: f3(r.cumulative_pct), amountThis: f2(r.amount_this), cumulativeAmount: f2(r.cumulative_amount), hours: f2(r.hours), hourlyRate: f2(r.hourly_rate), quantity: f3(r.quantity), unitPrice: f2(r.unit_price) } } };
  },
  receipts: (r, c) => {
    const errors: string[] = [];
    const clientId = need(c.cl.get(String(r.client_name)), "unknown_client", errors);
    if (c.receipts.has(String(r.receipt_key))) errors.push("receipt_key_exists");
    return { errors, plan: { table: "receipts", values: { clientId, receiptDate: str(r.receipt_date), amount: f2(r.amount), method: r.method ?? "transfer", reference: str(r.receipt_key), notes: [str(r.reference), str(r.notes)].filter(Boolean).join(" · ") || null } } };
  },
  receipt_allocations: (r, c) => {
    const errors: string[] = [];
    const rc = need(c.receipts.get(String(r.receipt_key)), "unknown_receipt", errors);
    const inv = need(c.invoices.get(String(r.invoice_number)), "unknown_invoice", errors);
    if (inv && Number(r.amount) > Number(inv.total) + 0.005) errors.push("allocation_over_invoice");
    return { errors, plan: { table: "receipt_allocations", values: { receiptId: rc?.id, invoiceId: inv?.id, amount: f2(r.amount) } } };
  },
  supplier_invoices: (r, c) => {
    const errors: string[] = [];
    const co = need(c.contract(String(r.work_number), "expense", Number(r.contract_number)), "unknown_contract", errors);
    const bv = Number(r.amount_before_vat ?? 0);
    const vat = Number(r.vat_amount ?? 0);
    return { errors, plan: { table: "supplier_invoices", values: { contractId: co?.id, supplierInvoiceNumber: str(r.supplier_invoice_number), invoiceDate: str(r.invoice_date), receivedDate: str(r.received_date), amountBeforeVat: bv.toFixed(2), vatAmount: vat.toFixed(2), total: (num(r.total) ?? bv + vat).toFixed(2), description: str(r.description), progressPctClaimed: f3(r.progress_pct_claimed), status: r.status, paidDate: str(r.paid_date), notes: str(r.notes) } } };
  },
};

const TABLES: Record<string, unknown> = { departments: s.departments, grades: s.grades, stage_names: s.stageNames, users: s.users, employee_cost_rates: s.employeeCostRates, clients: s.clients, suppliers: s.suppliers, contacts: s.contacts, projects: s.projects, contracts: s.contracts, sub_contracts: s.subContracts, milestones: s.milestones, time_entries: s.timeEntries, invoices: s.invoices, invoice_lines: s.invoiceLines, receipts: s.receipts, receipt_allocations: s.receiptAllocations, supplier_invoices: s.supplierInvoices };

export interface ValidationOutcome {
  ok: boolean;
  rows: ParsedRow[];
  expected?: Record<string, { submitted: number | null; paid: number | null; remaining: number | null }>;
}

/** Dry-run validation against the current DB (spec §15.1, §15.3). */
export async function validateRows(entityKey: string, rows: ParsedRow[]): Promise<ValidationOutcome> {
  const resolver = RESOLVERS[entityKey];
  if (!resolver) return { ok: false, rows: rows.map((r) => ({ ...r, errors: [...r.errors, "unknown_entity"] })) };
  const ctx = await ctxMaps(db);
  const seen = new Map<string, Row>();
  const expected: ValidationOutcome["expected"] = {};
  for (const r of rows) {
    const res = resolver(r.values, ctx, seen);
    r.errors.push(...res.errors);
    if (entityKey === "sub_contracts" && (r.values.admiral_submitted !== null || r.values.admiral_paid !== null || r.values.admiral_remaining !== null)) {
      expected[`${r.values.work_number}|${r.values.contract_number}|${r.values.sub_contract_number}`] = { submitted: num(r.values.admiral_submitted), paid: num(r.values.admiral_paid), remaining: num(r.values.admiral_remaining) };
    }
  }
  // receipt allocations: Σ per receipt ≤ receipt amount (within file)
  if (entityKey === "receipt_allocations") {
    const sums = new Map<string, number>();
    for (const r of rows) sums.set(String(r.values.receipt_key), (sums.get(String(r.values.receipt_key)) ?? 0) + Number(r.values.amount ?? 0));
    const rc = await db.select({ ref: s.receipts.reference, amount: s.receipts.amount }).from(s.receipts);
    for (const r of rows) {
      const a = rc.find((x) => x.ref === String(r.values.receipt_key));
      if (a && (sums.get(String(r.values.receipt_key)) ?? 0) > Number(a.amount) + 0.005) r.errors.push("allocations_over_receipt");
    }
  }
  return { ok: rows.every((r) => r.errors.length === 0), rows, expected };
}

/** All-or-nothing execution in one transaction; created ids are recorded for rollback (spec §15.1). */
export async function executeRows(entityKey: string, rows: ParsedRow[], userId: string): Promise<Record<string, string[]>> {
  const resolver = RESOLVERS[entityKey]!;
  return withUser({ userId }, async (tx) => {
    const ctx = await ctxMaps(tx);
    const seen = new Map<string, Row>();
    const created: Record<string, string[]> = {};
    for (const r of rows) {
      const res = resolver(r.values, ctx, seen);
      if (res.errors.length || !res.plan) throw new Error(`row ${r.rowNumber}: ${res.errors.join(", ")}`);
      const table = TABLES[res.plan.table] as typeof s.clients;
      const [ins] = await tx
        .insert(table)
        .values({ ...res.plan.values, createdBy: userId } as never)
        .returning({ id: table.id });
      (created[res.plan.table] ??= []).push(ins!.id);
      if (res.plan.after) await res.plan.after(tx, ins!.id);
      // keep context fresh for rows referencing earlier rows of the same file
      if (entityKey === "users") ctx.users.set(String(r.values.email), ins!.id);
      if (entityKey === "clients") ctx.cl.set(String(r.values.name), ins!.id);
      if (entityKey === "suppliers") ctx.su.set(String(r.values.name), ins!.id);
      if (entityKey === "departments") ctx.dep.set(String(r.values.code), ins!.id);
      if (entityKey === "grades") ctx.gr.set(String(r.values.name), ins!.id);
      if (entityKey === "stage_names") ctx.sn.set(String(r.values.name), ins!.id);
      if (entityKey === "projects") ctx.projectByWn.set(String(r.values.work_number), { id: ins!.id, wn: String(r.values.work_number), clientId: String(res.plan.values.clientId) });
      if (entityKey === "invoices") ctx.invoices.set(String(r.values.invoice_number), { id: ins!.id, number: String(r.values.invoice_number), contractId: String(res.plan.values.contractId), total: String(res.plan.values.total) });
      if (entityKey === "receipts") ctx.receipts.set(String(r.values.receipt_key), { id: ins!.id, ref: String(r.values.receipt_key), clientId: String(res.plan.values.clientId) });
      if (entityKey === "contracts" || entityKey === "sub_contracts" || entityKey === "milestones") {
        // re-load small maps so later rows can reference this row
        const fresh = await ctxMaps(tx);
        ctx.contract = fresh.contract;
        ctx.sub = fresh.sub;
        ctx.milestone = fresh.milestone;
      }
    }
    if (entityKey === "invoices") {
      const [m] = await tx.select({ n: sql<number>`coalesce(max(${s.invoices.sequenceNo}),0)` }).from(s.invoices);
      const numbering = await getSettingFresh("numbering", tx);
      if (Number(m?.n ?? 0) + 1 > numbering.invoice.next) await setSetting("numbering", { ...numbering, invoice: { ...numbering.invoice, next: Number(m!.n) + 1 } }, userId, tx);
    }
    if (entityKey === "projects") {
      const numbering = await getSettingFresh("numbering", tx);
      const maxWn = Math.max(0, ...rows.map((r) => Number(String(r.values.work_number).replace(/\D/g, "")) || 0));
      if (maxWn + 1 > numbering.work_number.next) await setSetting("numbering", { ...numbering, work_number: { ...numbering.work_number, next: maxWn + 1 } }, userId, tx);
    }
    return created;
  });
}

/** Delete the rows created by a batch (physical delete – the rows never carried business data of their own). */
export async function rollbackCreated(created: Record<string, string[]>, userId: string): Promise<void> {
  const order = ["receipt_allocations", "invoice_lines", "invoices", "receipts", "time_entries", "supplier_invoices", "milestones", "sub_contracts", "contracts", "projects", "contacts", "suppliers", "clients", "employee_cost_rates", "users", "stage_names", "grades", "departments"];
  await withUser({ userId }, async (tx) => {
    for (const t of order) {
      const ids = created[t];
      if (!ids?.length) continue;
      const table = TABLES[t] as typeof s.clients;
      if (t === "sub_contracts") await tx.delete(s.projectCostEstimates).where(inArray(s.projectCostEstimates.subContractId, ids));
      if (t === "grades") await tx.delete(s.billingRates).where(inArray(s.billingRates.gradeId, ids));
      await tx.delete(table).where(inArray(table.id, ids));
    }
  });
}

/** Diff report (spec §15.4): computed balances vs Admiral columns captured in the sub_contracts batch. */
export async function diffReport(expected: Record<string, { submitted: number | null; paid: number | null; remaining: number | null }>) {
  const rep = await contractBalancesReport({});
  const out: { key: string; name: string; field: string; expected: number; actual: number | null; diff: number | null }[] = [];
  for (const p of rep.projects) for (const c of p.contracts) for (const sc of c.subContracts) {
    const exp = expected[`${p.workNumber}|${c.numberInProject}|${sc.numberInContract}`];
    if (!exp) continue;
    const name = `${p.workNumber} – ${p.name} – ${c.numberInProject}.${sc.numberInContract} ${sc.name}`;
    for (const [field, e, a] of [["submitted", exp.submitted, sc.balances.submitted], ["paid", exp.paid, sc.balances.paid], ["remaining", exp.remaining, sc.balances.remaining]] as const) {
      if (e === null) continue;
      out.push({ key: sc.id, name, field, expected: e, actual: a, diff: a === null ? null : Math.round((a - e) * 100) / 100 });
    }
  }
  return out;
}

