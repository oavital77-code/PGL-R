import { desc } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { vatRates } from "@/lib/db/schema";
import { vatRateFor } from "@/lib/calc/vat";
import { formatDate, formatPct, todayLocal } from "@/lib/i18n/format";
import { VatRateForm, DeleteVatRateButton } from "../vat-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export async function VatStep() {
  const [rates, t] = await Promise.all([db.select().from(vatRates).orderBy(desc(vatRates.effectiveFrom)), getTranslations("settings.vat")]);
  const current = vatRateFor(rates.map((r) => ({ rate: Number(r.rate), effectiveFrom: r.effectiveFrom })), todayLocal());
  return (
    <div className="space-y-5">
      <Stat label={t("current")} value={formatPct(current, 2)} className="max-w-xs" />
      <Card>
        <CardHeader>
          <CardTitle>{t("history")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <VatRateForm />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("rate")}</TableHead>
                <TableHead>{t("effective_from")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="num-cell">{formatPct(r.rate, 2)}</TableCell>
                  <TableCell className="num-cell">{formatDate(r.effectiveFrom)}</TableCell>
                  <TableCell className="text-end">
                    <DeleteVatRateButton id={r.id} />
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
