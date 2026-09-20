import Link from "next/link";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { can, requireCapability } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { clients, contacts, invoices, projects, receipts } from "@/lib/db/schema";
import { contractBalancesReport } from "@/lib/reports/balances";
import { formatDate, formatMoney, formatPct, todayLocal } from "@/lib/i18n/format";
import { daysBetween, agingBucket } from "@/lib/calc/invoice";
import { getSetting } from "@/lib/settings/service";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { ClientDialog } from "@/components/clients/client-dialog";
import { ContactsPanel } from "@/components/clients/contacts-panel";
import { DocumentsPanel } from "@/components/shared/documents-panel";
import { ContractsTable } from "@/components/contracts/contracts-table";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCapability("clients.view");
  const { id } = await params;
  const [client] = await db.select().from(clients).where(and(eq(clients.id, id), isNull(clients.deletedAt)));
  if (!client) notFound();
  const today = todayLocal();
  const [ctcs, report, invs, recs, invSettings, t, tc, tk, ti] = await Promise.all([
    db.select().from(contacts).where(and(eq(contacts.clientId, id), isNull(contacts.deletedAt))).orderBy(desc(contacts.isPrimary), contacts.lastName),
    contractBalancesReport({ clientIds: [id] }),
    db
      .select({ i: invoices, workNumber: projects.workNumber })
      .from(invoices)
      .leftJoin(projects, eq(projects.id, invoices.contractId))
      .where(and(isNull(invoices.deletedAt), or(eq(invoices.clientId, id), eq(invoices.payingClientId, id))))
      .orderBy(desc(invoices.invoiceDate))
      .limit(200),
    db.select().from(receipts).where(and(eq(receipts.clientId, id), isNull(receipts.deletedAt))).orderBy(desc(receipts.receiptDate)).limit(200),
    getSetting("invoices"),
    getTranslations("clients"),
    getTranslations("common"),
    getTranslations("clients.kinds"),
    getTranslations("invoices.status"),
  ]);
  const canEdit = can(user, "clients.edit");
  const totals = report.projects.reduce(
    (a, p) => ({ total: a.total + (p.balances.totalAmount ?? 0), submitted: a.submitted + p.balances.submitted, paid: a.paid + p.balances.paid, open: a.open + p.balances.openBalance, remaining: a.remaining + (p.balances.remaining ?? 0) }),
    { total: 0, submitted: 0, paid: 0, open: 0, remaining: 0 },
  );
  const aging = invs
    .filter((r) => ["sent", "partially_paid"].includes(r.i.status))
    .map((r) => {
      const days = r.i.dueDate ? daysBetween(r.i.dueDate, today) : 0;
      return { ...r, days, bucket: agingBucket(days, invSettings.aging_thresholds) };
    });
  return (
    <>
      <PageHeader
        title={client.name}
        description={
          <span className="flex flex-wrap gap-2">
            <Badge variant="outline">{tk(client.clientKind)}</Badge>
            {client.taxId ? <span className="num">{t("tax_id")}: {client.taxId}</span> : null}
            {!client.isActive ? <Badge variant="muted">{tc("inactive")}</Badge> : null}
          </span>
        }
        actions={canEdit ? <ClientDialog client={client} /> : undefined}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label={t("contracts_total")} value={formatMoney(totals.total)} />
        <Stat label={t("submitted")} value={formatMoney(totals.submitted)} />
        <Stat label={t("paid")} value={formatMoney(totals.paid)} />
        <Stat label={t("open_balance")} value={formatMoney(totals.open)} tone={totals.open > 0 ? "warning" : "default"} />
        <Stat label={t("remaining")} value={formatMoney(totals.remaining)} />
      </div>
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{t("tab_details")}</TabsTrigger>
          <TabsTrigger value="contacts">{t("tab_contacts")}</TabsTrigger>
          <TabsTrigger value="contracts">{t("tab_contracts")}</TabsTrigger>
          <TabsTrigger value="invoices">{t("tab_invoices")}</TabsTrigger>
          <TabsTrigger value="receipts">{t("tab_receipts")}</TabsTrigger>
          <TabsTrigger value="aging">{t("tab_aging")}</TabsTrigger>
          <TabsTrigger value="documents">{t("tab_documents")}</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <dl className="grid gap-x-8 gap-y-2 rounded-lg border border-border bg-card p-5 text-sm md:grid-cols-2">
            <Row label={t("address")} value={[client.addressStreet, client.addressCity, client.addressZip].filter(Boolean).join(", ")} />
            <Row label={tc("phone")} value={client.phone} num />
            <Row label={tc("email")} value={client.email} num />
            <Row label={t("website")} value={client.website} num />
            <Row label={t("payment_terms_days")} value={client.paymentTermsDays ?? `${invSettings.default_payment_terms_days} (${tc("none")})`} num />
            <Row label={t("index_linked_default")} value={client.indexLinkedDefault === null ? t("no_default") : client.indexLinkedDefault ? tc("yes") : tc("no")} />
            <Row label={t("vat_exempt")} value={client.vatExempt ? tc("yes") : tc("no")} />
            <Row label={t("withholding_tax_pct")} value={client.withholdingTaxPct ? `${formatPct(client.withholdingTaxPct, 2)} (${t("withholding_valid_until")}: ${formatDate(client.withholdingValidUntil)})` : "—"} num />
            <Row label={tc("notes")} value={client.notes} />
          </dl>
        </TabsContent>
        <TabsContent value="contacts">
          <ContactsPanel owner={{ clientId: id }} rows={ctcs} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="contracts">
          <div className="space-y-4">
            {report.projects.map((p) => (
              <div key={p.id}>
                <h3 className="mb-2 font-semibold">
                  <Link href={`/projects/${p.id}`} className="text-primary hover:underline num">
                    {p.workNumber}
                  </Link>{" "}
                  – {p.name}
                </h3>
                <ContractsTable rows={p.contracts.filter((c) => c.direction === "income")} />
              </div>
            ))}
            {report.projects.length === 0 ? <p className="text-sm text-muted-foreground">{t("no_projects")}</p> : null}
          </div>
        </TabsContent>
        <TabsContent value="invoices">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoice_number")}</TableHead>
                <TableHead>{tc("date")}</TableHead>
                <TableHead>{t("due_date")}</TableHead>
                <TableHead>{tc("total")}</TableHead>
                <TableHead>{tc("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {tc("none")}
                  </TableCell>
                </TableRow>
              ) : (
                invs.map(({ i }) => (
                  <TableRow key={i.id}>
                    <TableCell className="num-cell">
                      <Link href={`/invoices/${i.id}`} className="text-primary hover:underline">
                        {i.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="num-cell">{formatDate(i.invoiceDate)}</TableCell>
                    <TableCell className="num-cell">{formatDate(i.dueDate)}</TableCell>
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
        <TabsContent value="receipts">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tc("date")}</TableHead>
                <TableHead>{tc("amount")}</TableHead>
                <TableHead>{t("method")}</TableHead>
                <TableHead>{t("reference")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {tc("none")}
                  </TableCell>
                </TableRow>
              ) : (
                recs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="num-cell">{formatDate(r.receiptDate)}</TableCell>
                    <TableCell className="num-cell">{formatMoney(r.amount)}</TableCell>
                    <TableCell>{r.method}</TableCell>
                    <TableCell className="num-cell">{r.reference ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="aging">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoice_number")}</TableHead>
                <TableHead>{tc("date")}</TableHead>
                <TableHead>{t("due_date")}</TableHead>
                <TableHead>{tc("total")}</TableHead>
                <TableHead>{t("days_overdue")}</TableHead>
                <TableHead>{t("bucket")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aging.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {tc("none")}
                  </TableCell>
                </TableRow>
              ) : (
                aging.map((r) => (
                  <TableRow key={r.i.id}>
                    <TableCell className="num-cell">{r.i.invoiceNumber}</TableCell>
                    <TableCell className="num-cell">{formatDate(r.i.invoiceDate)}</TableCell>
                    <TableCell className="num-cell">{formatDate(r.i.dueDate)}</TableCell>
                    <TableCell className="num-cell">{formatMoney(r.i.total)}</TableCell>
                    <TableCell className="num-cell">{r.days > 0 ? r.days : "—"}</TableCell>
                    <TableCell>{r.days > 0 ? <Badge variant={r.days > 90 ? "destructive" : "warning"}>{r.bucket}</Badge> : "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsPanel entityType="client" entityId={id} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Row({ label, value, num }: { label: string; value: React.ReactNode; num?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-40 shrink-0 text-muted-foreground">{label}</dt>
      <dd className={num ? "num" : ""}>{value || "—"}</dd>
    </div>
  );
}
