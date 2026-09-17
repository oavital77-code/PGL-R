import "server-only";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { outer } from "@/lib/db/sql";
import { db } from "@/lib/db";
import {
  clients,
  contractStatuses,
  contracts,
  invoiceLines,
  invoices,
  milestones,
  projectCostEstimates,
  projects,
  receiptAllocations,
  subContracts,
  supplierInvoices,
  users,
  contractNotes,
} from "@/lib/db/schema";
import {
  aggregateBalances,
  computeSubContractBalances,
  computeSubContractTotal,
  milestoneAmounts,
  openingBilled,
  supplierCost,
  type BalanceInvoiceLine,
  type BalanceInvoiceRef,
  type Balances,
  type InvoiceKind,
  type InvoiceStatus,
  type PricingMethod,
} from "@/lib/calc";
import { money, sumMoney } from "@/lib/calc/money";
import { todayLocal } from "@/lib/i18n/format";

export interface MilestoneRow {
  id: string;
  name: string;
  sortOrder: number;
  pctOfSubcontract: number;
  amount: number;
  discountPct: number;
  total: number;
  openingBilledPct: number;
  openingPaidAmount: number;
  billedPct: number;
  billedAmount: number;
  paidAmount: number;
  remaining: number;
  expectedDate: string | null;
  /** true when non-cancelled invoice lines reference it */
  hasInvoiceLines: boolean;
}

export interface SubContractRow {
  id: string;
  contractId: string;
  numberInContract: number;
  name: string;
  isDefault: boolean;
  pricingMethod: PricingMethod;
  isOpen: boolean;
  milestoneBase: number | null;
  discountPct: number;
  participatesInHours: boolean;
  isLocked: boolean;
  statusCode: string | null;
  /** the status label as the client maintains it (contract_statuses.name) */
  statusName: string | null;
  balances: Balances;
  milestones: MilestoneRow[];
  hoursTotal: number;
  hoursThisYear: number;
  hoursByMonth: Record<string, number>;
  hoursCost: number;
}

export interface ContractRow {
  id: string;
  projectId: string;
  numberInProject: number;
  name: string;
  direction: "income" | "expense";
  statusCode: string | null;
  /** the status label as the client maintains it (contract_statuses.name) */
  statusName: string | null;
  signedDate: string | null;
  isLocked: boolean;
  balances: Balances;
  subContracts: SubContractRow[];
  supplierCost: number;
  lastNote: string | null;
  warnings: string[];
}

export interface ProjectRow {
  id: string;
  workNumber: string;
  name: string;
  clientId: string;
  clientName: string;
  projectManager: string | null;
  statusCode: string | null;
  /** the status label as the client maintains it (contract_statuses.name) */
  statusName: string | null;
  balances: Balances;
  contracts: ContractRow[];
  hoursTotal: number;
  hoursThisYear: number;
  hoursByMonth: Record<string, number>;
  hoursCost: number;
  supplierCost: number;
}

export interface BalancesReport {
  projects: ProjectRow[];
  months: string[];
}

export interface BalancesFilter {
  projectIds?: string[];
  clientIds?: string[];
  contractIds?: string[];
  subContractIds?: string[];
  activeOnly?: boolean;
  /** hours-by-month window (yyyy-mm) */
  monthsFrom?: string;
  monthsTo?: string;
}

const COUNTED: InvoiceStatus[] = ["approved", "signed", "sent", "partially_paid", "paid"];

/**
 * Loads everything needed for balances and runs the pure calc engine (spec §9).
 * Works for one contract or for the whole company (report fin.contract_balances).
 */
