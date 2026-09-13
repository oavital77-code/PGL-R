import { and, eq, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings/service";
import { SettingsForm } from "../settings-form";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export async function SuppliersStep() {
  const [s, admins, t] = await Promise.all([
    getSetting("suppliers"),
    db.select({ id: users.id, first: users.firstName, last: users.lastName }).from(users).where(and(eq(users.role, "admin"), eq(users.isActive, true), isNull(users.deletedAt))),
    getTranslations("settings.suppliers"),
  ]);
  return (
    <Card>
      <CardContent className="pt-5">
        <SettingsForm settingKey="suppliers" step="suppliers">
          <Field label={t("approver_user_ids")}>
            <div className="flex flex-wrap gap-3 pt-1">
              {admins.map((a) => (
                <label key={a.id} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" name="approver_user_ids" value={a.id} defaultChecked={s.approver_user_ids.includes(a.id)} /> {a.first} {a.last}
                </label>
              ))}
            </div>
          </Field>
          <Field label={t("required_approvals")} htmlFor="ra" className="max-w-xs">
            <Input id="ra" name="required_approvals" type="number" min="1" defaultValue={s.required_approvals} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="over_budget_alert" defaultChecked={s.over_budget_alert} /> {t("over_budget_alert")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="progress_vs_client_alert" defaultChecked={s.progress_vs_client_alert} /> {t("progress_vs_client_alert")}
          </label>
        </SettingsForm>
      </CardContent>
    </Card>
  );
}
