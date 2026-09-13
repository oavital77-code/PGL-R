import { getTranslations } from "next-intl/server";
import { getSetting } from "@/lib/settings/service";
import { SettingsForm } from "../settings-form";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

const PLACEHOLDERS = ["client_name", "contact_first_name", "invoice_number", "project_name", "work_number", "total", "due_date", "sender_name", "company_name", "report_name", "date"];

export async function EmailStep() {
  const [e, t] = await Promise.all([getSetting("email"), getTranslations("settings.email")]);
  const tpl = (key: keyof typeof e.templates, label: string) => (
    <div className="rounded-md border border-border p-3 space-y-3">
      <h4 className="font-medium">{label}</h4>
      <Field label={t("subject")} htmlFor={`templates.${key}.subject`}>
        <Input id={`templates.${key}.subject`} name={`templates.${key}.subject`} defaultValue={e.templates[key].subject} />
      </Field>
      <Field label={t("body")} htmlFor={`templates.${key}.body`}>
        <Textarea id={`templates.${key}.body`} name={`templates.${key}.body`} defaultValue={e.templates[key].body} rows={5} />
      </Field>
    </div>
  );
  return (
    <Card>
      <CardContent className="pt-5">
        <SettingsForm settingKey="email" step="email">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("from_name")} htmlFor="from_name" required>
              <Input id="from_name" name="from_name" defaultValue={e.from_name} required />
            </Field>
            <Field label={t("from_address")} htmlFor="from_address" required>
              <Input id="from_address" name="from_address" type="email" defaultValue={e.from_address} required />
            </Field>
            <Field label={t("reply_to")} htmlFor="reply_to">
              <Input id="reply_to" name="reply_to" type="email" defaultValue={e.reply_to} />
            </Field>
            <Field label={t("invoice_cc")} htmlFor="invoice_cc">
              <Input id="invoice_cc" name="invoice_cc" defaultValue={e.invoice_cc.join(", ")} className="num" />
            </Field>
          </div>
          <h3 className="mt-2 font-semibold">{t("templates")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("placeholders")}: {PLACEHOLDERS.map((p) => `{{${p}}}`).join(" ")}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {tpl("invoice", t("tpl_invoice"))}
            {tpl("hours_reminder", t("tpl_hours_reminder"))}
            {tpl("overdue", t("tpl_overdue"))}
            {tpl("scheduled_report", t("tpl_scheduled_report"))}
          </div>
        </SettingsForm>
      </CardContent>
    </Card>
  );
}
