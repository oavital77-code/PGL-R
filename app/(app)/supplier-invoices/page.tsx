import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { can, requireAnyCapability } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { contracts, projects, supplierInvoices, suppliers } from "@/lib/db/schema";
import { formatDate, formatMoney, formatPct } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { sectionTabsFor } from "@/components/layout/nav-config";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SupplierInvoiceDialog } from "@/components/supplier-invoices/supplier-invoice-dialog";

export default async function SupplierInvoicesPage({ searchParams }: { searchParams: Promise<{ contract?: string; status?: string }> }) {
  const user = await requireAnyCapability(["supplier_invoices.manage", "supplier_invoices.approve"]);
  const sp = await searchParams;
  const [rows, cons, t, ts] = await Promise.all([
    db
      .select({ i: supplierInvoices, supplier: suppliers.name, contractName: contracts.name, contractId: contracts.id, workNumber: projects.workNumber })
      .from(supplierInvoices)
      .innerJoin(contracts, eq(contracts.id, supplierInvoices.contractId))
      .innerJoin(suppliers, eq(suppliers.id, contracts.supplierId))
      .innerJoin(projects, eq(projects.id, contracts.projectId))
      .where(and(isNull(supplierInvoices.deletedAt), sp.contract ? eq(supplierInvoices.contractId, sp.contract) : undefined, sp.status ? eq(supplierInvoices.status, sp.status as typeof supplierInvoices.$inferSelect.status) : undefined))
      .orderBy(desc(supplierInvoices.invoiceDate)),
    db.select({ id: contracts.id, label: projects.workNumber, name: contracts.name, supplier: suppliers.name }).from(contracts).innerJoin(projects, eq(projects.id, contracts.projectId)).innerJoin(suppliers, eq(suppliers.id, contracts.supplierId)).where(and(eq(contracts.direction, "expense"), isNull(contracts.deletedAt))).orderBy(projects.workNumber),
    getTranslations("supplier_invoices"),
    getTranslations("supplier_invoices.status"),
  ]);
  const tc = await getTranslations("common");
  return (
    <>
      <SectionTabs tabs={sectionTabsFor("finance", (c) => can(user, c))} />
      <PageHeader title={t("title")} actions={can(user, "supplier_invoices.manage") ? <SupplierInvoiceDialog invoice={null} contracts={cons.map((c) => ({ id: c.id, label: `${c.label} – ${c.name} (${c.supplier})` }))} defaultContractId={sp.contract} /> : undefined} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("number")}</TableHead>
            <TableHead>{t("supplier")}</TableHead>
            <TableHead>{t("contract")}</TableHead>
            <TableHead>{t("date")}</TableHead>
            <TableHead>{t("before_vat")}</TableHead>
            <TableHead>{t("total")}</TableHead>
            <TableHead>{t("progress_claimed")}</TableHead>
            <TableHead>{tc("status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("empty")}</TableCell></TableRow> : null}
          {rows.map((r) => (
            <TableRow key={r.i.id}>
              <TableCell className="num-cell"><Link href={`/supplier-invoices/${r.i.id}`} className="font-medium text-primary hover:underline">{r.i.supplierInvoiceNumber}</Link></TableCell>
              <TableCell>{r.supplier}</TableCell>
              <TableCell><Link href={`/contracts/${r.contractId}`} className="hover:underline"><span className="num">{r.workNumber}</span> – {r.contractName}</Link></TableCell>
              <TableCell className="num-cell">{formatDate(r.i.invoiceDate)}</TableCell>
              <TableCell className="num-cell">{formatMoney(r.i.amountBeforeVat)}</TableCell>
              <TableCell className="num-cell">{formatMoney(r.i.total)}</TableCell>
              <TableCell className="num-cell">{formatPct(r.i.progressPctClaimed)}</TableCell>
              <TableCell><Badge variant={r.i.status === "approved" || r.i.status === "paid" ? "success" : r.i.status === "rejected" ? "destructive" : "warning"}>{ts(r.i.status)}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
