import "server-only";
import { and, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLog, clients, contracts, invoices, milestones, projects, receiptAllocations, receipts, subContracts, supplierInvoices, suppliers, users, employeeCostRates, timeEntries } from "@/lib/db/schema";
import { contractBalancesReport } from "../balances";
import { computeProfitability } from "@/lib/calc/profitability";
import { agingBucket, daysBetween } from "@/lib/calc/invoice";
import { hoursCost, type CostRate } from "@/lib/calc/balances";
import { getSetting } from "@/lib/settings/service";
import { todayLocal } from "@/lib/i18n/format";
import { defaultRange, monthsBetween, type ReportColumn, type ReportParams, type ReportResult, type ReportRow } from "../types";

const money = (v: number) => Math.round(v * 100) / 100;

async function vatRateNow(): Promise<number> {
  const rows = await db.execute(sql`select rate from vat_rates where effective_from <= current_date order by effective_from desc limit 1`);
  return Number((rows as unknown as { rate: string }[])[0]?.rate ?? 18);
}

/** fin.contract_balances (spec §12.4) – hierarchy client → project → contract → sub-contract → milestone. */
export async function contractBalances(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const months = p.showMonths ? monthsBetween(from, to) : [];
  const rep = await contractBalancesReport({ clientIds: p.clientIds, projectIds: p.projectIds, activeOnly: !p.includeInactive, monthsFrom: from.slice(0, 7), monthsTo: to.slice(0, 7) });
  const vat = await vatRateNow();
  const pmFilter = p.pmIds?.length ? new Set(p.pmIds) : null;
  const pms = pmFilter ? new Map((await db.select({ id: projects.id, pm: projects.projectManagerUserId }).from(projects)).map((x) => [x.id, x.pm])) : null;
  const rows: ReportRow[] = [];
  const byClient = new Map<string, typeof rep.projects>();
  for (const pr of rep.projects) {
    if (pmFilter && !pmFilter.has(pms!.get(pr.id) ?? "")) continue;
    (byClient.get(pr.clientId) ?? byClient.set(pr.clientId, []).get(pr.clientId)!).push(pr);
  }
  const cellsFor = (b: { totalAmount: number | null; submitted: number; paid: number; openBalance: number; remaining: number | null; progressPct: number | null }, hoursTotal: number, hoursThisYear: number, byMonth: Record<string, number>, hCost: number, sCost: number) => {
    const prof = computeProfitability({ submitted: b.submitted, hoursCost: hCost, supplierCost: sCost, openBalance: b.openBalance, vatRate: vat });
    const c: Record<string, unknown> = { total: b.totalAmount, paid: b.paid, open: b.openBalance, remaining: b.remaining, progress: b.progressPct, submitted: b.submitted, hours_year: hoursThisYear, hours_total: hoursTotal, open_gross: prof.openBalanceGross, income: prof.income, cost: prof.cost, profit: prof.profit, profit_pct: prof.profitPct };
    for (const m of months) c[`m_${m}`] = byMonth[m] ?? 0;
    return c;
  };
  for (const [clientId, prs] of byClient) {
    const cid = `c:${clientId}`;
    const agg = { totalAmount: prs.reduce((a, x) => a + (x.balances.totalAmount ?? 0), 0), submitted: prs.reduce((a, x) => a + x.balances.submitted, 0), paid: prs.reduce((a, x) => a + x.balances.paid, 0), openBalance: prs.reduce((a, x) => a + x.balances.openBalance, 0), remaining: prs.reduce((a, x) => a + (x.balances.remaining ?? 0), 0), progressPct: null };
    const bm: Record<string, number> = {};
    for (const x of prs) for (const [k, v] of Object.entries(x.hoursByMonth)) bm[k] = (bm[k] ?? 0) + v;
    rows.push({ id: cid, level: 0, link: `/clients/${clientId}`, cells: { name: prs[0]!.clientName, client: prs[0]!.clientName, ...cellsFor(agg, prs.reduce((a, x) => a + x.hoursTotal, 0), prs.reduce((a, x) => a + x.hoursThisYear, 0), bm, prs.reduce((a, x) => a + x.hoursCost, 0), prs.reduce((a, x) => a + x.supplierCost, 0)) } });
    for (const pr of prs) {
      const pid = `${cid}|p:${pr.id}`;
      rows.push({ id: pid, parentId: cid, level: 1, link: `/projects/${pr.id}`, cells: { name: `${pr.workNumber} – ${pr.name}`, client: pr.clientName, project: pr.name, work_number: pr.workNumber, pm: pr.projectManager, status: pr.statusCode, ...cellsFor(pr.balances, pr.hoursTotal, pr.hoursThisYear, pr.hoursByMonth, pr.hoursCost, pr.supplierCost) } });
      for (const c of pr.contracts.filter((x) => x.direction === "income")) {
        if (p.statusCodes?.length && !p.statusCodes.includes(c.statusCode ?? "")) continue;
        const ccid = `${pid}|k:${c.id}`;
        const bm2: Record<string, number> = {};
        for (const s of c.subContracts) for (const [k, v] of Object.entries(s.hoursByMonth)) bm2[k] = (bm2[k] ?? 0) + v;
        rows.push({ id: ccid, parentId: pid, level: 2, link: `/contracts/${c.id}`, warnings: c.warnings, entity: { type: "contract", id: c.id }, cells: { name: `${c.numberInProject}. ${c.name}`, status: c.statusCode, note: c.lastNote, ...cellsFor(c.balances, c.subContracts.reduce((a, x) => a + x.hoursTotal, 0), c.subContracts.reduce((a, x) => a + x.hoursThisYear, 0), bm2, c.subContracts.reduce((a, x) => a + x.hoursCost, 0), 0) } });
        for (const s of c.subContracts) {
          if (p.pricingMethods?.length && !p.pricingMethods.includes(s.pricingMethod)) continue;
          const sid = `${ccid}|s:${s.id}`;
          rows.push({ id: sid, parentId: ccid, level: 3, link: `/sub-contracts/${s.id}`, cells: { name: `${s.numberInContract}. ${s.name}`, method: s.pricingMethod, ...cellsFor(s.balances, s.hoursTotal, s.hoursThisYear, s.hoursByMonth, s.hoursCost, 0) } });
          for (const m of s.milestones) rows.push({ id: `${sid}|m:${m.id}`, parentId: sid, level: 4, cells: { name: m.name, total: m.total, paid: m.paidAmount, open: money(m.billedAmount - m.paidAmount), remaining: m.remaining, progress: m.billedPct, submitted: m.billedAmount } });
        }
      }
    }
  }
  const columns: ReportColumn[] = [
    { key: "name", label: "name", type: "text", group: "general" },
    { key: "work_number", label: "work_number", type: "text", group: "general", hidden: true },
    { key: "pm", label: "project_manager", type: "text", group: "general", hidden: true },
    { key: "status", label: "status", type: "text", group: "general" },
    { key: "total", label: "total", type: "money", group: "contract", sum: true },
    { key: "submitted", label: "submitted", type: "money", group: "contract", sum: true },
    { key: "paid", label: "paid", type: "money", group: "contract", sum: true },
    { key: "open", label: "open_balance", type: "money", group: "contract", sum: true },
    { key: "remaining", label: "remaining", type: "money", group: "contract", sum: true },
    { key: "progress", label: "progress", type: "pct", group: "contract" },
    { key: "hours_year", label: "hours_year", type: "hours", group: "hours", sum: true },
    { key: "hours_total", label: "hours_total", type: "hours", group: "hours", sum: true },
    ...months.map((m) => ({ key: `m_${m}`, label: m, type: "hours" as const, group: "hours", sum: true })),
    { key: "open_gross", label: "open_gross", type: "money", group: "profit", financial: true, sum: true },
    { key: "income", label: "income", type: "money", group: "profit", financial: true, sum: true },
    { key: "cost", label: "cost", type: "money", group: "profit", financial: true, sum: true },
    { key: "profit", label: "profit", type: "money", group: "profit", financial: true, sum: true },
    { key: "profit_pct", label: "profit_pct", type: "pct", group: "profit", financial: true },
    { key: "note", label: "last_note", type: "text", group: "notes", editable: "note" },
  ];
  const totals: Record<string, number> = {};
  for (const c of columns) if (c.sum) totals[c.key] = money(rows.filter((r) => r.level === 0).reduce((a, r) => a + Number(r.cells[c.key] ?? 0), 0));
  return { columns, rows, totals };
}

