import Link from "next/link";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { can, requireUser } from "@/lib/auth/authorize";
import { AuthError } from "@/lib/auth/errors";
import { canManageTeam, canViewProject } from "@/lib/auth/project-access";
import { db } from "@/lib/db";
import { clients, contractStatuses, departments, grades, invoices, projects, subContractAssignments, timeEntries, users } from "@/lib/db/schema";
import { contractBalancesReport } from "@/lib/reports/balances";
import { contractFormLookups, projectFormLookups } from "@/lib/projects/lookups";
import { computeProfitability } from "@/lib/calc/profitability";
import { formatDate, formatHours, formatMoney, formatPct } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { ProjectDialog } from "@/components/projects/project-form";
import { DuplicateProjectDialog } from "@/components/projects/duplicate-project-dialog";
import { ContractsTable } from "@/components/contracts/contracts-table";
import { NewContractDialog } from "@/components/contracts/new-contract-dialog";
import { StatusBadge } from "@/components/contracts/status-badge";
import { DocumentsPanel } from "@/components/shared/documents-panel";
import { ProjectTeamPanel } from "@/components/projects/project-team-panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sql } from "drizzle-orm";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { tab } = await searchParams;
  const [row] = await db
    .select({ p: projects, client: clients.name, status: contractStatuses.code, statusName: contractStatuses.name, dept: departments.name, pm: users.firstName, pmLast: users.lastName })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .leftJoin(contractStatuses, eq(contractStatuses.id, projects.statusId))
    .leftJoin(departments, eq(departments.id, projects.departmentId))
    .leftJoin(users, eq(users.id, projects.projectManagerUserId))
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)));
  if (!row) notFound();
  if (!canViewProject(user, row.p)) throw new AuthError("FORBIDDEN");
  const [report, lookups, cLookups, payingClient, t, tc, ti] = await Promise.all([
    contractBalancesReport({ projectIds: [id] }),
    projectFormLookups(),
    contractFormLookups(),
    row.p.payingClientId ? db.select({ name: clients.name }).from(clients).where(eq(clients.id, row.p.payingClientId)) : Promise.resolve([]),
    getTranslations("projects"),
    getTranslations("common"),
    getTranslations("invoices.status"),
  ]);
  const p = report.projects[0]!;
  const income = p.contracts.filter((c) => c.direction === "income");
  const expense = p.contracts.filter((c) => c.direction === "expense");
  const profit = computeProfitability({ submitted: p.balances.submitted, hoursCost: p.hoursCost, supplierCost: p.supplierCost });
  const canEdit = can(user, "projects.edit");
  const scIds = p.contracts.flatMap((c) => c.subContracts.map((s) => s.id));
  const [team, hoursByUser, invs] = await Promise.all([
    scIds.length
      ? db
          .select({ userId: subContractAssignments.userId, subContractId: subContractAssignments.subContractId, isActive: subContractAssignments.isActive, first: users.firstName, last: users.lastName })
          .from(subContractAssignments)
          .innerJoin(users, eq(users.id, subContractAssignments.userId))
          .where(inArray(subContractAssignments.subContractId, scIds))
      : Promise.resolve([]),
    scIds.length
      ? db
          .select({ userId: timeEntries.userId, first: users.firstName, last: users.lastName, month: sql<string>`to_char(${timeEntries.workDate}, 'YYYY-MM')`, minutes: sql<number>`sum(${timeEntries.minutes})` })
          .from(timeEntries)
          .innerJoin(users, eq(users.id, timeEntries.userId))
          .where(and(inArray(timeEntries.subContractId, scIds), isNull(timeEntries.deletedAt)))
          .groupBy(timeEntries.userId, users.firstName, users.lastName, sql`to_char(${timeEntries.workDate}, 'YYYY-MM')`)
          .orderBy(sql`3 desc`)
      : Promise.resolve([]),
    income.length ? db.select().from(invoices).where(and(inArray(invoices.contractId, income.map((c) => c.id)), isNull(invoices.deletedAt))).orderBy(sql`${invoices.invoiceDate} desc`) : Promise.resolve([]),
  ]);
  const allUsers = await db
    .select({ id: users.id, first: users.firstName, last: users.lastName, department: departments.name, grade: grades.name })
    .from(users)
    .leftJoin(departments, eq(departments.id, users.departmentId))
    .leftJoin(grades, eq(grades.id, users.gradeId))
    .where(and(eq(users.isActive, true), isNull(users.deletedAt)))
    .orderBy(users.lastName, users.firstName);
  return (
    <>
      <PageHeader
        title={
          <span>
            <span className="num">{row.p.workNumber}</span> – {row.p.name}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/clients/${row.p.clientId}`} className="text-primary hover:underline">
              {row.client}
            </Link>
            {payingClient[0] ? <span className="text-xs">({t("paying_client")}: {payingClient[0].name})</span> : null}
            {row.pm ? <span>· {t("project_manager")}: {row.pm} {row.pmLast}</span> : null}
            {row.dept ? <span>· {row.dept}</span> : null}
            <StatusBadge code={row.status} name={row.statusName} />
            {row.p.statusManual ? <Badge variant="outline">{t("status_manual_short")}</Badge> : null}
          </span>
        }
        actions={
          canEdit ? (
            <>
              <NewContractDialog projectId={id} direction="income" lookups={cLookups} defaultClientId={row.p.clientId} />
              <NewContractDialog projectId={id} direction="expense" lookups={cLookups} />
              <DuplicateProjectDialog projectId={id} defaultName={row.p.name} />
              <ProjectDialog project={row.p} lookups={lookups} statusCode={row.status} />
            </>
          ) : undefined
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5 xl:grid-cols-10">
        <Stat label={t("contracts_total")} value={formatMoney(p.balances.totalAmount)} />
        <Stat label={t("submitted")} value={formatMoney(p.balances.submitted)} />
        <Stat label={t("paid")} value={formatMoney(p.balances.paid)} />
        <Stat label={t("open_balance")} value={formatMoney(p.balances.openBalance)} />
        <Stat label={t("remaining")} value={formatMoney(p.balances.remaining)} />
        <Stat label={t("progress")} value={formatPct(p.balances.progressPct)} />
        <Stat label={t("hours_total")} value={p.hoursTotal.toFixed(2)} />
        <Stat label={t("hours_cost")} value={formatMoney(p.hoursCost)} />
        <Stat label={t("supplier_cost")} value={formatMoney(p.supplierCost)} />
        <Stat label={t("profit")} value={formatMoney(profit.profit)} sub={formatPct(profit.profitPct)} tone={profit.profit < 0 ? "destructive" : "success"} />
      </div>
      <Tabs defaultValue={tab === "team" || tab === "documents" || tab === "expense" || tab === "hours" || tab === "invoices" ? tab : "income"}>
        <TabsList>
          <TabsTrigger value="income">{t("tab_client_contracts")}</TabsTrigger>
          <TabsTrigger value="expense">{t("tab_supplier_contracts")}</TabsTrigger>
          <TabsTrigger value="documents">{t("tab_documents")}</TabsTrigger>
          <TabsTrigger value="team">{t("tab_team")}</TabsTrigger>
          <TabsTrigger value="hours">{t("tab_hours")}</TabsTrigger>
          <TabsTrigger value="invoices">{t("tab_invoices")}</TabsTrigger>
        </TabsList>
        <TabsContent value="income">
          <ContractsTable rows={income} />
        </TabsContent>
        <TabsContent value="expense">
          <ContractsTable rows={expense} supplier />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsPanel entityType="project" entityId={id} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="team">
          <ProjectTeamPanel
            subContracts={p.contracts.filter((c) => c.direction === "income").flatMap((c) => c.subContracts.map((s) => ({ id: s.id, label: `${c.numberInProject}.${s.numberInContract} ${s.name}`, participates: s.participatesInHours && !c.isLocked })))}
            assignments={team.filter((a) => a.isActive).map((a) => ({ userId: a.userId, subContractId: a.subContractId }))}
            users={allUsers.map((u) => ({ id: u.id, name: `${u.first} ${u.last}`, department: u.department, grade: u.grade }))}
            canEdit={canManageTeam(user, row.p)}
          />
        </TabsContent>
        <TabsContent value="hours">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead>{t("month")}</TableHead>
                <TableHead>{t("hours")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hoursByUser.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    {tc("none")}
                  </TableCell>
                </TableRow>
              ) : (
                hoursByUser.map((h, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {h.first} {h.last}
                    </TableCell>
                    <TableCell className="num-cell">{h.month}</TableCell>
                    <TableCell className="num-cell">{formatHours(Number(h.minutes))}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="invoices">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoice_number")}</TableHead>
                <TableHead>{tc("date")}</TableHead>
                <TableHead>{t("partial_number")}</TableHead>
                <TableHead>{t("before_vat")}</TableHead>
                <TableHead>{tc("total")}</TableHead>
                <TableHead>{tc("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {tc("none")}
                  </TableCell>
                </TableRow>
              ) : (
                invs.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="num-cell">
                      <Link href={`/invoices/${i.id}`} className="text-primary hover:underline">
                        {i.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="num-cell">{formatDate(i.invoiceDate)}</TableCell>
                    <TableCell className="num-cell">{i.partialNumber}</TableCell>
                    <TableCell className="num-cell">{formatMoney(i.beforeVat)}</TableCell>
                    <TableCell className="num-cell">{formatMoney(i.total)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ti(i.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </>
  );
}
