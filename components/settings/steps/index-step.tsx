import { desc } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { indexValues } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings/service";
import { formatDate, formatMonth } from "@/lib/i18n/format";
import { SettingsForm } from "../settings-form";
import { IndexValueForm, FetchCbsButton } from "../index-client";
import { Field } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export async function IndexStep() {
  const [s, values, t] = await Promise.all([getSetting("index"), db.select().from(indexValues).orderBy(desc(indexValues.month)).limit(60), getTranslations("settings.index")]);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardContent className="pt-5">
          <SettingsForm settingKey="index" step="index">
            <Field label={t("type")} htmlFor="type">
              <Select id="type" name="type" defaultValue="cpi" disabled>
                <option value="cpi">{t("type_cpi")}</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="cbs_auto_fetch" defaultChecked={s.cbs_auto_fetch} /> {t("cbs_auto_fetch")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="default_floor" defaultChecked={s.default_floor} /> {t("default_floor")}
            </label>
            <Field label={t("invoice_month_rule")} htmlFor="invoice_month_rule">
              <Select id="invoice_month_rule" name="invoice_month_rule" defaultValue={s.invoice_month_rule}>
                <option value="latest_known">{t("rule_latest_known")}</option>
                <option value="previous_month">{t("rule_previous_month")}</option>
              </Select>
            </Field>
          </SettingsForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t("values")}</CardTitle>
          <FetchCbsButton />
        </CardHeader>
        <CardContent className="space-y-4">
          <IndexValueForm />
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("month")}</TableHead>
                  <TableHead>{t("value")}</TableHead>
                  <TableHead>{t("source")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {values.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="num">{formatMonth(v.month)}</TableCell>
                    <TableCell className="num">{Number(v.value).toFixed(4)}</TableCell>
                    <TableCell>
                      <Badge variant={v.source === "manual" ? "warning" : "secondary"}>{t(`source_${v.source}`)}</Badge>
                    </TableCell>
                    <TableCell className="num text-xs text-muted-foreground">{v.fetchedAt ? formatDate(v.fetchedAt) : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
