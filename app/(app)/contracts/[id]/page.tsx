import Link from "next/link";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { can, requireCapability } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { clients, contractNotes, contractRoles, contractStatuses, contractTypes, contracts, contacts, departments, invoices, projects, stageNames, suppliers, users } from "@/lib/db/schema";
import { contractBalancesReport } from "@/lib/reports/balances";
import { contractFormLookups } from "@/lib/projects/lookups";
import { formatDate, formatMoney, formatMonth, formatPct } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/contracts/status-badge";
import { ContractEditDialog } from "@/components/contracts/contract-edit-dialog";
import { ContractActions } from "@/components/contracts/contract-actions";
import { RolesPanel } from "@/components/contracts/roles-panel";
import { NotesPanel } from "@/components/contracts/notes-panel";
import { DocumentsPanel } from "@/components/shared/documents-panel";
import { AuditTable } from "@/components/audit/audit-table";
import { SubContractDialog, SubContractRowActions } from "@/components/sub-contracts/sub-contract-dialog";
import { MilestonesEditor } from "@/components/sub-contracts/milestones-editor";
import { Lock } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCapability("contracts.view");
  const { id } = await params;
  const [row] = await db
    .select({ c: contracts, project: projects, client: clients.name, status: contractStatuses.code, statusName: contractStatuses.name, type: contractTypes.name, supplier: suppliers.name, creator: sql<string | null>`${users.firstName} || ' ' || ${users.lastName}` })
    .from(contracts)
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .leftJoin(clients, eq(clients.id, contracts.clientId))
    .leftJoin(suppliers, eq(suppliers.id, contracts.supplierId))
    .leftJoin(contractStatuses, eq(contractStatuses.id, contracts.statusId))
    .leftJoin(contractTypes, eq(contractTypes.id, contracts.contractTypeId))
    .leftJoin(users, eq(users.id, contracts.createdBy))
    .where(and(eq(contracts.id, id), isNull(contracts.deletedAt)));
  if (!row) notFound();
  const c = row.c;
  const [report, lookups, roles, notes, invs, payingClient, dept, supplierList, allUsers, clientContacts, roleTitles, stageNamesList, t, tc, tp, f] = await Promise.all([
    contractBalancesReport({ contractIds: [id] }),
    contractFormLookups(),
    db
      .select({ r: contractRoles, userName: sql<string | null>`${users.firstName} || ' ' || ${users.lastName}`, contactName: sql<string | null>`${contacts.firstName} || ' ' || ${contacts.lastName}` })
      .from(contractRoles)
      .leftJoin(users, eq(users.id, contractRoles.userId))
      .leftJoin(contacts, eq(contacts.id, contractRoles.contactId))
      .where(and(eq(contractRoles.contractId, id), isNull(contractRoles.deletedAt))),
    db
      .select({ n: contractNotes, author: sql<string>`${users.firstName} || ' ' || ${users.lastName}` })
      .from(contractNotes)
      .innerJoin(users, eq(users.id, contractNotes.userId))
      .where(and(eq(contractNotes.contractId, id), isNull(contractNotes.deletedAt)))
      .orderBy(desc(contractNotes.createdAt)),
    db.select().from(invoices).where(and(eq(invoices.contractId, id), isNull(invoices.deletedAt))).orderBy(desc(invoices.invoiceDate)),
    c.payingClientId ? db.select({ name: clients.name }).from(clients).where(eq(clients.id, c.payingClientId)) : Promise.resolve([]),
    row.project.departmentId ? db.select({ name: departments.name }).from(departments).where(eq(departments.id, row.project.departmentId)) : Promise.resolve([]),
    db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(and(isNull(suppliers.deletedAt), eq(suppliers.isActive, true))).orderBy(suppliers.name),
    db.select({ id: users.id, first: users.firstName, last: users.lastName }).from(users).where(and(eq(users.isActive, true), isNull(users.deletedAt))).orderBy(users.lastName),
    c.clientId ? db.select({ id: contacts.id, first: contacts.firstName, last: contacts.lastName }).from(contacts).where(and(eq(contacts.clientId, c.clientId), isNull(contacts.deletedAt))) : Promise.resolve([]),
    db.selectDistinct({ t: contractRoles.roleTitle }).from(contractRoles),
    db.select({ id: stageNames.id, name: stageNames.name }).from(stageNames).where(eq(stageNames.isActive, true)).orderBy(stageNames.sortOrder),
    getTranslations("contracts"),
    getTranslations("common"),
    getTranslations("pricing"),
    getFormatter(),
  ]);
  const cr = report.projects[0]?.contracts[0];
  if (!cr) notFound();
  const canEdit = can(user, "contracts.edit") && !c.isLocked;
  const me = await getCurrentUser();
  const subs = cr.subContracts;
  const singleDefault = subs.length === 1 && subs[0]!.isDefault;
  const requiresSubReporting = !singleDefault;
  const isSupplier = c.direction === "expense";
  return (
    <>
      <PageHeader
        title={
          <span>
            {t("contract")} {c.numberInProject} – {c.name}
            {c.isLocked ? <Lock className="ms-2 inline h-5 w-5 text-muted-foreground" aria-label={tc("locked")} /> : null}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link href={`/projects/${row.project.id}`} className="text-primary hover:underline">
              <span className="num">{row.project.workNumber}</span> – {row.project.name}
            </Link>
            {isSupplier ? (
              <Link href={`/suppliers/${c.supplierId}`} className="text-primary hover:underline">
                {row.supplier}
              </Link>
            ) : (
              <Link href={`/clients/${c.clientId}`} className="text-primary hover:underline">
                {row.client}
              </Link>
            )}
            {payingClient[0] ? <span className="text-xs">({t("paying_client")}: {payingClient[0].name})</span> : null}
            <StatusBadge code={row.status} name={row.statusName} />
            {c.statusManual ? <Badge variant="outline">{t("status_manual_short")}</Badge> : null}
          </span>
        }
        actions={
          can(user, "contracts.edit") ? (
            <>
              <ContractEditDialog contract={c} lookups={lookups} suppliers={supplierList} statusCode={row.status} />
              <ContractActions id={id} projectId={c.projectId} isLocked={c.isLocked} statusManual={c.statusManual} statusCode={row.status} statuses={lookups.statuses} canUnlock={can(user, "contracts.unlock")} canEdit={can(user, "contracts.edit")} />
            </>
          ) : undefined
        }
      />
      <dl className="mb-4 grid gap-x-6 gap-y-1 rounded-lg border border-border bg-card p-4 text-sm md:grid-cols-3 lg:grid-cols-4">
        <D l={t("order_number")} v={c.orderNumber} num />
        <D l={t("contract_type")} v={row.type} />
        <D l={t("signed_date")} v={formatDate(c.signedDate)} num />
        <D l={t("target_date")} v={formatDate(c.targetDate)} num />
        <D l={t("department")} v={dept[0]?.name} />
        <D l={t("index_linked")} v={c.indexLinked ? `${tc("yes")} · ${t("index_base_month")} ${formatMonth(c.indexBaseMonth)}${c.indexFloor ? ` · ${t("index_floor")}` : ""}` : tc("no")} />
        {!isSupplier ? <D l={t("participates_in_hours")} v={c.participatesInHours ? tc("yes") : tc("no")} /> : null}
        {!isSupplier ? <D l={t("requires_sub_reporting")} v={requiresSubReporting ? tc("yes") : tc("no")} /> : null}
        {isSupplier ? <D l={t("budget_amount")} v={formatMoney(c.budgetAmount ?? subs.reduce((a, s) => a + (s.balances.totalAmount ?? 0), 0))} num /> : null}
        {c.retentionPct ? <D l={t("retention_pct")} v={formatPct(c.retentionPct, 2)} num /> : null}
        <D l={tc("description")} v={c.description} />
        <div className="md:col-span-3 lg:col-span-4 text-xs text-muted-foreground">{t("created_line", { n: c.numberInProject, date: formatDate(c.openingDate ?? c.createdAt), by: row.creator ?? "" })}</div>
      </dl>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label={t("total")} value={formatMoney(cr.balances.totalAmount)} />
        <Stat label={t("submitted")} value={formatMoney(cr.balances.submitted)} />
        <Stat label={t("paid")} value={formatMoney(cr.balances.paid)} />
        <Stat label={t("open_balance")} value={formatMoney(cr.balances.openBalance)} tone={cr.balances.openBalance > 0 ? "warning" : "default"} />
        <Stat label={t("remaining")} value={formatMoney(cr.balances.remaining)} />
        <Stat label={t("progress")} value={formatPct(cr.balances.progressPct)} />
      </div>
      <Tabs defaultValue={singleDefault ? "pricing" : "subs"}>
        <TabsList>
          {singleDefault ? <TabsTrigger value="pricing">{t("tab_pricing")}</TabsTrigger> : <TabsTrigger value="subs">{t("tab_sub_contracts")}</TabsTrigger>}
          <TabsTrigger value="notes">{t("tab_notes")}</TabsTrigger>
          <TabsTrigger value="roles">{t("tab_roles")}</TabsTrigger>
          <TabsTrigger value="documents">{t("tab_documents")}</TabsTrigger>
          <TabsTrigger value="invoices">{isSupplier ? t("tab_supplier_invoices") : t("tab_invoices")}</TabsTrigger>
          <TabsTrigger value="history">{tc("history")}</TabsTrigger>
        </TabsList>
        {singleDefault ? (
          <TabsContent value="pricing">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span>
                    <span className="text-muted-foreground">{tp("method")}:</span> {tp(subs[0]!.pricingMethod)}
                  </span>
                  <span>
                    <span className="text-muted-foreground">{t("total")}:</span> <span className="num">{formatMoney(subs[0]!.balances.totalAmount)}</span>
                    {subs[0]!.isOpen ? <Badge variant="muted" className="ms-1">{tp("open")}</Badge> : null}
                  </span>
                  {subs[0]!.discountPct ? <span className="num">{tp("discount_pct")}: {formatPct(subs[0]!.discountPct, 2)}</span> : null}
                </div>
                <div className="flex gap-2">
                  {canEdit ? <SubContractDialog contractId={id} subContractId={subs[0]!.id} lookups={lookups} label={t("edit_pricing")} isSupplier={isSupplier} /> : null}
                  {canEdit ? <SubContractDialog contractId={id} lookups={lookups} label={t("add_sub_contract")} isSupplier={isSupplier} /> : null}
                  <Link href={`/sub-contracts/${subs[0]!.id}`} className="text-sm text-primary hover:underline self-center">
                    {t("open_sub_contract")}
                  </Link>
                </div>
              </div>
              {subs[0]!.pricingMethod === "fixed_price" || subs[0]!.pricingMethod === "pct_of_cost" ? (
                <MilestonesEditor subContractId={subs[0]!.id} base={subs[0]!.milestoneBase ?? 0} defaultDiscount={subs[0]!.discountPct} rows={subs[0]!.milestones} stageNames={stageNamesList} templates={lookups.templates} canEdit={canEdit && !subs[0]!.isLocked} isAdmin={me?.role === "admin"} />
              ) : null}
            </div>
          </TabsContent>
        ) : (
          <TabsContent value="subs">
            <div className="space-y-3">
              {canEdit ? (
                <div className="flex justify-end">
                  <SubContractDialog contractId={id} lookups={lookups} label={t("add_sub_contract")} isSupplier={isSupplier} />
                </div>
              ) : null}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{tc("name")}</TableHead>
                    <TableHead>{tp("method")}</TableHead>
                    <TableHead>{t("total")}</TableHead>
                    <TableHead>{t("submitted")}</TableHead>
                    <TableHead>{t("remaining")}</TableHead>
                    <TableHead>{t("paid")}</TableHead>
                    <TableHead>{t("open_balance")}</TableHead>
                    {!isSupplier ? <TableHead>{t("participates_in_hours_short")}</TableHead> : null}
                    <TableHead>{tc("locked")}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subs.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="num">{s.numberInContract}</TableCell>
                      <TableCell>
                        <Link href={`/sub-contracts/${s.id}`} className="font-medium text-primary hover:underline">
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell>{tp(s.pricingMethod)}</TableCell>
                      <TableCell className="num">
                        {formatMoney(s.balances.totalAmount)} {s.isOpen ? <Badge variant="muted">{tp("open")}</Badge> : null}
                      </TableCell>
                      <TableCell className="num">{formatMoney(s.balances.submitted)}</TableCell>
                      <TableCell className="num">{formatMoney(s.balances.remaining)}</TableCell>
                      <TableCell className="num">{formatMoney(s.balances.paid)}</TableCell>
                      <TableCell className="num">{formatMoney(s.balances.openBalance)}</TableCell>
                      {!isSupplier ? <TableCell>{s.participatesInHours ? "✔" : "—"}</TableCell> : null}
                      <TableCell>{s.isLocked ? <Lock className="h-4 w-4 text-muted-foreground" /> : ""}</TableCell>
                      <TableCell className="text-end">{canEdit ? <SubContractRowActions contractId={id} subContractId={s.id} lookups={lookups} isSupplier={isSupplier} isLocked={s.isLocked} /> : null}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3}>{tc("total")}</TableCell>
                    <TableCell className="num">{formatMoney(cr.balances.totalAmount)}</TableCell>
                    <TableCell className="num">{formatMoney(cr.balances.submitted)}</TableCell>
                    <TableCell className="num">{formatMoney(cr.balances.remaining)}</TableCell>
                    <TableCell className="num">{formatMoney(cr.balances.paid)}</TableCell>
                    <TableCell className="num">{formatMoney(cr.balances.openBalance)}</TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </TabsContent>
        )}
        <TabsContent value="notes">
          <NotesPanel contractId={id} rows={notes.map(({ n, author }) => ({ id: n.id, body: n.body, author, createdAt: f.dateTime(n.createdAt, { dateStyle: "short", timeStyle: "short" }), canDelete: me?.role === "admin" || (n.userId === me?.id && Date.now() - n.createdAt.getTime() < 86_400_000) }))} />
        </TabsContent>
        <TabsContent value="roles">
          <RolesPanel
            contractId={id}
            rows={roles.map(({ r, userName, contactName }) => ({ id: r.id, roleTitle: r.roleTitle, userId: r.userId, contactId: r.contactId, freeName: r.freeName, notes: r.notes, display: userName ?? contactName ?? r.freeName ?? "—" }))}
            users={allUsers.map((u) => ({ id: u.id, name: `${u.first} ${u.last}` }))}
            contacts={clientContacts.map((x) => ({ id: x.id, name: `${x.first} ${x.last}` }))}
            roleTitles={roleTitles.map((x) => x.t)}
            canEdit={can(user, "contracts.edit")}
          />
        </TabsContent>
        <TabsContent value="documents">
          <div className="space-y-4">
            {can(user, "contracts.edit") ? <p className="text-sm text-muted-foreground">{t("signed_contract_hint")}</p> : null}
            <DocumentsPanel entityType="contract" entityId={id} canEdit={can(user, "contracts.edit")} defaultType="signed_contract" />
          </div>
        </TabsContent>
        <TabsContent value="invoices">
          {isSupplier ? (
            <p className="text-sm text-muted-foreground">
              <Link href={`/supplier-invoices?contract=${id}`} className="text-primary hover:underline">
                {t("tab_supplier_invoices")}
              </Link>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoice_number")}</TableHead>
                  <TableHead>{t("partial_number")}</TableHead>
                  <TableHead>{tc("date")}</TableHead>
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
                      <TableCell className="num">
                        <Link href={`/invoices/${i.id}`} className="text-primary hover:underline">
                          {i.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="num">{i.partialNumber}</TableCell>
                      <TableCell className="num">{formatDate(i.invoiceDate)}</TableCell>
                      <TableCell className="num">{formatMoney(i.beforeVat)}</TableCell>
                      <TableCell className="num">{formatMoney(i.total)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{i.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>
        <TabsContent value="history">
          <AuditTable filter={{ recordIds: [id, ...subs.map((s) => s.id), ...subs.flatMap((s) => s.milestones.map((m) => m.id))], limit: 200 }} />
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
