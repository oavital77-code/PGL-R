import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { SessionUser } from "@/lib/auth/current-user";
import { employeeHoursSummary } from "@/lib/hours/summary";
import { formatHours } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { HoursByProjectChart } from "./hours-by-project-chart";

export async function EmployeeDashboard({ user }: { user: SessionUser }) {
  const t = await getTranslations("dashboard");
  const s = await employeeHoursSummary(user.id);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("my_hours_week")} value={formatHours(s.weekMinutes)} sub={`${t("standard")}: ${formatHours(s.weekStandardMinutes)}`} tone={s.weekMinutes >= s.weekStandardMinutes ? "success" : "warning"} />
        <Stat label={t("my_hours_month")} value={formatHours(s.monthMinutes)} sub={`${t("standard")}: ${formatHours(s.monthStandardMinutes)}`} tone={s.monthMinutes >= s.monthStandardMinutes ? "success" : "warning"} />
        <Stat label={t("missing_days")} value={s.missingDays.length} tone={s.missingDays.length > 0 ? "destructive" : "success"} />
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border">
          <Button asChild size="lg">
            <Link href="/hours">{t("report_now")}</Link>
          </Button>
        </div>
      </div>
      <HoursByProjectChart title={t("hours_by_project")} data={s.byProject} />
    </div>
  );
}
