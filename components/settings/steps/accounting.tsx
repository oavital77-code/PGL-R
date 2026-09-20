import { getTranslations } from "next-intl/server";
import { getSetting } from "@/lib/settings/service";
import { ACCOUNTING_EXPORT_FIELDS } from "@/lib/accounting/fields";
import { SettingsForm } from "../settings-form";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export async function AccountingStep() {
  const [s, t] = await Promise.all([getSetting("accounting"), getTranslations("settings.accounting")]);
  return (
    <Card>
      <CardContent className="pt-5">
        <SettingsForm settingKey="accounting" step="accounting">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("software_name")} htmlFor="sn">
              <Input id="sn" name="software_name" defaultValue={s.software_name} />
            </Field>
            <Field label={t("export_format")} htmlFor="ef">
              <Select id="ef" name="export_format" defaultValue={s.export_format}>
                <option value="xlsx">xlsx</option>
                <option value="csv">csv</option>
              </Select>
            </Field>
            <Field label={t("auto_export_email")} htmlFor="ae">
              <Input id="ae" name="auto_export_email" type="email" defaultValue={s.auto_export_email} />
            </Field>
            <Field label={t("frequency")} htmlFor="fr">
              <Select id="fr" name="frequency" defaultValue={s.frequency}>
                <option value="manual">{t("manual")}</option>
                <option value="daily">{t("daily")}</option>
                <option value="monthly">{t("monthly")}</option>
              </Select>
            </Field>
          </div>
          <h3 className="font-semibold">{t("field_mapping")}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("system_field")}</TableHead>
                <TableHead>{t("target_column")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ACCOUNTING_EXPORT_FIELDS.map((f) => (
                <TableRow key={f}>
                  <TableCell className="num-cell text-xs">
                    <input type="hidden" name="mapping_key" value={f} />
                    {f}
                  </TableCell>
                  <TableCell>
                    <Input name="mapping_value" defaultValue={s.field_mapping[f] ?? f} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SettingsForm>
      </CardContent>
    </Card>
  );
}
