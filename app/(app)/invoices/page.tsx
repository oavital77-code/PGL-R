import Link from "next/link";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { can, requireCapability } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { clients, contracts, invoices, projects } from "@/lib/db/schema";
import { formatDate, formatMoney } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { sectionTabsFor } from "@/components/layout/nav-config";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { InvoiceStatusBadge } from "@/components/invoices/status-badge";
import { currentStation } from "@/lib/invoices/approval-chain";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCapability("invoices.view");
  const sp = await searchParams;
  const [rows, cls, t, tc] = await Promise.all([
    db
      .select({ i: invoices, clientName: clients.name, workNumber: projects.workNumber, projectName: projects.name, paid: sql<string>`coalesce((select sum(a.amount) from receipt_allocations a where a.invoice_id = "invoices"."id" and a.cancelled_at is null),0)` })
      .from(invoices)
      .innerJoin(contracts, eq(contracts.id, invoices.contractId))
      .innerJoin(projects, eq(projects.id, contracts.projectId))
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(
        and(
          isNull(invoices.deletedAt),
          sp.status ? eq(invoices.status, sp.status as typeof invoices.$inferSelect.status) : undefined,
          sp.client ? eq(invoices.clientId, sp.client) : undefined,
          sp.year ? sql`extract(year from ${invoices.invoiceDate}) = ${Number(sp.year)}` : undefined,
          sp.q ? sql`(${invoices.invoiceNumber} ilike ${"%" + sp.q + "%"} or ${projects.workNumber} ilike ${"%" + sp.q + "%"} or ${projects.name} ilike ${"%" + sp.q + "%"})` : undefined,
        ),
      )
      .orderBy(desc(invoices.invoiceDate), desc(invoices.sequenceNo))
      .limit(300),
    db.select({ id: clients.id, name: clients.name }).from(clients).where(isNull(clients.deletedAt)).orderBy(clients.name),
    getTranslations("invoices"),
    getTranslations("common"),
  ]);
  const statuses = ["draft", "pending_approval", "approved", "signed", "sent", "partially_paid", "paid", "cancelled"] as const;
  return (
    <>
      <SectionTabs tabs={sectionTabsFor("finance", (c) => can(user, c))} />
      <PageHeader
        title={t("title")}
        actions={
          <>
            <Button asChild variant="outline">
              <a href="/api/exports/accounting?kind=invoices">{t("export_accounting")}</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/api/exports/accounting?kind=receipts">{t("export_receipts")}</a>
            </Button>
            {can(user, "invoices.create") ? (
              <Button asChild>
                <Link href="/invoices/new">{t("new")}</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <Input name="q" defaultValue={sp.q ?? ""} placeholder={tc("search")} className="max-w-xs" />
        <Select name="status" defaultValue={sp.status ?? ""} className="w-44">
          <option value="">{tc("all")}</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{t(`status.${s}`)}</option>
          ))}
        </Select>
        <Select name="client" defaultValue={sp.client ?? ""} className="w-56">
          <option value="">{tc("all")}</option>
          {cls.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Input name="year" type="number" defaultValue={sp.year ?? ""} placeholder={t("filter_year")} className="w-28" />
        <Button type="submit" variant="outline" size="sm">{tc("filter")}</Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("number")}</TableHead>
            <TableHead>{t("kind")}</TableHead>
            <TableHead>{t("date")}</TableHead>
            <TableHead>{t("client")}</TableHead>
            <TableHead>{t("project")}</TableHead>
            <TableHead>{t("partial")}</TableHead>
            <TableHead>{t("before_vat")}</TableHead>
            <TableHead>{t("total")}</TableHead>
            <TableHead>{t("paid")}</TableHead>
            <TableHead>{t("due_date")}</TableHead>
            <TableHead>{tc("status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center text-muted-foreground">{t("empty")}</TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.i.id}>
                <TableCell className="num-cell">
                  <Link href={`/invoices/${r.i.id}`} className="font-medium text-primary hover:underline">{r.i.invoiceNumber}</Link>
                </TableCell>
                <TableCell>{r.i.invoiceKind === "credit" ? <Badge variant="warning">{t("kind_credit")}</Badge> : t("kind_proforma")}</TableCell>
                <TableCell className="num-cell">{formatDate(r.i.invoiceDate)}</TableCell>
                <TableCell>{r.clientName}</TableCell>
                <TableCell><span className="num">{r.workNumber}</span> – {r.projectName}</TableCell>
                <TableCell className="num-cell">{r.i.partialNumber}</TableCell>
                <TableCell className="num-cell">{formatMoney(r.i.beforeVat)}</TableCell>
                <TableCell className="num-cell">{formatMoney(r.i.total)}</TableCell>
                <TableCell className="num-cell">{formatMoney(r.paid)}</TableCell>
                <TableCell className="num-cell">{formatDate(r.i.dueDate)}</TableCell>
                <TableCell><InvoiceStatusBadge status={r.i.status} station={currentStation(r.i)?.name} /></TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}
