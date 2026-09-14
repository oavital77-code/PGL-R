import Link from "next/link";
import { and, eq, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { can, requireAnyCapability } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { contracts, projects, supplierInvoiceApprovals, supplierInvoices, suppliers, users } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings/service";
import { formatDate, formatMoney, formatPct } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupplierInvoiceDialog } from "@/components/supplier-invoices/supplier-invoice-dialog";
import { DecisionButtons, MarkPaidForm } from "@/components/supplier-invoices/decision";
import { DocumentsPanel } from "@/components/shared/documents-panel";
import { AuditTable } from "@/components/audit/audit-table";

export default async function SupplierInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAnyCapability(["supplier_invoices.manage", "supplier_invoices.approve"]);
  const { id } = await params;
  const [row] = await db
    .select({ i: supplierInvoices, supplier: suppliers.name, supplierId: suppliers.id, contractName: contracts.name, contractId: contracts.id, budget: contracts.budgetAmount, workNumber: projects.workNumber, projectName: projects.name, projectId: projects.id })
    .from(supplierInvoices)
    .innerJoin(contracts, eq(contracts.id, supplierInvoices.contractId))
    .innerJoin(suppliers, eq(suppliers.id, contracts.supplierId))
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .where(and(eq(supplierInvoices.id, id), isNull(supplierInvoices.deletedAt)));
  if (!row) notFound();
  const [approvals, settings, approvers, approvedTotal, t, ts, tc] = await Promise.all([
    db.select({ a: supplierInvoiceApprovals, name: sql<string>`${users.firstName} || ' ' || ${users.lastName}` }).from(supplierInvoiceApprovals).innerJoin(users, eq(users.id, supplierInvoiceApprovals.userId)).where(eq(supplierInvoiceApprovals.supplierInvoiceId, id)),
    getSetting("suppliers"),
    db.select({ id: users.id, name: sql<string>`${users.firstName} || ' ' || ${users.lastName}` }).from(users),
    db.select({ s: sql<string>`coalesce(sum(${supplierInvoices.amountBeforeVat}),0)` }).from(supplierInvoices).where(and(eq(supplierInvoices.contractId, row.contractId), isNull(supplierInvoices.deletedAt), sql`${supplierInvoices.status} in ('approved','paid')`)),
    getTranslations("supplier_invoices"),
    getTranslations("supplier_invoices.status"),
    getTranslations("common"),
  ]);
  const i = row.i;
  const pendingApprovers = settings.approver_user_ids.filter((a) => !approvals.some((x) => x.a.userId === a)).map((a) => approvers.find((u) => u.id === a)?.name ?? a);
  const myTurn = (settings.approver_user_ids.includes(user.id) || user.role === "admin") && can(user, "supplier_invoices.approve") && (i.status === "pending" || i.status === "partially_approved") && !approvals.some((x) => x.a.userId === user.id);
  return (
    <>
      <PageHeader
        title={<span>{t("number")} <span className="num">{i.supplierInvoiceNumber}</span> <Badge variant={i.status === "approved" || i.status === "paid" ? "success" : i.status === "rejected" ? "destructive" : "warning"}>{ts(i.status)}</Badge></span>}
        description={<span className="flex flex-wrap gap-x-3"><Link href={`/suppliers/${row.supplierId}`} className="text-primary hover:underline">{row.supplier}</Link><Link href={`/contracts/${row.contractId}`} className="text-primary hover:underline"><span className="num">{row.workNumber}</span> – {row.contractName}</Link></span>}
        actions={
          <>
            {myTurn ? <DecisionButtons id={id} /> : null}
            {i.status === "approved" && can(user, "supplier_invoices.manage") ? <MarkPaidForm id={id} /> : null}
            {i.status === "pending" && can(user, "supplier_invoices.manage") ? <SupplierInvoiceDialog invoice={i} contracts={[{ id: row.contractId, label: `${row.workNumber} – ${row.contractName}` }]} /> : null}
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <dl className="grid gap-x-6 gap-y-1 rounded-lg border border-border bg-card p-4 text-sm md:grid-cols-2">
            <D l={t("date")} v={formatDate(i.invoiceDate)} /><D l={t("received_date")} v={formatDate(i.receivedDate)} />
            <D l={t("before_vat")} v={formatMoney(i.amountBeforeVat)} /><D l={t("vat")} v={formatMoney(i.vatAmount)} />
            <D l={t("total")} v={formatMoney(i.total)} /><D l={t("progress_claimed")} v={formatPct(i.progressPctClaimed)} />
            <D l={t("description")} v={i.description ?? "—"} /><D l={tc("notes")} v={i.notes ?? "—"} />
            {i.paidDate ? <D l={t("paid_date")} v={formatDate(i.paidDate)} /> : null}
          </dl>
          <DocumentsPanel entityType="supplier_invoice" entityId={id} canEdit={can(user, "supplier_invoices.manage") && i.status === "pending"} defaultType="invoice" />
          <AuditTable filter={{ recordIds: [id, ...approvals.map((a) => a.a.id)], limit: 100 }} compact />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t("approvals")} ({approvals.filter((a) => a.a.decision === "approved").length}/{settings.required_approvals})</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {approvals.map((a) => (
                <div key={a.a.id} className="rounded-md border border-border p-2">
                  <div>{a.a.decision === "approved" ? t("approved_by") : t("rejected_by")}: <strong>{a.name}</strong> · <span className="num">{formatDate(a.a.decidedAt)}</span></div>
                  {a.a.comment ? <div className="text-xs text-muted-foreground">{a.a.comment}</div> : null}
                </div>
              ))}
              {pendingApprovers.length && (i.status === "pending" || i.status === "partially_approved") ? <div className="text-xs text-muted-foreground">{t("pending_approvers")}: {pendingApprovers.join(", ")}</div> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("budget")}</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span>{t("budget")}</span><span className="num">{formatMoney(row.budget)}</span></div>
              <div className="flex justify-between"><span>{t("approved_total")}</span><span className="num">{formatMoney(approvedTotal[0]?.s)}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function D({ l, v }: { l: string; v: React.ReactNode }) {
  return <div className="flex gap-2"><dt className="shrink-0 text-muted-foreground">{l}:</dt><dd className="num">{v}</dd></div>;
}
