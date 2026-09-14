import Link from "next/link";
import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { can, requireCapability } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { clients, contracts, invoices } from "@/lib/db/schema";
import { formatMoney, todayLocal } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClientDialog } from "@/components/clients/client-dialog";
import { Badge } from "@/components/ui/badge";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; inactive?: string }> }) {
  const user = await requireCapability("clients.view");
  const sp = await searchParams;
  const today = todayLocal();
  const [rows, t, tc] = await Promise.all([
    db
      .select({
        c: clients,
        activeContracts: sql<number>`(select count(*) from ${contracts} where ${contracts.clientId} = ${clients.id} and ${contracts.deletedAt} is null and ${contracts.direction} = 'income')`,
        openBalance: sql<string>`coalesce((select sum(i.total - coalesce((select sum(a.amount) from receipt_allocations a where a.invoice_id = i.id and a.cancelled_at is null),0)) from ${invoices} i where (i.client_id = ${clients.id} or i.paying_client_id = ${clients.id}) and i.status in ('sent','partially_paid','signed','approved') and i.deleted_at is null),0)`,
        overdue: sql<number>`(select count(*) from ${invoices} i where (i.client_id = ${clients.id} or i.paying_client_id = ${clients.id}) and i.status in ('sent','partially_paid') and i.due_date < ${today} and i.deleted_at is null)`,
      })
      .from(clients)
      .where(and(isNull(clients.deletedAt), sp.inactive === "1" ? undefined : eq(clients.isActive, true), sp.q ? or(ilike(clients.name, `%${sp.q}%`), ilike(clients.taxId, `%${sp.q}%`)) : undefined))
      .orderBy(asc(clients.name)),
    getTranslations("clients"),
    getTranslations("common"),
  ]);
  return (
    <>
      <PageHeader title={t("title")} actions={can(user, "clients.edit") ? <ClientDialog client={null} /> : undefined} />
      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <Input name="q" defaultValue={sp.q ?? ""} placeholder={tc("search")} className="max-w-xs" />
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="inactive" value="1" defaultChecked={sp.inactive === "1"} /> {tc("show_inactive")}
        </label>
        <Button type="submit" variant="outline" size="sm">
          {tc("filter")}
        </Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("tax_id")}</TableHead>
            <TableHead>{t("active_contracts")}</TableHead>
            <TableHead>{t("open_balance")}</TableHead>
            <TableHead>{t("overdue")}</TableHead>
            <TableHead>{tc("status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.c.id}>
                <TableCell>
                  <Link href={`/clients/${r.c.id}`} className="font-medium text-primary hover:underline">
                    {r.c.name}
                  </Link>
                </TableCell>
                <TableCell className="num">{r.c.taxId ?? "—"}</TableCell>
                <TableCell className="num">{r.activeContracts}</TableCell>
                <TableCell className="num">{formatMoney(r.openBalance)}</TableCell>
                <TableCell className="num">{Number(r.overdue) > 0 ? <Badge variant="destructive">{r.overdue}</Badge> : "—"}</TableCell>
                <TableCell>{r.c.isActive ? <Badge variant="success">{tc("active")}</Badge> : <Badge variant="muted">{tc("inactive")}</Badge>}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}
