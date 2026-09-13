import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { SessionUser } from "@/lib/auth/current-user";
import { departmentHoursSummary } from "@/lib/hours/summary";
import { formatHours } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HoursByProjectChart } from "./hours-by-project-chart";

export async function ManagerDashboard({ user }: { user: SessionUser }) {
  const t = await getTranslations("dashboard");
  const s = await departmentHoursSummary(user.othersScope === "all" ? null : user.departmentId);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("dept_hours_month")} value={formatHours(s.monthMinutes)} sub={`${t("standard")}: ${formatHours(s.monthStandardMinutes)}`} />
        <Stat label={t("employees_behind")} value={s.behind.length} tone={s.behind.length > 0 ? "warning" : "success"} />
        <Stat label={t("employees_reported")} value={`${s.reportedCount}/${s.employeeCount}`} />
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border">
          <Button asChild>
            <Link href="/hours">{t("open_timesheet")}</Link>
          </Button>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <HoursByProjectChart title={t("hours_by_project")} data={s.byProject} />
        <Card>
          <CardHeader>
            <CardTitle>{t("employees_behind")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("employee")}</TableHead>
                  <TableHead>{t("last_report")}</TableHead>
                  <TableHead>{t("days_behind")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.behind.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      {t("none")}
                    </TableCell>
                  </TableRow>
                ) : (
                  s.behind.map((b) => (
                    <TableRow key={b.userId}>
                      <TableCell>
                        <Link href={`/hours?user=${b.userId}`} className="text-primary hover:underline">
                          {b.name}
                        </Link>
                      </TableCell>
                      <TableCell className="num">{b.lastDate ?? "—"}</TableCell>
                      <TableCell className="num">{b.daysBehind}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
