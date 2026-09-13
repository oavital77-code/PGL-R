import { getTranslations } from "next-intl/server";
import { getSetting } from "@/lib/settings/service";
import { SettingsForm } from "../settings-form";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

export async function HoursStep() {
  const [h, t, tu] = await Promise.all([getSetting("hours"), getTranslations("settings.hours"), getTranslations("users.days")]);
  return (
    <Card>
      <CardContent className="pt-5">
        <SettingsForm settingKey="hours" step="hours">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("default_standard_hours_per_day")} htmlFor="std">
              <Input id="std" name="default_standard_hours_per_day" type="number" step="0.25" min="1" max="24" defaultValue={h.default_standard_hours_per_day} />
            </Field>
            <Field label={t("default_work_days")}>
              <div className="flex flex-wrap gap-3 pt-1">
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <label key={d} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="default_work_days" value={d} defaultChecked={h.default_work_days.includes(d)} /> {tu(String(d) as "0")}
                  </label>
                ))}
              </div>
            </Field>
            <Field label={t("lock_rule")} htmlFor="lock_rule">
              <Select id="lock_rule" name="lock_rule" defaultValue={h.lock_rule}>
                <option value="end_of_next_month">{t("lock_end_of_next_month")}</option>
                <option value="end_of_month">{t("lock_end_of_month")}</option>
                <option value="never">{t("lock_never")}</option>
              </Select>
            </Field>
            <Field label={t("max_minutes_per_day")} htmlFor="max">
              <Input id="max" name="max_minutes_per_day" type="number" min="60" max="1440" defaultValue={h.max_minutes_per_day} />
            </Field>
            <Field label={t("reminder_days")} htmlFor="rd">
              <Input id="rd" name="reminder_days" type="number" min="1" defaultValue={h.reminder_days} />
            </Field>
            <Field label={t("reminder_repeat_days")} htmlFor="rr">
              <Input id="rr" name="reminder_repeat_days" type="number" min="1" defaultValue={h.reminder_repeat_days} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="notify_department_manager" defaultChecked={h.notify_department_manager} /> {t("notify_department_manager")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="allow_future_dates" defaultChecked={h.allow_future_dates} /> {t("allow_future_dates")}
          </label>
        </SettingsForm>
      </CardContent>
    </Card>
  );
}
