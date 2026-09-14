import { getTranslations } from "next-intl/server";
import { can, requireAnyCapability } from "@/lib/auth/authorize";
import { REPORTS } from "@/lib/reports/registry";
import { filterData } from "@/lib/reports/filter-data";
import { ReportBuilder } from "@/components/reports/report-builder";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAnyCapability(["reports.hours", "reports.financial", "audit.view"]);
  const sp = await searchParams;
  const [data, t] = await Promise.all([filterData(user), getTranslations("reports")]);
  const defs = REPORTS.filter((r) => can(user, r.requiredCapability)).map((r) => ({ key: r.key, group: r.group, filters: r.filters, groupByOptions: r.groupByOptions ?? [], chartOptions: r.chartOptions }));
  const initialParams: Record<string, unknown> = {};
  if (sp.subContract) initialParams.subContractIds = [sp.subContract];
  if (sp.project) initialParams.projectIds = [sp.project];
  return <ReportBuilder defs={defs} data={data} initialKey={sp.report ?? defs[0]?.key ?? ""} initialParams={initialParams} canSchedule={can(user, "reports.schedule")} canShare={user.role === "admin"} title={t("title")} />;
}
