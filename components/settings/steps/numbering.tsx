import { getTranslations } from "next-intl/server";
import { getSetting } from "@/lib/settings/service";
import { SettingsForm } from "../settings-form";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function NumberingStep() {
  const [n, t] = await Promise.all([getSetting("numbering"), getTranslations("settings.numbering")]);
  return (
    <Card>
      <CardContent className="pt-5">
        <SettingsForm settingKey="numbering" step="numbering">
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("work_number")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label={t("mode")} htmlFor="work_number.mode">
                  <Select id="work_number.mode" name="work_number.mode" defaultValue={n.work_number.mode}>
                    <option value="manual">{t("manual")}</option>
                    <option value="auto">{t("auto")}</option>
                  </Select>
                </Field>
                <Field label={t("prefix")} htmlFor="work_number.prefix">
                  <Input id="work_number.prefix" name="work_number.prefix" defaultValue={n.work_number.prefix} />
                </Field>
                <Field label={t("next")} htmlFor="work_number.next">
                  <Input id="work_number.next" name="work_number.next" type="number" min="1" defaultValue={n.work_number.next} />
                </Field>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t("invoice")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label={t("mode")} htmlFor="invoice.mode">
                  <Select id="invoice.mode" name="invoice.mode" defaultValue={n.invoice.mode}>
                    <option value="global">{t("global")}</option>
                    <option value="yearly">{t("yearly")}</option>
                  </Select>
                </Field>
                <Field label={t("prefix")} htmlFor="invoice.prefix">
                  <Input id="invoice.prefix" name="invoice.prefix" defaultValue={n.invoice.prefix} />
                </Field>
                <Field label={t("next")} htmlFor="invoice.next">
                  <Input id="invoice.next" name="invoice.next" type="number" min="1" defaultValue={n.invoice.next} />
                </Field>
                <Field label={t("year")} htmlFor="invoice.year">
                  <Input id="invoice.year" name="invoice.year" type="number" defaultValue={n.invoice.year} />
                </Field>
              </CardContent>
            </Card>
          </div>
        </SettingsForm>
      </CardContent>
    </Card>
  );
}
