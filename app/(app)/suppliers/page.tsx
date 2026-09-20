import Link from "next/link";
import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { outer } from "@/lib/db/sql";
import { getTranslations } from "next-intl/server";
import { can, requireCapability } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { contracts, supplierInvoices, suppliers } from "@/lib/db/schema";
import { formatMoney } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { sectionTabsFor } from "@/components/layout/nav-config";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SupplierDialog } from "@/components/suppliers/supplier-form";
import { supplierFields } from "@/lib/suppliers/queries";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ q?: string; inactive?: string }> }) {
  const user = await requireCapability("suppliers.view");
  const sp = await searchParams;
  const [rows, fields, t, tc] = await Promise.all([
    db
      .select({
        s: suppliers,
        budget: sql<string>`coalesce((select sum(${contracts.budgetAmount}) from ${contracts} where ${contracts.supplierId} = ${outer(suppliers.id)} and ${contracts.deletedAt} is null),0)`,
        approved: sql<string>`coalesce((select sum(si.amount_before_vat) from ${supplierInvoices} si join ${contracts} c on c.id = si.contract_id where c.supplier_id = ${outer(suppliers.id)} and si.status in ('approved','paid') and si.deleted_at is null),0)`,
        paid: sql<string>`coalesce((select sum(si.amount_before_vat) from ${supplierInvoices} si join ${contracts} c on c.id = si.contract_id where c.supplier_id = ${outer(suppliers.id)} and si.status = 'paid' and si.deleted_at is null),0)`,
      })
      .from(suppliers)
      .where(and(isNull(suppliers.deletedAt), sp.inactive === "1" ? undefined : eq(suppliers.isActive, true), sp.q ? or(ilike(suppliers.name, `%${sp.q}%`), ilike(suppliers.field, `%${sp.q}%`)) : undefined))
      .orderBy(asc(suppliers.name)),
    supplierFields(),
    getTranslations("suppliers"),
    getTranslations("common"),
  ]);
  return (
    <>
      <SectionTabs tabs={sectionTabsFor("crm", (c) => can(user, c))} />
      <PageHeader title={t("title")} actions={can(user, "suppliers.edit") ? <SupplierDialog supplier={null} fields={fields} /> : undefined} />
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
            <TableHead>{t("field")}</TableHead>
            <TableHead>{t("budget")}</TableHead>
            <TableHead>{t("approved")}</TableHead>
            <TableHead>{t("paid")}</TableHead>
            <TableHead>{t("balance")}</TableHead>
            <TableHead>{tc("status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.s.id}>
                <TableCell>
                  <Link href={`/suppliers/${r.s.id}`} className="font-medium text-primary hover:underline">
                    {r.s.name}
                  </Link>
                </TableCell>
                <TableCell>{r.s.field ?? "—"}</TableCell>
                <TableCell className="num-cell">{formatMoney(r.budget)}</TableCell>
                <TableCell className="num-cell">{formatMoney(r.approved)}</TableCell>
                <TableCell className="num-cell">{formatMoney(r.paid)}</TableCell>
                <TableCell className="num-cell">{formatMoney(Number(r.budget) - Number(r.approved))}</TableCell>
                <TableCell>{r.s.isActive ? <Badge variant="success">{tc("active")}</Badge> : <Badge variant="muted">{tc("inactive")}</Badge>}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}