export async function contractBalancesReport(filter: BalancesFilter = {}): Promise<BalancesReport> {
  const today = todayLocal();

  // A contract-level filter must not drag every project of the company into the report:
  // restrict to the projects that own the requested contracts / sub-contracts, as a subquery
  // (no array parameter – those have misbehaved through the transaction pooler).
  const ownerFilter =
    !filter.projectIds && (filter.contractIds || filter.subContractIds)
      ? inArray(
          projects.id,
          db
            .select({ projectId: contracts.projectId })
            .from(contracts)
            .leftJoin(subContracts, eq(subContracts.contractId, contracts.id))
            .where(
              or(
                filter.contractIds ? inArray(contracts.id, filter.contractIds) : undefined,
                filter.subContractIds ? inArray(subContracts.id, filter.subContractIds) : undefined,
              ),
            ),
        )
      : undefined;

  const projWhere = and(
    isNull(projects.deletedAt),
    filter.projectIds ? inArray(projects.id, filter.projectIds) : undefined,
    ownerFilter,
    filter.clientIds ? inArray(projects.clientId, filter.clientIds) : undefined,
  );
  const projRows = await db
    .select({
      id: projects.id,
      workNumber: projects.workNumber,
      name: projects.name,
      clientId: projects.clientId,
      clientName: clients.name,
      pm: sql<string | null>`${users.firstName} || ' ' || ${users.lastName}`,
      statusCode: contractStatuses.code,
      statusName: contractStatuses.name,
    })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .leftJoin(users, eq(users.id, projects.projectManagerUserId))
    .leftJoin(contractStatuses, eq(contractStatuses.id, projects.statusId))
    .where(projWhere)
    .orderBy(projects.workNumber);
  const projectIds = projRows.map((p) => p.id);
  if (projectIds.length === 0) return { projects: [], months: [] };

  const contractRows = await db
    .select({ c: contracts, statusCode: contractStatuses.code, statusName: contractStatuses.name, isTerminal: contractStatuses.isTerminal })
    .from(contracts)
    .leftJoin(contractStatuses, eq(contractStatuses.id, contracts.statusId))
    .where(and(isNull(contracts.deletedAt), inArray(contracts.projectId, projectIds), filter.contractIds ? inArray(contracts.id, filter.contractIds) : undefined))
    .orderBy(contracts.numberInProject);
  const contractIds = contractRows.map((c) => c.c.id);
  if (contractIds.length === 0) return { projects: projRows.map((p) => emptyProject(p)), months: [] };

  const scRows = await db
    .select({ sc: subContracts, statusCode: contractStatuses.code, statusName: contractStatuses.name, isTerminal: contractStatuses.isTerminal })
    .from(subContracts)
    .leftJoin(contractStatuses, eq(contractStatuses.id, subContracts.statusId))
    .where(and(isNull(subContracts.deletedAt), inArray(subContracts.contractId, contractIds), filter.subContractIds ? inArray(subContracts.id, filter.subContractIds) : undefined))
    .orderBy(subContracts.numberInContract);
  const scIds = scRows.map((s) => s.sc.id);

  const [msRows, estRows, lineRows, invRows, teRows, costRateRows, supRows, noteRows] = await Promise.all([
    scIds.length ? db.select().from(milestones).where(and(isNull(milestones.deletedAt), inArray(milestones.subContractId, scIds))).orderBy(milestones.sortOrder) : [],
    scIds.length ? db.select().from(projectCostEstimates).where(inArray(projectCostEstimates.subContractId, scIds)) : [],
    scIds.length
      ? db
          .select({ l: invoiceLines, status: invoices.status, kind: invoices.invoiceKind })
          .from(invoiceLines)
          .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
          .where(and(inArray(invoiceLines.subContractId, scIds), isNull(invoices.deletedAt)))
      : [],
    db
      .select({
        id: invoices.id,
        status: invoices.status,
        kind: invoices.invoiceKind,
        subtotalBase: invoices.subtotalBase,
        total: invoices.total,
        allocated: sql<string>`coalesce((select sum(a.amount) from receipt_allocations a where a.invoice_id = ${outer(invoices.id)} and a.cancelled_at is null), 0)`,
      })
      .from(invoices)
      .where(and(isNull(invoices.deletedAt), inArray(invoices.contractId, contractIds))),
    // hours aggregated in SQL per sub-contract × month with the historical cost rate (spec §17 – large volumes)
    scIds.length
      ? db.execute<{ sub_contract_id: string; month: string; minutes: string; cost: string }>(sql`
          select te.sub_contract_id, to_char(te.work_date, 'YYYY-MM') as month, sum(te.minutes)::text as minutes,
                 round(sum(te.minutes / 60.0 * coalesce(r.hourly_cost, 0)), 2)::text as cost
          from time_entries te
          left join lateral (
            select hourly_cost from employee_cost_rates ecr
            where ecr.user_id = te.user_id and ecr.effective_from <= te.work_date
            order by ecr.effective_from desc limit 1
          ) r on true
          where te.deleted_at is null and te.sub_contract_id in ${scIds}
          group by te.sub_contract_id, to_char(te.work_date, 'YYYY-MM')`)
      : Promise.resolve([] as { sub_contract_id: string; month: string; minutes: string; cost: string }[]),
    Promise.resolve([] as { userId: string; effectiveFrom: string; hourlyCost: string }[]),
    db.select({ contractId: supplierInvoices.contractId, status: supplierInvoices.status, amountBeforeVat: supplierInvoices.amountBeforeVat }).from(supplierInvoices).where(and(isNull(supplierInvoices.deletedAt), inArray(supplierInvoices.contractId, contractIds))),
    db
      .select({ contractId: contractNotes.contractId, body: contractNotes.body, createdAt: contractNotes.createdAt })
      .from(contractNotes)
      .where(and(isNull(contractNotes.deletedAt), inArray(contractNotes.contractId, contractIds)))
      .orderBy(sql`${contractNotes.createdAt} desc`),
  ]);
  void receiptAllocations;

  void costRateRows;

  const invById = new Map(invRows.map((i) => [i.id, i]));
  const linesBySc = new Map<string, typeof lineRows>();
  for (const l of lineRows) (linesBySc.get(l.l.subContractId) ?? linesBySc.set(l.l.subContractId, []).get(l.l.subContractId)!).push(l);
  const msBySc = new Map<string, typeof msRows>();
  for (const m of msRows) (msBySc.get(m.subContractId) ?? msBySc.set(m.subContractId, []).get(m.subContractId)!).push(m);
  const estBySc = new Map<string, typeof estRows>();
  for (const e of estRows) (estBySc.get(e.subContractId) ?? estBySc.set(e.subContractId, []).get(e.subContractId)!).push(e);
  const teBySc = new Map<string, { month: string; minutes: number; cost: number }[]>();
  for (const t of teRows as unknown as { sub_contract_id: string; month: string; minutes: string; cost: string }[]) {
    (teBySc.get(t.sub_contract_id) ?? teBySc.set(t.sub_contract_id, []).get(t.sub_contract_id)!).push({ month: t.month, minutes: Number(t.minutes), cost: Number(t.cost) });
  }
  const lastNoteByContract = new Map<string, string>();
  for (const n of noteRows) if (!lastNoteByContract.has(n.contractId)) lastNoteByContract.set(n.contractId, n.body);
  const supByContract = new Map<string, typeof supRows>();
  for (const s of supRows) (supByContract.get(s.contractId) ?? supByContract.set(s.contractId, []).get(s.contractId)!).push(s);

  const monthsSet = new Set<string>();
  const scByContract = new Map<string, SubContractRow[]>();

  for (const { sc, statusCode, statusName, isTerminal } of scRows) {
    if (filter.activeOnly && isTerminal) continue;
    const lines = linesBySc.get(sc.id) ?? [];
    const billedSoFar = sumMoney(lines.filter((l) => COUNTED.includes(l.status)).map((l) => Number(l.l.amountThis) * (l.kind === "credit" ? -1 : 1)));
    const ests = (estBySc.get(sc.id) ?? []).filter((e) => e.effectiveFrom <= today).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
    const total = computeSubContractTotal(
      {
        pricingMethod: sc.pricingMethod,
        basePrice: num(sc.basePrice),
        discountPct: num(sc.discountPct),
        hourlyMode: sc.hourlyMode,
        customHourlyRate: num(sc.customHourlyRate),
        hoursCap: num(sc.hoursCap),
        amountCap: num(sc.amountCap),
        monthlyAmount: num(sc.monthlyAmount),
        retainerStart: sc.retainerStart,
        retainerEnd: sc.retainerEnd,
        feePct: num(sc.feePct),
        unitPrice: num(sc.unitPrice),
        agreedQuantity: num(sc.agreedQuantity),
      },
      { billedSoFar, currentEstimate: ests[0] ? Number(ests[0].amount) : null, today },
    );
    const discountPct = Number(sc.discountPct ?? 0);
    const msList = (msBySc.get(sc.id) ?? []).map((m) => {
      const base = total.milestoneBase ?? 0;
      const amounts = milestoneAmounts(base, { id: m.id, name: m.name, pctOfSubcontract: Number(m.pctOfSubcontract), discountPct: m.discountPct === null ? null : Number(m.discountPct) }, discountPct);
      const mLines = lines.filter((l) => l.l.milestoneId === m.id);
      const counted = mLines.filter((l) => COUNTED.includes(l.status));
      const billedPct = Number(m.openingBilledPct) + counted.reduce((a, l) => a + Number(l.l.progressPctThis ?? 0) * (l.kind === "credit" ? -1 : 1), 0);
      const billedAmount = money(Number(m.openingBilledPct) * amounts.total / 100 + counted.reduce((a, l) => a + Number(l.l.amountThis) * (l.kind === "credit" ? -1 : 1), 0));
      // paid per milestone: apportion invoice allocations by the milestone's share of the invoice base
      let paid = Number(m.openingPaidAmount);
      for (const l of counted) {
        const inv = invById.get(l.l.invoiceId);
        if (!inv || Number(inv.total) === 0) continue;
        paid += (Number(inv.allocated) * Number(l.l.amountThis)) / Number(inv.total);
      }
      return {
        id: m.id,
        name: m.name,
        sortOrder: m.sortOrder,
        pctOfSubcontract: Number(m.pctOfSubcontract),
        amount: amounts.amount,
        discountPct: amounts.discountPct,
        total: amounts.total,
        openingBilledPct: Number(m.openingBilledPct),
        openingPaidAmount: Number(m.openingPaidAmount),
        billedPct: Math.round(billedPct * 1000) / 1000,
        billedAmount,
        paidAmount: money(paid),
        remaining: money(amounts.total - billedAmount),
        expectedDate: m.expectedDate,
        hasInvoiceLines: mLines.some((l) => l.status !== "cancelled"),
      } satisfies MilestoneRow;
    });

    const balLines: BalanceInvoiceLine[] = lines.map((l) => ({ invoiceId: l.l.invoiceId, invoiceStatus: l.status, invoiceKind: l.kind as InvoiceKind, amountThis: Number(l.l.amountThis) }));
    const invRefs: BalanceInvoiceRef[] = [];
    const shareByInvoice = new Map<string, number>();
    for (const l of lines) shareByInvoice.set(l.l.invoiceId, (shareByInvoice.get(l.l.invoiceId) ?? 0) + Number(l.l.amountThis));
    for (const [invoiceId, share] of shareByInvoice) {
      const inv = invById.get(invoiceId);
      if (!inv) continue;
      invRefs.push({ invoiceId, status: inv.status, kind: inv.kind, subtotalBase: Number(inv.subtotalBase), total: Number(inv.total), allocated: Number(inv.allocated), subcontractShareBase: share });
    }
    const balances = computeSubContractBalances({
      totalAmount: total.isOpen ? null : total.totalAmount,
      milestones: msList.map((m) => ({ total: m.total, openingBilledPct: m.openingBilledPct, openingPaidAmount: m.openingPaidAmount })),
      lines: balLines,
      invoices: invRefs,
    });
    // open-ended: show running total as total
    if (total.isOpen) balances.totalAmount = total.totalAmount;

    const te = teBySc.get(sc.id) ?? [];
    const byMonth: Record<string, number> = {};
    let minutesTotal = 0;
    let minutesYear = 0;
    let costTotal = 0;
    for (const t of te) {
      const mk = t.month;
      if ((!filter.monthsFrom || mk >= filter.monthsFrom) && (!filter.monthsTo || mk <= filter.monthsTo)) {
        byMonth[mk] = (byMonth[mk] ?? 0) + t.minutes;
        monthsSet.add(mk);
      }
      minutesTotal += t.minutes;
      costTotal += t.cost;
      if (mk.startsWith(today.slice(0, 4))) minutesYear += t.minutes;
    }
    for (const k of Object.keys(byMonth)) byMonth[k] = Math.round((byMonth[k]! / 60) * 100) / 100;

    const row: SubContractRow = {
      id: sc.id,
      contractId: sc.contractId,
      numberInContract: sc.numberInContract,
      name: sc.name,
      isDefault: sc.isDefault,
      pricingMethod: sc.pricingMethod,
      isOpen: total.isOpen,
      milestoneBase: total.milestoneBase,
      discountPct,
      participatesInHours: sc.participatesInHours,
      isLocked: sc.isLocked,
      statusCode,
      statusName,
      balances,
      milestones: msList,
      hoursTotal: Math.round((minutesTotal / 60) * 100) / 100,
      hoursThisYear: Math.round((minutesYear / 60) * 100) / 100,
      hoursByMonth: byMonth,
      hoursCost: money(costTotal),
    };
    (scByContract.get(sc.contractId) ?? scByContract.set(sc.contractId, []).get(sc.contractId)!).push(row);
  }

  const contractsByProject = new Map<string, ContractRow[]>();
  for (const { c, statusCode, statusName, isTerminal } of contractRows) {
    if (filter.activeOnly && isTerminal) continue;
    const subs = scByContract.get(c.id) ?? [];
    const balances = aggregateBalances(subs.map((s) => s.balances));
    const warnings: string[] = [];
    if (balances.remaining !== null && balances.remaining < 0) warnings.push("negative_remaining");
    if (subs.some((s) => (s.pricingMethod === "fixed_price" || s.pricingMethod === "pct_of_cost") && Math.abs(s.milestones.reduce((a, m) => a + m.pctOfSubcontract, 0) - 100) > 0.0005)) warnings.push("milestones_not_100");
    if (c.direction === "income" && !c.signedDate) warnings.push("unsigned");
    const row: ContractRow = {
      id: c.id,
      projectId: c.projectId,
      numberInProject: c.numberInProject,
      name: c.name,
      direction: c.direction,
      statusCode,
      statusName,
      signedDate: c.signedDate,
      isLocked: c.isLocked,
      balances,
      subContracts: subs,
      supplierCost: supplierCost((supByContract.get(c.id) ?? []).map((s) => ({ status: s.status, amountBeforeVat: Number(s.amountBeforeVat) }))),
      lastNote: lastNoteByContract.get(c.id) ?? null,
      warnings,
    };
    (contractsByProject.get(c.projectId) ?? contractsByProject.set(c.projectId, []).get(c.projectId)!).push(row);
  }

  const out: ProjectRow[] = projRows.map((p) => {
    const cs = contractsByProject.get(p.id) ?? [];
    const income = cs.filter((c) => c.direction === "income");
    const byMonth: Record<string, number> = {};
    let hoursTotal = 0;
    let hoursThisYear = 0;
    let hCost = 0;
    for (const c of cs)
      for (const s of c.subContracts) {
        hoursTotal += s.hoursTotal;
        hoursThisYear += s.hoursThisYear;
        hCost += s.hoursCost;
        for (const [k, v] of Object.entries(s.hoursByMonth)) byMonth[k] = Math.round(((byMonth[k] ?? 0) + v) * 100) / 100;
      }
    return {
      ...emptyProject(p),
      balances: aggregateBalances(income.map((c) => c.balances)),
      contracts: cs,
      hoursTotal: Math.round(hoursTotal * 100) / 100,
      hoursThisYear: Math.round(hoursThisYear * 100) / 100,
      hoursByMonth: byMonth,
      hoursCost: money(hCost),
      supplierCost: sumMoney(cs.filter((c) => c.direction === "expense").map((c) => c.supplierCost)),
    };
  });

  return { projects: out, months: [...monthsSet].sort() };
}

function emptyProject(p: { id: string; workNumber: string; name: string; clientId: string; clientName: string; pm: string | null; statusCode: string | null; statusName: string | null }): ProjectRow {
  return {
    id: p.id,
    workNumber: p.workNumber,
    name: p.name,
    clientId: p.clientId,
    clientName: p.clientName,
    projectManager: p.pm,
    statusCode: p.statusCode,
    statusName: p.statusName,
    balances: aggregateBalances([]),
    contracts: [],
    hoursTotal: 0,
    hoursThisYear: 0,
    hoursByMonth: {},
    hoursCost: 0,
    supplierCost: 0,
  };
}

function num(v: string | null | undefined): number | null {
  return v === null || v === undefined ? null : Number(v);
}

export { openingBilled };
