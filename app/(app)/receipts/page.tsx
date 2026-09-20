import Link from "next/link";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { can, requireCapability } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { clients, invoices, receiptAllocations, receipts } from "@/lib/db/schema";
import { formatDate, formatMoney } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { sectionTabsFor } from "@/components/layout/nav-config";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ReceiptDialog } from "@/components/receipts/receipt-dialog";
import { AllocationPanel } from "@/components/receipts/allocation-panel";

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<{ receipt?: string; client?: string }> }) {
  const user = await requireCapability("receipts.manage");
  const sp = await searchParams;
  const [rows, cls, t, tm] = await Promise.all([
    db
      .select({ r: receipts, clientName: clients.name, allocated: sql<string>`coalesce((select sum(a.amount) from receipt_allocations a where a.receipt_id = "receipts"."id" and a.cancelled_at is null),0)` })
      .from(receipts)
      .innerJoin(clients, eq(clients.id, receipts.clientId))
      .where(and(isNull(receipts.deletedAt), sp.client ? eq(receipts.clientId, sp.client) : undefined))
      .orderBy(desc(receipts.receiptDate))
      .limit(300),
    db.select({ id: clients.id, name: clients.name }).from(clients).where(isNull(clients.deletedAt)).orderBy(clients.name),
    getTranslations("receipts"),
    getTranslations("receipts.methods"),
  ]);
  const selected = sp.receipt ? rows.find((r) => r.r.id === sp.receipt) : undefined;
  let open: { id: string; number: string; date: string; total: number; paid: number }[] = [];
  let allocs: { id: string; number: string; amount: number; invoiceId: string }[] = [];
  if (selected) {
    const inv = await db
      .select({ id: invoices.id, number: invoices.invoiceNumber, date: invoices.invoiceDate, total: invoices.total, paid: sql<string>`coalesce((select sum(a.amount) from receipt_allocations a where a.invoice_id = "invoices"."id" and a.cancelled_at is null),0)` })
      .from(invoices)
      .where(and(inArray(invoices.status, ["sent", "partially_paid"]), isNull(invoices.deletedAt), sql`(${invoices.clientId} = ${selected.r.clientId} or ${invoices.payingClientId} = ${selected.r.clientId})`))
      .orderBy(invoices.invoiceDate);
    open = inv.map((i) => ({ id: i.id, number: i.number, date: i.date, total: Number(i.total), paid: Number(i.paid) }));
    const al = await db.select({ a: receiptAllocations, number: invoices.invoiceNumber }).from(receiptAllocations).innerJoin(invoices, eq(invoices.id, receiptAllocations.invoiceId)).where(and(eq(receiptAllocations.receiptId, selected.r.id), isNull(receiptAllocations.cancelledAt)));
    allocs = al.map((x) => ({ id: x.a.id, number: x.number, amount: Number(x.a.amount), invoiceId: x.a.invoiceId }));
  }
  return (
    <>
      <SectionTabs tabs={sectionTabsFor("finance", (c) => can(user, c))} />
      <PageHeader title={t("title")} actions={<ReceiptDialog receipt={null} clients={cls} />} />
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("client")}</TableHead>
              <TableHead>{t("amount")}</TableHead>
              <TableHead>{t("allocated")}</TableHead>
              <TableHead>{t("unallocated")}</TableHead>
              <TableHead>{t("method")}</TableHead>
              <TableHead>{t("reference")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">{t("empty")}</TableCell></TableRow>
            ) : (
              rows.map((r) => {
                const un = Number(r.r.amount) - Number(r.allocated);
                return (
                  <TableRow key={r.r.id} className={selected?.r.id === r.r.id ? "bg-brand-50" : ""}>
                    <TableCell className="num-cell">{formatDate(r.r.receiptDate)}</TableCell>
                    <TableCell><Link href={`/clients/${r.r.clientId}`} className="text-primary hover:underline">{r.clientName}</Link></TableCell>
                    <TableCell className="num-cell">{formatMoney(r.r.amount)}</TableCell>
                    <TableCell className="num-cell">{formatMoney(r.allocated)}</TableCell>
                    <TableCell className="num-cell">{un > 0.005 ? <Badge variant="warning">{formatMoney(un)}</Badge> : "—"}</TableCell>
                    <TableCell>{tm(r.r.method)}</TableCell>
                    <TableCell className="num-cell">{r.r.reference ?? "—"}</TableCell>
                    <TableCell className="text-end whitespace-nowrap">
                      <Link href={`/receipts?receipt=${r.r.id}`} className="text-sm text-primary hover:underline">{t("allocate")}</Link>
                      <span className="ms-2 inline-flex"><ReceiptDialog receipt={r.r} clients={cls} /></span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {selected ? <AllocationPanel receipt={{ id: selected.r.id, amount: Number(selected.r.amount), allocated: Number(selected.allocated), client: selected.clientName }} open={open} allocations={allocs} isAdmin={user.role === "admin"} /> : null}
      </div>
    </>
  );
}
