import { desc, eq, and, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings/service";
import { formatDate } from "@/lib/i18n/format";
import { SettingsForm } from "../settings-form";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Stat } from "@/components/ui/stat";

export async function SecurityStep() {
  const [s, t, tr, lastBackup] = await Promise.all([
    getSetting("security"),
    getTranslations("settings.security"),
    getTranslations("roles"),
    db.select({ at: documents.backedUpAt }).from(documents).where(and(isNull(documents.deletedAt), eq(documents.entityType, "company"))).orderBy(desc(documents.backedUpAt)).limit(1),
  ]);
  const backupAt = lastBackup[0]?.at ?? null;
  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="pt-5">
          <SettingsForm settingKey="security" step="security">
            <Field label={t("mfa_required_roles")}>
              <div className="flex gap-4 pt-1">
                {(["admin", "manager", "employee"] as const).map((r) => (
                  <label key={r} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="mfa_required_roles" value={r} defaultChecked={s.mfa_required_roles.includes(r)} /> {tr(r)}
                  </label>
                ))}
              </div>
            </Field>
            <Field label={t("session_hours")} htmlFor="sh" className="max-w-xs">
              <Input id="sh" name="session_hours" type="number" min="1" max="168" defaultValue={s.session_hours} />
            </Field>
          </SettingsForm>
        </CardContent>
      </Card>
      <Stat label={t("backup_status")} value={backupAt ? formatDate(backupAt) : t("no_backup")} className="max-w-xs" />
    </div>
  );
}