async function ratesMap(): Promise<Map<string, CostRate[]>> {
  const rows = await db.select().from(employeeCostRates);
  const m = new Map<string, CostRate[]>();
  for (const r of rows) (m.get(r.userId) ?? m.set(r.userId, []).get(r.userId)!).push({ effectiveFrom: r.effectiveFrom, hourlyCost: Number(r.hourlyCost) });
  return m;
}

export async function hoursAndCost(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const rates = await ratesMap();
  const e = await db
    .select({ userId: timeEntries.userId, userName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`, projectId: projects.id, project: sql<string>`${projects.workNumber} || ' – ' || ${projects.name}`, workDate: timeEntries.workDate, minutes: timeEntries.minutes })
    .from(timeEntries)
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .innerJoin(subContracts, eq(subContracts.id, timeEntries.subContractId))
    .innerJoin(contracts, eq(contracts.id, subContracts.contractId))
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .where(and(isNull(timeEntries.deletedAt), gte(timeEntries.workDate, from), lte(timeEntries.workDate, to), p.projectIds?.length ? inArray(projects.id, p.projectIds) : undefined, p.userIds?.length ? inArray(timeEntries.userId, p.userIds) : undefined, p.departmentIds?.length ? inArray(users.departmentId, p.departmentIds) : undefined));
  const rows: ReportRow[] = [];
  const byP = new Map<string, typeof e>();
  for (const x of e) (byP.get(x.projectId) ?? byP.set(x.projectId, []).get(x.projectId)!).push(x);
  for (const [pid, es] of byP) {
    rows.push({ id: pid, level: 0, link: `/projects/${pid}`, cells: { name: es[0]!.project, hours: Math.round((es.reduce((a, x) => a + x.minutes, 0) / 60) * 100) / 100, cost: hoursCost(es, rates) } });
    const byU = new Map<string, typeof e>();
    for (const x of es) (byU.get(x.userId) ?? byU.set(x.userId, []).get(x.userId)!).push(x);
    for (const [uid, ues] of byU) rows.push({ id: `${pid}|${uid}`, parentId: pid, level: 1, cells: { name: ues[0]!.userName, hours: Math.round((ues.reduce((a, x) => a + x.minutes, 0) / 60) * 100) / 100, cost: hoursCost(ues, rates) } });
  }
  return { columns: [{ key: "name", label: "name", type: "text" }, { key: "hours", label: "hours", type: "hours", sum: true }, { key: "cost", label: "cost", type: "money", sum: true, financial: true }], rows, totals: { hours: Math.round((e.reduce((a, x) => a + x.minutes, 0) / 60) * 100) / 100, cost: hoursCost(e, rates) } };
}

export async function costByProject(p: ReportParams): Promise<ReportResult> {
  const rep = await contractBalancesReport({ clientIds: p.clientIds, projectIds: p.projectIds });
  const rows: ReportRow[] = rep.projects.filter((pr) => !p.pmIds?.length || p.pmIds.includes(pr.projectManager ?? "")).map((pr) => ({ id: pr.id, level: 0, link: `/projects/${pr.id}`, cells: { name: `${pr.workNumber} – ${pr.name}`, hours_cost: pr.hoursCost, supplier_cost: pr.supplierCost, total_cost: money(pr.hoursCost + pr.supplierCost), contract_total: pr.balances.totalAmount, margin: pr.balances.totalAmount === null ? null : money(pr.balances.totalAmount - pr.hoursCost - pr.supplierCost) } }));
  return { columns: [{ key: "name", label: "project", type: "text" }, { key: "hours_cost", label: "hours_cost", type: "money", sum: true }, { key: "supplier_cost", label: "supplier_cost", type: "money", sum: true }, { key: "total_cost", label: "total_cost", type: "money", sum: true }, { key: "contract_total", label: "total", type: "money", sum: true }, { key: "margin", label: "margin", type: "money", sum: true }], rows };
}

async function profitRows(p: ReportParams, level: "client" | "project" | "sub"): Promise<ReportResult> {
  const rep = await contractBalancesReport({ clientIds: p.clientIds, projectIds: p.projectIds, activeOnly: !p.includeInactive });
  const rows: ReportRow[] = [];
  const push = (id: string, name: string, submitted: number, completed: number, hCost: number, sCost: number, link?: string, extra: Record<string, unknown> = {}) => {
    const prof = computeProfitability({ submitted, hoursCost: hCost, supplierCost: sCost, completedMilestonesTotal: completed, incomeMode: p.incomeMode ?? "submitted" });
    rows.push({ id, level: 0, link, cells: { name, income: prof.income, cost: prof.cost, profit: prof.profit, profit_pct: prof.profitPct, ...extra } });
  };
  const completedOf = (subs: (typeof rep.projects)[number]["contracts"][number]["subContracts"]) => subs.reduce((a, s) => a + s.milestones.filter((m) => m.billedPct >= 100).reduce((b, m) => b + m.total, 0), 0);
  if (level === "client") {
    const byC = new Map<string, typeof rep.projects>();
    for (const pr of rep.projects) (byC.get(pr.clientId) ?? byC.set(pr.clientId, []).get(pr.clientId)!).push(pr);
    for (const [cid, prs] of byC) push(cid, prs[0]!.clientName, prs.reduce((a, x) => a + x.balances.submitted, 0), prs.reduce((a, x) => a + completedOf(x.contracts.flatMap((c) => c.subContracts)), 0), prs.reduce((a, x) => a + x.hoursCost, 0), prs.reduce((a, x) => a + x.supplierCost, 0), `/clients/${cid}`);
  } else if (level === "project") {
    for (const pr of rep.projects) if (!p.pmIds?.length || p.pmIds.includes(pr.projectManager ?? "")) push(pr.id, `${pr.workNumber} – ${pr.name}`, pr.balances.submitted, completedOf(pr.contracts.flatMap((c) => c.subContracts)), pr.hoursCost, pr.supplierCost, `/projects/${pr.id}`, { hours: pr.hoursTotal, submitted: pr.balances.submitted, paid: pr.balances.paid });
  } else {
    for (const pr of rep.projects) for (const c of pr.contracts.filter((x) => x.direction === "income")) for (const s of c.subContracts) if (!p.pricingMethods?.length || p.pricingMethods.includes(s.pricingMethod)) push(s.id, `${pr.workNumber} – ${pr.name} – ${s.name}`, s.balances.submitted, completedOf([s]), s.hoursCost, 0, `/sub-contracts/${s.id}`, { hours: s.hoursTotal, submitted: s.balances.submitted, paid: s.balances.paid });
  }
  const cols: ReportColumn[] = [{ key: "name", label: "name", type: "text" }, { key: "income", label: "income", type: "money", sum: true }, { key: "cost", label: "cost", type: "money", sum: true }, { key: "profit", label: "profit", type: "money", sum: true }, { key: "profit_pct", label: "profit_pct", type: "pct" }];
  if (level !== "client") cols.push({ key: "hours", label: "hours", type: "hours", sum: true }, { key: "submitted", label: "submitted", type: "money", sum: true }, { key: "paid", label: "paid", type: "money", sum: true });
  return { columns: cols, rows };
}
export const profitByClient = (p: ReportParams) => profitRows(p, "client");
export const profitByProject = (p: ReportParams) => profitRows(p, "project");
export const profitBySubContract = (p: ReportParams) => profitRows(p, "sub");

export async function incomePlanVsActual(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const months = monthsBetween(from, to);
  const planned = await db
    .select({ m: sql<string>`to_char(${milestones.expectedDate}, 'YYYY-MM')`, pct: milestones.pctOfSubcontract, disc: milestones.discountPct, scDisc: subContracts.discountPct, base: subContracts.basePrice })
    .from(milestones)
    .innerJoin(subContracts, eq(subContracts.id, milestones.subContractId))
    .innerJoin(contracts, eq(contracts.id, subContracts.contractId))
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .where(and(isNull(milestones.deletedAt), sql`${milestones.expectedDate} between ${from} and ${to}`, p.projectIds?.length ? inArray(projects.id, p.projectIds) : undefined, p.clientIds?.length ? inArray(projects.clientId, p.clientIds) : undefined));
  const actual = await db
    .select({ m: sql<string>`to_char(${invoices.invoiceDate}, 'YYYY-MM')`, s: sql<string>`sum(${invoices.subtotalBase} * case when ${invoices.invoiceKind}='credit' then -1 else 1 end)` })
    .from(invoices)
    .innerJoin(contracts, eq(contracts.id, invoices.contractId))
    .where(and(isNull(invoices.deletedAt), inArray(invoices.status, ["approved", "signed", "sent", "partially_paid", "paid"]), sql`${invoices.invoiceDate} between ${from} and ${to}`, p.projectIds?.length ? inArray(contracts.projectId, p.projectIds) : undefined, p.clientIds?.length ? inArray(invoices.clientId, p.clientIds) : undefined))
    .groupBy(sql`1`);
  const rows: ReportRow[] = months.map((m) => {
    const plan = planned.filter((x) => x.m === m).reduce((a, x) => a + (Number(x.base ?? 0) * Number(x.pct)) / 100 * (1 - Number(x.disc ?? x.scDisc ?? 0) / 100), 0);
    const act = Number(actual.find((x) => x.m === m)?.s ?? 0);
    return { id: m, level: 0, cells: { month: m, planned: money(plan), actual: money(act), gap: money(act - plan) } };
  });
  return { columns: [{ key: "month", label: "month", type: "month" }, { key: "planned", label: "planned", type: "money", sum: true }, { key: "actual", label: "actual", type: "money", sum: true }, { key: "gap", label: "gap", type: "money", sum: true }], rows };
}

export async function invoicesReport(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const rows = await db
    .select({ i: invoices, client: clients.name, workNumber: projects.workNumber, project: projects.name, paid: sql<string>`coalesce((select sum(a.amount) from receipt_allocations a where a.invoice_id = "invoices"."id" and a.cancelled_at is null),0)` })
    .from(invoices)
    .innerJoin(contracts, eq(contracts.id, invoices.contractId))
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(isNull(invoices.deletedAt), gte(invoices.invoiceDate, from), lte(invoices.invoiceDate, to), p.clientIds?.length ? inArray(invoices.clientId, p.clientIds) : undefined, p.projectIds?.length ? inArray(projects.id, p.projectIds) : undefined, p.invoiceStatuses?.length ? inArray(invoices.status, p.invoiceStatuses as (typeof invoices.$inferSelect.status)[]) : undefined))
    .orderBy(desc(invoices.invoiceDate));
  return {
    columns: [{ key: "number", label: "invoice_number", type: "text" }, { key: "kind", label: "kind", type: "text" }, { key: "date", label: "date", type: "date" }, { key: "client", label: "client", type: "text" }, { key: "project", label: "project", type: "text" }, { key: "partial", label: "partial", type: "number" }, { key: "subtotal", label: "subtotal_base", type: "money", sum: true }, { key: "index_diff", label: "index_diff", type: "money", sum: true }, { key: "before_vat", label: "before_vat", type: "money", sum: true }, { key: "vat", label: "vat", type: "money", sum: true }, { key: "total", label: "total", type: "money", sum: true }, { key: "paid", label: "paid", type: "money", sum: true }, { key: "due", label: "due_date", type: "date" }, { key: "status", label: "status", type: "text" }],
    rows: rows.map((r) => ({ id: r.i.id, level: 0, link: `/invoices/${r.i.id}`, cells: { number: r.i.invoiceNumber, kind: r.i.invoiceKind, date: r.i.invoiceDate, client: r.client, project: `${r.workNumber} – ${r.project}`, partial: r.i.partialNumber, subtotal: Number(r.i.subtotalBase), index_diff: Number(r.i.indexDiff), before_vat: Number(r.i.beforeVat), vat: Number(r.i.vatAmount), total: Number(r.i.total), paid: Number(r.paid), due: r.i.dueDate, status: r.i.status } })),
  };
}

export async function aging(p: ReportParams): Promise<ReportResult> {
  const today = todayLocal();
  const settings = await getSetting("invoices");
  const rows = await db
    .select({ i: invoices, client: clients.name, paid: sql<string>`coalesce((select sum(a.amount) from receipt_allocations a where a.invoice_id = "invoices"."id" and a.cancelled_at is null),0)` })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, sql`coalesce(${invoices.payingClientId}, ${invoices.clientId})`))
    .where(and(isNull(invoices.deletedAt), inArray(invoices.status, ["sent", "partially_paid"]), p.clientIds?.length ? inArray(invoices.clientId, p.clientIds) : undefined))
    .orderBy(clients.name, invoices.dueDate);
  return {
    columns: [{ key: "client", label: "client", type: "text" }, { key: "number", label: "invoice_number", type: "text" }, { key: "date", label: "date", type: "date" }, { key: "due", label: "due_date", type: "date" }, { key: "total", label: "total", type: "money", sum: true }, { key: "paid", label: "paid", type: "money", sum: true }, { key: "balance", label: "balance", type: "money", sum: true }, { key: "days", label: "days_overdue", type: "number" }, { key: "bucket", label: "bucket", type: "text" }],
    rows: rows.map((r) => {
      const days = r.i.dueDate ? daysBetween(r.i.dueDate, today) : 0;
      return { id: r.i.id, level: 0, link: `/invoices/${r.i.id}`, cells: { client: r.client, number: r.i.invoiceNumber, date: r.i.invoiceDate, due: r.i.dueDate, total: Number(r.i.total), paid: Number(r.paid), balance: money(Number(r.i.total) - Number(r.paid)), days: Math.max(0, days), bucket: agingBucket(days, settings.aging_thresholds) } };
    }),
  };
}

export async function receiptsReport(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const rows = await db
    .select({ r: receipts, client: clients.name, allocated: sql<string>`coalesce((select sum(a.amount) from receipt_allocations a where a.receipt_id = "receipts"."id" and a.cancelled_at is null),0)`, invoicesList: sql<string>`(select string_agg(i.invoice_number || ' (' || a.amount || ')', ', ') from receipt_allocations a join invoices i on i.id = a.invoice_id where a.receipt_id = "receipts"."id" and a.cancelled_at is null)` })
    .from(receipts)
    .innerJoin(clients, eq(clients.id, receipts.clientId))
    .where(and(isNull(receipts.deletedAt), gte(receipts.receiptDate, from), lte(receipts.receiptDate, to), p.clientIds?.length ? inArray(receipts.clientId, p.clientIds) : undefined))
    .orderBy(desc(receipts.receiptDate));
  void receiptAllocations;
  return {
    columns: [{ key: "date", label: "date", type: "date" }, { key: "client", label: "client", type: "text" }, { key: "amount", label: "amount", type: "money", sum: true }, { key: "allocated", label: "allocated", type: "money", sum: true }, { key: "method", label: "method", type: "text" }, { key: "reference", label: "reference", type: "text" }, { key: "invoices", label: "allocations", type: "text" }],
    rows: rows.map((r) => ({ id: r.r.id, level: 0, cells: { date: r.r.receiptDate, client: r.client, amount: Number(r.r.amount), allocated: Number(r.allocated), method: r.r.method, reference: r.r.reference, invoices: r.invoicesList } })),
  };
}

export async function supplierBudgetVsActual(p: ReportParams): Promise<ReportResult> {
  const rep = await contractBalancesReport({ projectIds: p.projectIds, activeOnly: !p.includeInactive });
  const cons = await db.select({ id: contracts.id, supplierId: contracts.supplierId, supplier: suppliers.name, budget: contracts.budgetAmount }).from(contracts).innerJoin(suppliers, eq(suppliers.id, contracts.supplierId)).where(and(eq(contracts.direction, "expense"), isNull(contracts.deletedAt), p.supplierIds?.length ? inArray(contracts.supplierId, p.supplierIds) : undefined));
  const claimed = await db.select({ contractId: supplierInvoices.contractId, pct: sql<string>`coalesce(sum(${supplierInvoices.progressPctClaimed}),0)`, paid: sql<string>`coalesce(sum(case when ${supplierInvoices.status}='paid' then ${supplierInvoices.amountBeforeVat} else 0 end),0)` }).from(supplierInvoices).where(and(isNull(supplierInvoices.deletedAt), inArray(supplierInvoices.status, ["pending", "partially_approved", "approved", "paid"]))).groupBy(supplierInvoices.contractId);
  const rows: ReportRow[] = [];
  const bySup = new Map<string, typeof cons>();
  for (const c of cons) (bySup.get(c.supplierId!) ?? bySup.set(c.supplierId!, []).get(c.supplierId!)!).push(c);
  for (const [sid, cs] of bySup) {
    const sRow: ReportRow = { id: sid, level: 0, link: `/suppliers/${sid}`, cells: { name: cs[0]!.supplier, budget: 0, approved: 0, paid: 0, balance: 0 } };
    rows.push(sRow);
    for (const c of cs) {
      const pr = rep.projects.find((x) => x.contracts.some((k) => k.id === c.id));
      const k = pr?.contracts.find((x) => x.id === c.id);
      if (!k) continue;
      const cl = claimed.find((x) => x.contractId === c.id);
      const budget = Number(c.budget ?? k.balances.totalAmount ?? 0);
      const approved = k.supplierCost;
      const paid = Number(cl?.paid ?? 0);
      rows.push({ id: `${sid}|${c.id}`, parentId: sid, level: 1, link: `/contracts/${c.id}`, cells: { name: `${pr!.workNumber} – ${pr!.name} – ${k.name}`, budget, approved, paid, balance: money(budget - approved), claimed_pct: Number(cl?.pct ?? 0), client_pct: pr!.balances.progressPct } });
      sRow.cells.budget = money(Number(sRow.cells.budget) + budget);
      sRow.cells.approved = money(Number(sRow.cells.approved) + approved);
      sRow.cells.paid = money(Number(sRow.cells.paid) + paid);
      sRow.cells.balance = money(Number(sRow.cells.balance) + budget - approved);
    }
  }
  return { columns: [{ key: "name", label: "name", type: "text" }, { key: "budget", label: "budget", type: "money", sum: true }, { key: "approved", label: "approved", type: "money", sum: true }, { key: "paid", label: "paid", type: "money", sum: true }, { key: "balance", label: "balance", type: "money", sum: true }, { key: "claimed_pct", label: "claimed_pct", type: "pct" }, { key: "client_pct", label: "client_pct", type: "pct" }], rows };
}

export async function supplierInvoicesReport(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const rows = await db
    .select({ i: supplierInvoices, supplier: suppliers.name, workNumber: projects.workNumber, project: projects.name, approvals: sql<string>`(select string_agg(u.first_name || ' ' || u.last_name || ': ' || a.decision, ', ') from supplier_invoice_approvals a join users u on u.id = a.user_id where a.supplier_invoice_id = "supplier_invoices"."id")` })
    .from(supplierInvoices)
    .innerJoin(contracts, eq(contracts.id, supplierInvoices.contractId))
    .innerJoin(suppliers, eq(suppliers.id, contracts.supplierId))
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .where(and(isNull(supplierInvoices.deletedAt), gte(supplierInvoices.invoiceDate, from), lte(supplierInvoices.invoiceDate, to), p.supplierIds?.length ? inArray(contracts.supplierId, p.supplierIds) : undefined, p.projectIds?.length ? inArray(projects.id, p.projectIds) : undefined))
    .orderBy(desc(supplierInvoices.invoiceDate));
  return {
    columns: [{ key: "number", label: "invoice_number", type: "text" }, { key: "supplier", label: "supplier", type: "text" }, { key: "project", label: "project", type: "text" }, { key: "date", label: "date", type: "date" }, { key: "before_vat", label: "before_vat", type: "money", sum: true }, { key: "total", label: "total", type: "money", sum: true }, { key: "claimed", label: "claimed_pct", type: "pct" }, { key: "status", label: "status", type: "text" }, { key: "approvals", label: "approvals", type: "text" }],
    rows: rows.map((r) => ({ id: r.i.id, level: 0, link: `/supplier-invoices/${r.i.id}`, cells: { number: r.i.supplierInvoiceNumber, supplier: r.supplier, project: `${r.workNumber} – ${r.project}`, date: r.i.invoiceDate, before_vat: Number(r.i.amountBeforeVat), total: Number(r.i.total), claimed: r.i.progressPctClaimed ? Number(r.i.progressPctClaimed) : null, status: r.i.status, approvals: r.approvals } })),
  };
}

export async function auditReport(p: ReportParams): Promise<ReportResult> {
  const { from, to } = defaultRange(p);
  const rows = await db
    .select({ a: auditLog, user: sql<string | null>`${users.firstName} || ' ' || ${users.lastName}` })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.changedBy))
    .where(and(gte(auditLog.changedAt, new Date(`${from}T00:00:00+03:00`)), lte(auditLog.changedAt, new Date(`${to}T23:59:59+03:00`)), p.userIds?.length ? inArray(auditLog.changedBy, p.userIds) : undefined))
    .orderBy(desc(auditLog.changedAt))
    .limit(5000);
  return {
    columns: [{ key: "time", label: "time", type: "text" }, { key: "user", label: "user", type: "text" }, { key: "table", label: "table", type: "text" }, { key: "record", label: "record", type: "text" }, { key: "action", label: "action", type: "text" }],
    rows: rows.map((r) => ({ id: r.a.id, level: 0, cells: { time: r.a.changedAt.toISOString().replace("T", " ").slice(0, 19), user: r.user ?? "system", table: r.a.tableName, record: r.a.recordId, action: r.a.action } })),
  };
}
