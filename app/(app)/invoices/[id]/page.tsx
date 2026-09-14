import Link from "next/link";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { can, requireCapability } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { clients, contracts, indexValues, invoiceLines, invoices, projects, receiptAllocations, receipts, subContracts, timeEntries, users } from "@/lib/db/schema";
import { formatDate, formatMoney, formatMonth, formatPct } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { LinesEditor } from "@/components/invoices/lines-editor";
import { HeaderForm } from "@/components/invoices/header-form";
import { WorkflowBar } from "@/components/invoices/workflow-bar";
import { TimeEntriesPanel } from "@/components/invoices/time-entries-panel";
import { AuditTable } from "@/components/audit/audit-table";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCapability("invoices.view");
  const { id } = await params;
  const [row] = await db
    .select({ i: invoices, c: contracts, workNumber: projects.workNumber, projectName: projects.name, projectId: projects.id, clientName: clients.name })
    .from(invoices)
    .innerJoin(contracts, eq(contracts.id, invoices.contractId))
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)));
  if (!row) notFound();
  const inv = row.i;
  const [lines, entries, allocs, idxMonths, admins, payers, approver, signer, original, t, tc, tp] = await Promise.all([
    db.select({ l: invoiceLines, scName: subContracts.name, scDefault: subContracts.isDefault, method: subContracts.pricingMethod }).from(invoiceLines).innerJoin(subContracts, eq(subContracts.id, invoiceLines.subContractId)).where(eq(invoiceLines.invoiceId, id)).orderBy(subContracts.numberInContract, invoiceLines.sortOrder),
    db.select({ e: timeEntries, first: users.firstName, last: users.lastName, scName: subContracts.name }).from(timeEntries).innerJoin(users, eq(users.id, timeEntries.userId)).innerJoin(subContracts, eq(subContracts.id, timeEntries.subContractId)).where(and(eq(timeEntries.invoiceId, id), isNull(timeEntries.deletedAt))).orderBy(timeEntries.workDate),
    db.select({ a: receiptAllocations, date: receipts.receiptDate, reference: receipts.reference }).from(receiptAllocations).innerJoin(receipts, eq(receipts.id, receiptAllocations.receiptId)).where(and(eq(receiptAllocations.invoiceId, id), isNull(receiptAllocations.cancelledAt))),
    db.select({ month: indexValues.month }).from(indexValues).orderBy(desc(indexValues.month)).limit(36),
    db.select({ id: users.id, first: users.firstName, last: users.lastName, sig: users.signatureImagePath }).from(users).where(and(eq(users.role, "admin"), eq(users.isActive, true))),
    db.select({ id: clients.id, name: clients.name }).from(clients).where(isNull(clients.deletedAt)).orderBy(clients.name),
    inv.approvedBy ? db.select({ n: sql<string>`${users.firstName} || ' ' || ${users.lastName}` }).from(users).where(eq(users.id, inv.approvedBy)) : Promise.resolve([]),
    inv.signedBy ? db.select({ n: sql<string>`${users.firstName} || ' ' || ${users.lastName}` }).from(users).where(eq(users.id, inv.signedBy)) : Promise.resolve([]),
    inv.creditOfInvoiceId ? db.select({ id: invoices.id, n: invoices.invoiceNumber }).from(invoices).where(eq(invoices.id, inv.creditOfInvoiceId)) : Promise.resolve([]),
    getTranslations("invoices.detail"),
    getTranslations("common"),
    getTranslations("invoices"),
  ]);
  const editable = (inv.status === "draft" || inv.status === "pending_approval") && can(user, "invoices.create");
  const paid = allocs.reduce((a, x) => a + Number(x.a.amount), 0);
  const missingIndex = inv.indexLinked && (!inv.indexCurrentValue || !inv.indexBaseValue);
  const consistency = Number(inv.subtotalBase) - lines.reduce((a, l) => a + Number(l.l.amountThis), 0) * (inv.invoiceKind === "credit" ? -1 : 1);
  return (
    <>
      <PageHeader
        title={
          <span>
            {inv.invoiceKind === "credit" ? tp("kind_credit") : tp("kind_proforma")} <span className="num">{inv.invoiceNumber}</span> <InvoiceStatusBadge status={inv.status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3">
            <Link href={`/projects/${row.projectId}`} className="text-primary hover:underline"><span className="num">{row.workNumber}</span> – {row.projectName}</Link>
            <Link href={`/contracts/${row.c.id}`} className="text-primary hover:underline">{tp("contract")} {row.c.numberInProject} – {row.c.name}</Link>
            <Link href={`/clients/${inv.clientId}`} className="text-primary hover:underline">{row.clientName}</Link>
            <span>{tp("partial")} {inv.partialNumber}</span>
            {original[0] ? <span>{t("credit_of")} <Link href={`/invoices/${original[0].id}`} className="num text-primary hover:underline">{original[0].n}</Link></span> : null}
          </span>
        }
        actions={<WorkflowBar invoice={{ id, status: inv.status, kind: inv.invoiceKind, pdfDocumentId: inv.pdfDocumentId, hasReceipts: paid > 0 }} caps={{ create: can(user, "invoices.create"), approve: can(user, "invoices.approve"), sign: can(user, "invoices.sign"), send: can(user, "invoices.send"), cancel: can(user, "invoices.cancel"), admin: user.role === "admin" }} signers={admins.filter((a) => a.sig).map((a) => ({ id: a.id, name: `${a.first} ${a.last}` }))} lines={lines.map((l) => ({ id: l.l.id, description: l.l.description ?? "", amount: Number(l.l.amountThis), type: l.l.lineType }))} />}
      />
      {missingIndex ? <Alert variant="destructive" className="mb-4"><AlertDescription>{t("missing_index")} <Link href="/settings/index" className="underline">/settings/index</Link></AlertDescription></Alert> : null}
      {Math.abs(consistency) > 0.01 ? <Alert variant="warning" className="mb-4"><AlertDescription>{t("consistency", { diff: formatMoney(consistency) })}</AlertDescription></Alert> : null}
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Tabs defaultValue="lines">
            <TabsList>
              <TabsTrigger value="lines">{t("lines")}</TabsTrigger>
              <TabsTrigger value="header">{t("header")}</TabsTrigger>
              {entries.length ? <TabsTrigger value="entries">{t("time_entries")}</TabsTrigger> : null}
              <TabsTrigger value="receipts">{t("receipts")}</TabsTrigger>
              <TabsTrigger value="history">{t("history")}</TabsTrigger>
            </TabsList>
            <TabsContent value="lines">
              <LinesEditor invoiceId={id} kind={inv.invoiceKind} editable={editable} canExtra={can(user, "invoices.approve")} groups={groupLines(lines, row.projectName)} />
            </TabsContent>
            <TabsContent value="header">
              <HeaderForm invoice={inv} editable={editable} indexMonths={idxMonths.map((m) => m.month)} payers={payers} />
            </TabsContent>
            <TabsContent value="entries">
              <TimeEntriesPanel invoiceId={id} editable={editable} rows={entries.map((e) => ({ id: e.e.id, date: e.e.workDate, name: `${e.first} ${e.last}`, sub: e.scName, minutes: e.e.minutes, description: e.e.description }))} />
            </TabsContent>
            <TabsContent value="receipts">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tc("date")}</TableHead>
                    <TableHead>{tp("detail.allocated")}</TableHead>
                    <TableHead>{tc("notes")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocs.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{tc("none")}</TableCell></TableRow>
                  ) : (
                    allocs.map((a) => (
                      <TableRow key={a.a.id}>
                        <TableCell className="num">{formatDate(a.date)}</TableCell>
                        <TableCell className="num">{formatMoney(a.a.amount)}</TableCell>
                        <TableCell className="num">{a.reference ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="history">
              <AuditTable filter={{ recordIds: [id, ...lines.map((l) => l.l.id)], limit: 200 }} compact />
            </TabsContent>
          </Tabs>
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("summary")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-1.5 text-sm">
              <S l={t("cumulative_base")} v={formatMoney(inv.cumulativeBase)} />
              <S l={t("receipts_base")} v={formatMoney(inv.receiptsBase)} />
              <S l={t("open_base")} v={formatMoney(inv.openBase)} />
              <S l={t("subtotal_base")} v={formatMoney(inv.subtotalBase)} strong />
              {inv.indexLinked ? (
                <>
                  <S l={`${t("index")} ${formatMonth(inv.indexBaseMonth)} → ${formatMonth(inv.indexMonth)}`} v={`${inv.indexBaseValue ?? "?"} → ${inv.indexCurrentValue ?? "?"} (${t("index_ratio")} ${inv.indexRatio})`} />
                  <S l={t("index_diff")} v={formatMoney(inv.indexDiff)} />
                </>
              ) : null}
              {Number(inv.retentionAmount) ? <S l={`${t("retention")} ${formatPct(inv.retentionPct, 2)}`} v={`-${formatMoney(inv.retentionAmount)}`} /> : null}
              <S l={t("before_vat")} v={formatMoney(inv.beforeVat)} />
              <S l={inv.vatExempt ? t("vat_exempt") : `${t("vat")} ${formatPct(inv.vatRate, 2)}`} v={formatMoney(inv.vatAmount)} />
              <S l={t("total")} v={formatMoney(inv.total)} strong />
              {inv.expectedReceipt ? <S l={t("expected_receipt")} v={formatMoney(inv.expectedReceipt)} /> : null}
              <S l={tp("due_date")} v={formatDate(inv.dueDate)} />
              {paid > 0 ? <S l={t("remaining_to_pay")} v={formatMoney(Number(inv.total) - paid)} /> : null}
            </dl>
            <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              {approver[0] ? <div>{t("approved_by")}: {approver[0].n} · <span className="num">{formatDate(inv.approvedAt)}</span></div> : null}
              {signer[0] ? <div>{t("signed_by")}: {signer[0].n}{inv.signatureTitleSnapshot ? `, ${inv.signatureTitleSnapshot}` : ""} · <span className="num">{formatDate(inv.signedAt)}</span></div> : null}
              {inv.sentAt ? <div>{t("sent_at")}: <span className="num">{formatDate(inv.sentAt)}</span> · {t("sent_to")}: {(inv.sentTo?.to ?? []).map((x) => x.email).join(", ")}</div> : null}
              {inv.cancelReason ? <div className="text-destructive">{t("cancel_reason")}: {inv.cancelReason}</div> : null}
              {inv.pdfDocumentId ? <a href={`/api/files/${inv.pdfDocumentId}`} className="text-primary hover:underline">{t("download_pdf")}</a> : null}
              {inv.vatOverrideReason ? <div><Badge variant="warning">{t("vat_override_reason")}</Badge> {inv.vatOverrideReason}</div> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function S({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${strong ? "font-semibold" : ""}`}>
      <dt className="text-muted-foreground">{l}</dt>
      <dd className="num">{v}</dd>
    </div>
  );
}

function groupLines(lines: { l: typeof invoiceLines.$inferSelect; scName: string; scDefault: boolean; method: string }[], projectName: string) {
  const g = new Map<string, { title: string; method: string; lines: (typeof invoiceLines.$inferSelect)[] }>();
  for (const r of lines) {
    const key = r.l.lineType === "extra" || r.l.lineType === "adjustment" ? "__extras" : r.l.subContractId;
    const cur = g.get(key) ?? { title: key === "__extras" ? "" : r.scDefault ? projectName : r.scName, method: key === "__extras" ? "extras" : r.method, lines: [] };
    cur.lines.push(r.l);
    g.set(key, cur);
  }
  return [...g.entries()].map(([subContractId, v]) => ({ subContractId, ...v, lines: v.lines.map((l) => ({ ...l })) }));
}
