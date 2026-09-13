import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { SessionUser } from "@/lib/auth/current-user";
import { adminKpis } from "@/lib/dashboard/admin-kpis";
import { formatHours, formatMoney } from "@/lib/i18n/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { AdminCharts } from "./admin-charts";

export async function AdminDashboard({ user }: { user: SessionUser }) {
  void user;
  const [t, ts, k] = await Promise.all([getTranslations("dashboard"), getTranslations("invoices.status"), adminKpis()]);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label={t("remaining_active")} value={formatMoney(k.remainingTotal)} />
        <Stat label={t("open_invoices")} value={formatMoney(k.openSum)} sub={t("count", { n: k.openCount })} />
        <Stat label={t("overdue_invoices")} value={formatMoney(k.overdueSum)} sub={t("count", { n: k.overdueCount })} tone={k.overdueCount > 0 ? "destructive" : "default"} />
        <Stat label={t("submitted_month")} value={formatMoney(k.submittedMonth)} sub={`${t("submitted_year")}: ${formatMoney(k.submittedYear)}`} />
        <Stat label={t("receipts_month")} value={formatMoney(k.receiptsMonth)} />
        <Stat label={t("hours_month")} value={formatHours(k.hoursMonthMinutes)} sub={t("employees_reported_n", { n: k.hoursMonthUsers })} />
        <Stat label={t("employees_behind")} value={k.behind} tone={k.behind > 0 ? "warning" : "success"} />
        <Stat label={t("supplier_pending")} value={k.pendingSupplier} tone={k.pendingSupplier > 0 ? "warning" : "default"} />
        <Stat label={t("retainer_drafts")} value={k.retainerDrafts} />
      </div>
      <AdminCharts months={k.months} topRemaining={k.topRemaining} aging={k.aging} hoursByDept={k.hoursByDept} labels={{ submitted: t("submitted"), receipts: t("receipts"), remaining: t("remaining"), amount: t("amount"), hours: t("hours"), chart_sub_vs_rec: t("chart_sub_vs_rec"), chart_top_remaining: t("chart_top_remaining"), chart_aging: t("chart_aging"), chart_hours_dept: t("chart_hours_dept") }} />
      <Card>
        <CardHeader>
          <CardTitle>{t("pending_actions")}</CardTitle>
        </CardHeader>
        <CardContent>
          {k.pendingActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {k.pendingActions.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/invoices/${p.id}`} className="text-primary hover:underline num">
                    {p.number}
                  </Link>
                  <Badge variant="secondary">{ts(p.status)}</Badge>
                  <span className="num">{formatMoney(p.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
