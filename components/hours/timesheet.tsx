"use client";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import type { TimeEntryRow } from "@/lib/hours/queries";
import { addMonths, daysBetweenInclusive, dayOfWeek, shiftDays } from "@/lib/hours/dates";
import { formatDate } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EntryDialog, type EntryDraft } from "./entry-dialog";
import { WeeklyGrid } from "./weekly-grid";
import { DailyList } from "./daily-list";
import { MonthlyCalendar } from "./monthly-calendar";
import { CopyWeekDialog } from "./copy-week-dialog";

export interface TimesheetProps {
  view: "daily" | "weekly" | "monthly";
  date: string;
  from: string;
  to: string;
  today: string;
  targetUserId: string;
  meId: string;
  people: { id: string; name: string }[];
  subs: { id: string; label: string }[];
  entries: TimeEntryRow[];
  stdMinutes: number;
  workDays: number[];
  employmentStart: string | null;
  lockedDays: Record<string, boolean>;
  canReport: boolean;
  canEditLocked: boolean;
  allowFuture: boolean;
}

export function Timesheet(p: TimesheetProps) {
  const t = useTranslations("hours");
  const router = useRouter();
  const sp = useSearchParams();
  const [draft, setDraft] = React.useState<EntryDraft | null>(null);

  const nav = (patch: Record<string, string>) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) q.set(k, v);
    router.push(`/hours?${q.toString()}`);
  };
  const step = (dir: -1 | 1) => nav({ date: p.view === "monthly" ? addMonths(p.date, dir) : p.view === "weekly" ? shiftDays(p.date, 7 * dir) : shiftDays(p.date, dir) });
  const canEditDay = (d: string) => p.canReport && (p.canEditLocked || !p.lockedDays[d]) && (p.allowFuture || d <= p.today);
  const openNew = (d: string, subContractId?: string) => setDraft({ workDate: d, subContractId: subContractId ?? p.subs[0]?.id ?? "" });
  const openEdit = (e: TimeEntryRow) => setDraft({ id: e.id, workDate: e.workDate, subContractId: e.subContractId, startTime: e.startTime ?? "", endTime: e.endTime ?? "", minutes: e.minutes, description: e.description, invoiced: Boolean(e.invoiceId) });

  const rangeLabel = p.view === "monthly" ? `${p.date.slice(5, 7)}/${p.date.slice(0, 4)}` : p.view === "weekly" ? `${formatDate(p.from)} – ${formatDate(p.to)}` : formatDate(p.date);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <div className="inline-flex rounded-md border border-input">
          {(["daily", "weekly", "monthly"] as const).map((v) => (
            <button key={v} onClick={() => nav({ view: v })} className={`px-3 py-1.5 text-sm ${p.view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"} first:rounded-s-md last:rounded-e-md`}>
              {t(`view_${v}`)}
            </button>
          ))}
        </div>
        {p.people.length > 0 ? (
          <Select className="w-56" value={p.targetUserId} onChange={(e) => nav({ user: e.target.value })}>
            {!p.people.some((x) => x.id === p.meId) ? <option value={p.meId}>{t("me")}</option> : null}
            {p.people.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id === p.meId ? `${u.name} (${t("me")})` : u.name}
              </option>
            ))}
          </Select>
        ) : null}
        <div className="ms-auto flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => step(-1)} aria-label={t("prev")}>
            <ChevronRight className="rtl:block ltr:hidden" />
            <ChevronLeft className="ltr:block rtl:hidden" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => nav({ date: p.today })}>
            {t("today")}
          </Button>
          <input type="date" value={p.date} onChange={(e) => e.target.value && nav({ date: e.target.value })} className="h-8 rounded-md border border-input bg-card px-2 text-sm num" />
          <Button variant="outline" size="icon" onClick={() => step(1)} aria-label={t("next")}>
            <ChevronLeft className="rtl:block ltr:hidden" />
            <ChevronRight className="ltr:block rtl:hidden" />
          </Button>
          <span className="ms-2 text-sm font-medium num">{rangeLabel}</span>
        </div>
        {p.canReport && p.subs.length > 0 ? (
          <div className="flex gap-2">
            {p.view === "weekly" ? <CopyWeekDialog userId={p.targetUserId} weekStart={p.from} subs={p.subs} canEditDay={canEditDay} /> : null}
            <Button size="sm" onClick={() => openNew(p.view === "daily" ? p.date : p.today >= p.from && p.today <= p.to ? p.today : p.from)}>
              <Plus /> {t("add_entry")}
            </Button>
          </div>
        ) : null}
      </div>

      {p.view === "weekly" ? (
        <WeeklyGrid days={daysBetweenInclusive(p.from, p.to)} subs={p.subs} entries={p.entries} stdMinutes={p.stdMinutes} workDays={p.workDays} lockedDays={p.lockedDays} canEditDay={canEditDay} onAdd={openNew} onEdit={openEdit} today={p.today} />
      ) : p.view === "daily" ? (
        <DailyList date={p.date} entries={p.entries} stdMinutes={p.stdMinutes} isWorkDay={p.workDays.includes(dayOfWeek(p.date))} locked={Boolean(p.lockedDays[p.date])} canEdit={canEditDay(p.date)} onEdit={openEdit} onAdd={() => openNew(p.date)} />
      ) : (
        <MonthlyCalendar from={p.from} to={p.to} entries={p.entries} stdMinutes={p.stdMinutes} workDays={p.workDays} employmentStart={p.employmentStart} today={p.today} lockedDays={p.lockedDays} onDay={(d) => nav({ view: "daily", date: d })} />
      )}

      {draft ? <EntryDialog userId={p.targetUserId} subs={p.subs} draft={draft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); router.refresh(); }} onSaveAndNew={(d) => { setDraft({ workDate: d.workDate, subContractId: d.subContractId }); router.refresh(); }} /> : null}
    </div>
  );
}
