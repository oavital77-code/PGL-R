import { and, eq, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings/service";
import { SettingsForm } from "../settings-form";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApprovalStationsEditor } from "../approval-stations-editor";

export async function InvoicesStep() {
  const [s, admins, everyone, t] = await Promise.all([
    getSetting("invoices"),
    db.select({ id: users.id, first: users.firstName, last: users.lastName }).from(users).where(and(eq(users.role, "admin"), eq(users.isActive, true), isNull(users.deletedAt))),
    db.select({ id: users.id, first: users.firstName, last: users.lastName }).from(users).where(and(eq(users.isActive, true), isNull(users.deletedAt))).orderBy(users.firstName, users.lastName),
    getTranslations("settings.invoices"),
  ]);
  return (
    <Card>
      <CardContent className="pt-5">
        <SettingsForm settingKey="invoices" step="invoices">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("default_payment_terms_days")} htmlFor="pt">
              <Input id="pt" name="default_payment_terms_days" type="number" min="0" defaultValue={s.default_payment_terms_days} />
            </Field>
            <Field label={t("retainer_billing_day")} htmlFor="rb">
              <Input id="rb" name="retainer_billing_day" type="number" min="1" max="28" defaultValue={s.retainer_billing_day} />
            </Field>
            <Field label={t("aging_thresholds")} htmlFor="ag">
              <Input id="ag" name="aging_thresholds" defaultValue={s.aging_thresholds.join(", ")} className="num" />
            </Field>
            <Field label={t("default_signer_user_id")} htmlFor="ds">
              <Select id="ds" name="default_signer_user_id" defaultValue={s.default_signer_user_id ?? ""}>
                <option value="">—</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.first} {a.last}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("hours_line_grouping")} htmlFor="hg">
              <Select id="hg" name="hours_line_grouping" defaultValue={s.hours_line_grouping}>
                <option value="grade">{t("grouping_grade")}</option>
                <option value="employee">{t("grouping_employee")}</option>
              </Select>
            </Field>
          </div>
          <Field label={t("default_intro_text")} htmlFor="it">
            <Textarea id="it" name="default_intro_text" defaultValue={s.default_intro_text} rows={3} />
          </Field>
          <Field label={t("default_notes")} htmlFor="dn">
            <Textarea id="dn" name="default_notes" defaultValue={s.default_notes} rows={2} />
          </Field>
          <Field label={t("approval_stations")}>
            <ApprovalStationsEditor initial={s.approval_stations} users={everyone.map((u) => ({ id: u.id, name: `${u.first} ${u.last}` }))} />
          </Field>
          <Field label={t("signature_mode")} htmlFor="sm" hint={t("signature_mode_hint")}>
            <Select id="sm" name="signature_mode" defaultValue={s.signature_mode} className="max-w-md">
              <option value="manual">{t("mode_manual")}</option>
              <option value="digital">{t("mode_digital")}</option>
            </Select>
          </Field>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="attach_hours_appendix" defaultChecked={s.attach_hours_appendix} /> {t("attach_hours_appendix")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="show_withholding" defaultChecked={s.show_withholding} /> {t("show_withholding")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="show_retention" defaultChecked={s.show_retention} /> {t("show_retention")}
            </label>
          </div>
        </SettingsForm>
      </CardContent>
    </Card>
  );
}
