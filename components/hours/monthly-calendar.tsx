"use client";
import { useTranslations } from "next-intl";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { TimeEntryRow } from "@/lib/hours/queries";
import { dayOfWeek, daysBetweenInclusive } from "@/lib/hours/dates";
import { formatHours } from "@/lib/i18n/format";
import { Stat } from "@/components/ui/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";

const COLORS = ["#2a3380", "#4453bd", "#8a97df", "#38bdf8", "#0ea5e9", "#7dd3fc", "#b3bbeb", "#075985"];

export function MonthlyCalendar({ from, to, entries, stdMinutes, workDays, employmentStart, today, lockedDays, onDay }: { from: string; to: string; entries: TimeEntryRow[]; stdMinutes: number; workDays: number[]; employmentStart: string | null; today: string; lockedDays: Record<string, boolean>; onDay: (d: string) => void }) {
  const t = useTranslations("hours");
  const tu = useTranslations("users.days");
  const days = daysBetweenInclusive(from, to);
  const byDay = new Map<string, number>();
  for (const e of entries) byDay.set(e.workDate, (byDay.get(e.workDate) ?? 0) + e.minutes);
  const isWork = (d: string) => workDays.includes(dayOfWeek(d)) && d <= today && (!employmentStart || d >= employmentStart);
  const total = entries.reduce((a, e) => a + e.minutes, 0);
  const std = days.filter(isWork).length * stdMinutes;
  const byProject = new Map<string, number>();
  for (const e of entries) {
    const key = e.label.split(" – ").slice(0, 2).join(" – ");
    byProject.set(key, (byProject.get(key) ?? 0) + e.minutes);
  }
  const pie = [...byProject.entries()].map(([name, m]) => ({ name, hours: Math.round((m / 60) * 100) / 100 })).sort((a, b) => b.hours - a.hours);
  const leading = dayOfWeek(from);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t("month_total")} value={formatHours(total)} />
        <Stat label={t("standard")} value={formatHours(std)} />
        <Stat label={t("gap")} value={formatHours(Math.abs(total - std))} tone={total >= std ? "success" : "destructive"} sub={total >= std ? t("above_standard") : t("below_standard")} />
      </div>
      <div className="grid grid-cols-7 gap-1 rounded-lg border border-border bg-card p-2">
        {[0, 1, 2, 3, 4, 5, 6].map((d) => (
          <div key={d} className="py-1 text-center text-xs font-semibold text-muted-foreground">{tu(String(d) as "0")}</div>
        ))}
        {Array.from({ length: leading }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((d) => {
          const m = byDay.get(d) ?? 0;
          const work = isWork(d);
          const cls = !work ? "bg-muted/40 text-muted-foreground" : m === 0 ? "bg-red-50 text-red-800" : m < stdMinutes ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800";
          return (
            <button key={d} onClick={() => onDay(d)} className={cn("flex h-16 flex-col items-center justify-center rounded-md border border-border text-sm hover:ring-2 hover:ring-ring", cls, d === today && "ring-2 ring-primary")}>
              <span className="num text-xs">{d.slice(8, 10)}</span>
              <span className="num font-medium">{m > 0 ? formatHours(m) : work ? "—" : ""}</span>
              {lockedDays[d] ? <span className="text-[10px]">🔒</span> : null}
            </button>
          );
        })}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("project")}</TableHead>
              <TableHead>{t("hours")}</TableHead>
              <TableHead>%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pie.map((p) => (
              <TableRow key={p.name}>
                <TableCell>{p.name}</TableCell>
                <TableCell className="num-cell">{p.hours.toFixed(2)}</TableCell>
                <TableCell className="num-cell">{total ? ((p.hours * 60 * 100) / total).toFixed(1) : "0"}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="h-64">
          {pie.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="hours" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={2}>
                  {pie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </div>
    </div>
  );
}
