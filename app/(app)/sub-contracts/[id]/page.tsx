import Link from "next/link";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { can, requireUser } from "@/lib/auth/authorize";
import { AuthError } from "@/lib/auth/errors";
import { canManageTeam, canViewProject } from "@/lib/auth/project-access";
import { getCurrentUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { contractNotes, contractStatuses, contracts, departments, grades, invoiceLines, invoices, projectCostEstimates, projects, stageNames, subContractAssignments, subContracts, timeEntries, users } from "@/lib/db/schema";
import { contractBalancesReport } from "@/lib/reports/balances";
import { contractFormLookups } from "@/lib/projects/lookups";
import { formatDate, formatHours, formatMoney, formatMonth, formatPct } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/contracts/status-badge";
import { NotesPanel } from "@/components/contracts/notes-panel";
import { AuditTable } from "@/components/audit/audit-table";
import { MilestonesEditor } from "@/components/sub-contracts/milestones-editor";
import { AssignmentsPanel } from "@/components/sub-contracts/assignments-panel";
import { EstimatesPanel } from "@/components/sub-contracts/estimates-panel";
import { SubContractDialog } from "@/components/sub-contracts/sub-contract-dialog";
import { SubContractLockButton } from "@/components/sub-contracts/lock-button";
import { Lock } from "lucide-react";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { currentStation } from "@/lib/invoices/approval-chain";

export default async function SubContractPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [row] = await db
    .select({ s: subContracts, c: contracts, p: projects, status: contractStatuses.code, statusName: contractStatuses.name, dept: departments.name })
    .from(subContracts)
    .innerJoin(contracts, eq(contracts.id, subContracts.contractId))
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .leftJoin(contractStatuses, eq(contractStatuses.id, subContracts.statusId))
    .leftJoin(departments, eq(departments.id, subContracts.departmentId))
    .where(and(eq(subContracts.id, id), isNull(subContracts.deletedAt)));
  if (!row) notFound();
  const { s, c, p } = row;
  if (!canViewProject(user, p, "contracts.view")) throw new AuthError("FORBIDDEN");
  const isSupplier = c.direction === "expense";
  const [report, lookups, sn, assigned, allUsers, hours, lines, ests, notes, me, t, tc, tp, f] = await Promise.all([
    contractBalancesReport({ contractIds: [c.id], subContractIds: [id] }),
    contractFormLookups(),
    db.select({ id: stageNames.id, name: stageNames.name }).from(stageNames).where(eq(stageNames.isActive, true)).orderBy(stageNames.sortOrder),
    db.select({ userId: subContractAssignments.userId }).from(subContractAssignments).where(and(eq(subContractAssignments.subContractId, id), eq(subContractAssignments.isActive, true))),
    db.select({ id: users.id, first: users.firstName, last: users.lastName, dept: departments.name, grade: grades.name }).from(users).leftJoin(departments, eq(departments.id, users.departmentId)).leftJoin(grades, eq(grades.id, users.gradeId)).where(and(eq(users.isActive, true), isNull(users.deletedAt))).orderBy(users.lastName, users.firstName),
    db
      .select({ userId: timeEntries.userId, first: users.firstName, last: users.lastName, month: sql<string>`to_char(${timeEntries.workDate}, 'YYYY-MM')`, minutes: sql<number>`sum(${timeEntries.minutes})` })
      .from(timeEntries)
      .innerJoin(users, eq(users.id, timeEntries.userId))
      .where(and(eq(timeEntries.subContractId, id), isNull(timeEntries.deletedAt)))
      .groupBy(timeEntries.userId, users.firstName, users.lastName, sql`to_char(${timeEntries.workDate}, 'YYYY-MM')`)
      .orderBy(sql`4 desc`),
    db
      .select({ l: invoiceLines, number: invoices.invoiceNumber, status: invoices.status, date: invoices.invoiceDate, invoiceId: invoices.id, approvalChain: invoices.approvalChain, approvalStep: invoices.approvalStep })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
      .where(and(eq(invoiceLines.subContractId, id), isNull(invoices.deletedAt)))
      .orderBy(desc(invoices.invoiceDate)),
    db.select().from(projectCostEstimates).where(eq(projectCostEstimates.subContractId, id)).orderBy(desc(projectCostEstimates.effectiveFrom)),
    db.select({ n: contractNotes, author: sql<string>`${users.firstName} || ' ' || ${users.lastName}` }).from(contractNotes).innerJoin(users, eq(users.id, contractNotes.userId)).where(and(eq(contractNotes.subContractId, id), isNull(contractNotes.deletedAt))).orderBy(desc(contractNotes.createdAt)),
    getCurrentUser(),
    getTranslations("sub_contracts"),
    getTranslations("common"),
    getTranslations("pricing"),
    getFormatter(),
  ]);
  const sr = report.projects.flatMap((p) => p.contracts).flatMap((x) => x.subContracts).find((x) => x.id === id);
  if (!sr) notFound();
  const locked = s.isLocked || c.isLocked;
  const canEdit = can(user, "contracts.edit") && !locked;
  const hasMilestones = s.pricingMethod === "fixed_price" || s.pricingMethod === "pct_of_cost";
  // one row per invoice, whatever number of lines of this sub-contract it carries
  const invoiceRows = [...lines.reduce((acc, { l, number, status, date, invoiceId, approvalChain, approvalStep }) => {
    const r = acc.get(invoiceId) ?? { invoiceId, number, status, date, station: currentStation({ status, approvalChain, approvalStep })?.name ?? null, items: [] as string[], amount: 0 };
    if (Number(l.amountThis) !== 0) r.items.push(`${l.description ?? ""}${l.progressPctThis ? ` ${formatPct(l.progressPctThis, 0)}` : ""}`.trim());
    r.amount += Number(l.amountThis);
    acc.set(invoiceId, r);
    return acc;
  }, new Map<string, { invoiceId: string; number: string; status: string; date: string; station: string | null; items: string[]; amount: number }>()).values()];

  return (
    <>
      <PageHeader
        title={
          <span>
            {t("sub_contract")} {c.numberInProject}.{s.numberInContract} – {s.name}
            {locked ? <Lock className="ms-2 inline h-5 w-5 text-muted-foreground" /> : null}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href={`/projects/${p.id}`} className="text-primary hover:underline">
              <span className="num">{p.workNumber}</span> – {p.name}
            </Link>
            <Link href={`/contracts/${c.id}`} className="text-primary hover:underline">
              {t("contract")} {c.numberInProject} – {c.name}
            </Link>
            <StatusBadge code={row.status} name={row.statusName} />
            {s.isDefault ? <Badge variant="outline">{t("default")}</Badge> : null}
          </span>
        }
        actions={
          can(user, "contracts.edit") ? (
            <>
              {!locked ? <SubContractDialog contractId={c.id} sc={s} lookups={lookups} label={tc("edit")} isSupplier={isSupplier} statusCode={row.status} /> : null}
              <SubContractLockButton id={id} isLocked={s.isLocked} canUnlock={can(user, "contracts.unlock")} canEdit={can(user, "contracts.edit") && !c.isLocked} />
            </>
          ) : undefined
        }
      />
      <dl className="mb-4 grid gap-x-6 gap-y-1 rounded-lg border border-border bg-card p-4 text-sm md:grid-cols-3 lg:grid-cols-4">
        <D l={t("opening_date")} v={formatDate(s.openingDate)} num />
        <D l={t("department")} v={row.dept ?? t("inherit")} />
        <D l={tp("method")} v={tp(s.pricingMethod)} />
        <D l={t("index_linked")} v={s.indexLinked ? `${tc("yes")}${s.indexBaseMonth ? ` · ${formatMonth(s.indexBaseMonth)}` : ""}${s.indexFloor ? ` · ${t("index_floor")}` : ""}` : tc("no")} />
        {!isSupplier ? <D l={t("participates_in_hours")} v={s.participatesInHours ? tc("yes") : tc("no")} /> : null}
        {s.pricingMethod === "fixed_price" ? (
          <>
            <D l={tp("base_price")} v={formatMoney(s.basePrice)} num />
            <D l={tp("discount_pct")} v={formatPct(s.discountPct, 2)} num />
          </>
        ) : null}
        {s.pricingMethod === "hourly" ? (
          <>
            <D l={tp("hourly_mode")} v={s.hourlyMode === "custom" ? `${tp("custom_rate")} ${formatMoney(s.customHourlyRate)}` : tp("rate_card")} num />
            <D l={tp("hours_cap")} v={s.hoursCap ?? "—"} num />
            <D l={tp("amount_cap")} v={s.amountCap ? formatMoney(s.amountCap) : "—"} num />
          </>
        ) : null}
        {s.pricingMethod === "retainer" ? (
          <>
            <D l={tp("monthly_amount")} v={formatMoney(s.monthlyAmount)} num />
            <D l={tp("retainer_start")} v={formatDate(s.retainerStart)} num />
            <D l={tp("retainer_end")} v={s.retainerEnd ? formatDate(s.retainerEnd) : tp("open")} num />
            <D l={tp("retainer_billing_day")} v={s.retainerBillingDay ?? "—"} num />
          </>
        ) : null}
        {s.pricingMethod === "pct_of_cost" ? (
          <>
            <D l={tp("fee_pct")} v={formatPct(s.feePct, 3)} num />
            <D l={tp("discount_pct")} v={formatPct(s.discountPct, 2)} num />
            <D l={tp("current_estimate")} v={ests[0] ? formatMoney(ests[0].amount) : "—"} num />
          </>
        ) : null}
        {s.pricingMethod === "per_unit" ? (
          <>
            <D l={tp("unit_type")} v={lookups.unitTypes.find((u) => u.id === s.unitTypeId)?.name} />
            <D l={tp("unit_price")} v={formatMoney(s.unitPrice)} num />
            <D l={tp("agreed_quantity")} v={s.agreedQuantity ?? tp("open")} num />
          </>
        ) : null}
        <D l={tc("notes")} v={s.notes} />
      </dl>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label={t("total")} value={formatMoney(sr.balances.totalAmount)} sub={sr.isOpen ? tp("open") : undefined} />
        <Stat label={t("submitted")} value={formatMoney(sr.balances.submitted)} />
        <Stat label={t("paid")} value={formatMoney(sr.balances.paid)} />
        <Stat label={t("open_balance")} value={formatMoney(sr.balances.openBalance)} />
        <Stat label={t("remaining")} value={formatMoney(sr.balances.remaining)} />
        <Stat label={t("progress")} value={formatPct(sr.balances.progressPct)} />
      </div>
      <Tabs defaultValue={hasMilestones ? "milestones" : "team"}>
        <TabsList>
          {hasMilestones ? <TabsTrigger value="milestones">{t("tab_milestones")}</TabsTrigger> : null}
          {!isSupplier ? <TabsTrigger value="team">{t("tab_team")}</TabsTrigger> : null}
          {!isSupplier ? <TabsTrigger value="hours">{t("tab_hours")}</TabsTrigger> : null}
          <TabsTrigger value="invoices">{t("tab_invoices")}</TabsTrigger>
          <TabsTrigger value="notes">{t("tab_notes")}</TabsTrigger>
          <TabsTrigger value="history">{tc("history")}</TabsTrigger>
        </TabsList>
        {hasMilestones ? (
          <TabsContent value="milestones">
            <div className="space-y-5">
              {s.pricingMethod === "pct_of_cost" ? <EstimatesPanel subContractId={id} rows={ests} canEdit={canEdit} /> : null}
              <MilestonesEditor subContractId={id} base={sr.milestoneBase ?? 0} defaultDiscount={sr.discountPct} rows={sr.milestones} stageNames={sn} templates={lookups.templates} canEdit={canEdit} isAdmin={me?.role === "admin"} />
            </div>
          </TabsContent>
        ) : null}
        <TabsContent value="team">
          <AssignmentsPanel subContractId={id} users={allUsers.map((u) => ({ id: u.id, name: `${u.first} ${u.last}`, department: u.dept, grade: u.grade }))} assigned={assigned.map((a) => a.userId)} canEdit={canManageTeam(user, p)} />
        </TabsContent>
        <TabsContent value="hours">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("hours_total")}: <span className="num font-medium">{sr.hoursTotal.toFixed(2)}</span> · {t("hours_this_year")}: <span className="num font-medium">{sr.hoursThisYear.toFixed(2)}</span> ·{" "}
              <Link href={`/reports?report=hours.detailed&subContract=${id}`} className="text-primary hover:underline">
                {t("hours_report_link")}
              </Link>
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("employee")}</TableHead>
                  <TableHead>{t("month")}</TableHead>
                  <TableHead>{t("hours")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hours.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">{tc("none")}</TableCell>
                  </TableRow>
                ) : (
                  hours.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell>{h.first} {h.last}</TableCell>
                      <TableCell className="num-cell">{h.month}</TableCell>
                      <TableCell className="num-cell">{formatHours(Number(h.minutes))}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="invoices">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoice_number")}</TableHead>
                <TableHead>{tc("date")}</TableHead>
                <TableHead>{tc("status")}</TableHead>
                <TableHead>{t("invoice_lines_here")}</TableHead>
                <TableHead>{t("amount_this")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoiceRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">{tc("none")}</TableCell>
                </TableRow>
              ) : (
                invoiceRows.map((r) => (
                  <TableRow key={r.invoiceId}>
                    <TableCell className="num-cell">
                      <Link href={`/invoices/${r.invoiceId}`} className="text-primary hover:underline">{r.number}</Link>
                    </TableCell>
                    <TableCell className="num-cell">{formatDate(r.date)}</TableCell>
                    <TableCell><InvoiceStatusBadge status={r.status} station={r.station} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.items.join(" · ") || "—"}</TableCell>
                    <TableCell className="num-cell font-medium">{formatMoney(r.amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="notes">
          <NotesPanel contractId={c.id} subContractId={id} rows={notes.map(({ n, author }) => ({ id: n.id, body: n.body, author, createdAt: f.dateTime(n.createdAt, { dateStyle: "short", timeStyle: "short" }), canDelete: me?.role === "admin" || (n.userId === me?.id && Date.now() - n.createdAt.getTime() < 86_400_000) }))} />
        </TabsContent>
        <TabsContent value="history">
          <AuditTable filter={{ recordIds: [id, ...sr.milestones.map((m) => m.id)], limit: 200 }} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function D({ l, v, num }: { l: string; v: React.ReactNode; num?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-muted-foreground">{l}:</dt>
      <dd className={num ? "num" : ""}>{v || "—"}</dd>
    </div>
  );
}
