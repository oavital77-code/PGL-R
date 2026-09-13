import { getTranslations } from "next-intl/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { billingRates, grades } from "@/lib/db/schema";
import { formatDate, formatMoney } from "@/lib/i18n/format";
import { LookupTable } from "../lookup-table";
import { BillingRateForm, DeleteBillingRateButton } from "../billing-rates-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export async function RatesStep() {
  const [gr, rates, t] = await Promise.all([db.select().from(grades).orderBy(grades.sortOrder), db.select().from(billingRates).orderBy(desc(billingRates.effectiveFrom)), getTranslations("settings.rates")]);
  const gradeName = new Map(gr.map((g) => [g.id, g.name]));
  return (
    <div className="space-y-5">
      <LookupTable table="grades" rows={gr} title={t("grades")} addLabel={t("add_grade")} />
      <Card>
        <CardHeader>
          <CardTitle>{t("billing_rates")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BillingRateForm grades={gr.filter((g) => g.isActive).map((g) => ({ id: g.id, name: g.name }))} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("grade")}</TableHead>
                <TableHead>{t("hourly_rate")}</TableHead>
                <TableHead>{t("effective_from")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{gradeName.get(r.gradeId)}</TableCell>
                  <TableCell className="num">{formatMoney(r.hourlyRate)}</TableCell>
                  <TableCell className="num">{formatDate(r.effectiveFrom)}</TableCell>
                  <TableCell className="text-end">
                    <DeleteBillingRateButton id={r.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
