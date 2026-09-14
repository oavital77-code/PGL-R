"use client";
import { Lock, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import type { TimeEntryRow } from "@/lib/hours/queries";
import { dayOfWeek } from "@/lib/hours/dates";
import { formatHours } from "@/lib/i18n/format";
import { cn } from "@/lib/utils/cn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  days: string[];
  subs: { id: string; label: string }[];
  entries: TimeEntryRow[];
  stdMinutes: number;
  workDays: number[];
  lockedDays: Record<string, boolean>;
  today: string;
  canEditDay: (d: string) => boolean;
  onAdd: (d: string, subContractId?: string) => void;
  onEdit: (e: TimeEntryRow) => void;
}

/** Weekly grid (spec §10.2): rows = sub-contracts, columns = Sun…Sat, cell = HH:MM with popover of entries. */
export function WeeklyGrid({ days, subs, entries, stdMinutes, workDays, lockedDays, today, canEditDay, onAdd, onEdit }: Props) {
  const t = useTranslations("hours");
  const tu = useTranslations("users.days");
  const [extraRows, setExtraRows] = React.useState<string[]>([]);
  const rowsIds = React.useMemo(() => {
    const used = new Set(entries.map((e) => e.subContractId));
    const ids = subs.filter((s) => used.has(s.id) || extraRows.includes(s.id)).map((s) => s.id);
    // unknown (unassigned but has entries) sub-contracts
    for (const e of entries) if (!ids.includes(e.subContractId)) ids.push(e.subContractId);
    return ids;
  }, [subs, entries, extraRows]);
  const labelOf = (id: string) => subs.find((s) => s.id === id)?.label ?? entries.find((e) => e.subContractId === id)?.label ?? id;
  const cell = (scId: string, d: string) => entries.filter((e) => e.subContractId === scId && e.workDate === d);
  const dayTotal = (d: string) => entries.filter((e) => e.workDate === d).reduce((a, e) => a + e.minutes, 0);
  const rowTotal = (scId: string) => entries.filter((e) => e.subContractId === scId).reduce((a, e) => a + e.minutes, 0);
  const weekTotal = entries.reduce((a, e) => a + e.minutes, 0);
  const available = subs.filter((s) => !rowsIds.includes(s.id));
  const tone = (d: string) => {
    const m = dayTotal(d);
    if (!workDays.includes(dayOfWeek(d)) || d > today) return m > 0 ? "text-foreground" : "text-muted-foreground";
    if (m === 0) return "text-destructive";
    if (m < stdMinutes) return "text-destructive";
    if (m === stdMinutes) return "text-success";
    return "text-warning";
  };
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr>
            <th className="min-w-56 px-3 py-2 text-start font-semibold">{t("sub_contract")}</th>
            {days.map((d) => (
              <th key={d} className={cn("px-2 py-2 text-center font-semibold", workDays.includes(dayOfWeek(d)) ? "" : "text-muted-foreground", d === today && "bg-brand-50")}>
                <div>{tu(String(dayOfWeek(d)) as "0")}</div>
                <div className="text-xs font-normal num">{d.slice(8, 10)}/{d.slice(5, 7)}</div>
                {lockedDays[d] ? <Lock className="mx-auto mt-0.5 h-3 w-3 text-muted-foreground" /> : null}
              </th>
            ))}
            <th className="px-2 py-2 text-center font-semibold">{t("week_total")}</th>
          </tr>
        </thead>
        <tbody>
          {rowsIds.length === 0 ? (
            <tr>
              <td colSpan={days.length + 2} className="px-3 py-6 text-center text-muted-foreground">{t("empty_week")}</td>
            </tr>
          ) : null}
          {rowsIds.map((scId) => (
            <tr key={scId} className="border-t border-border">
              <td className="px-3 py-1.5">{labelOf(scId)}</td>
              {days.map((d) => {
                const es = cell(scId, d);
                const m = es.reduce((a, e) => a + e.minutes, 0);
                const editable = canEditDay(d) && subs.some((s) => s.id === scId);
                return (
                  <td key={d} className={cn("px-1 py-1 text-center", d === today && "bg-brand-50/50")}>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className={cn("h-8 w-full rounded-md num text-sm hover:bg-muted", m === 0 && "text-muted-foreground")}>{m > 0 ? formatHours(m) : editable ? "+" : "·"}</button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 space-y-2">
                        <div className="text-xs text-muted-foreground">{labelOf(scId)} · <span className="num">{d.split("-").reverse().join("/")}</span></div>
                        {es.length === 0 ? <p className="text-sm text-muted-foreground">{t("no_entries")}</p> : null}
                        {es.map((e) => (
                          <button key={e.id} onClick={() => onEdit(e)} className="block w-full rounded-md border border-border p-2 text-start text-sm hover:bg-muted">
                            <div className="flex justify-between">
                              <span className="num font-medium">{formatHours(e.minutes)}</span>
                              {e.startTime ? <span className="num text-xs text-muted-foreground">{e.startTime.slice(0, 5)}–{e.endTime?.slice(0, 5)}</span> : null}
                            </div>
                            <div className="text-xs">{e.description}</div>
                            {e.reportedByName ? <div className="text-[11px] text-muted-foreground">{t("reported_by", { name: e.reportedByName })}</div> : null}
                          </button>
                        ))}
                        {editable ? (
                          <button onClick={() => onAdd(d, scId)} className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border p-1.5 text-xs text-primary hover:bg-muted">
                            <Plus className="h-3 w-3" /> {t("add_entry")}
                          </button>
                        ) : null}
                      </PopoverContent>
                    </Popover>
                  </td>
                );
              })}
              <td className="px-2 py-1 text-center num font-medium">{formatHours(rowTotal(scId))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-muted/60 font-semibold">
          <tr>
            <td className="px-3 py-2">{t("day_total")} <span className="text-xs font-normal text-muted-foreground">({t("standard")} {formatHours(stdMinutes)})</span></td>
            {days.map((d) => (
              <td key={d} className={cn("px-2 py-2 text-center num", tone(d))}>{formatHours(dayTotal(d))}</td>
            ))}
            <td className="px-2 py-2 text-center num">{formatHours(weekTotal)}</td>
          </tr>
        </tfoot>
      </table>
      {available.length > 0 ? (
        <div className="flex items-center gap-2 border-t border-border p-2 text-sm">
          <span className="text-muted-foreground">{t("add_row")}:</span>
          <select className="h-8 rounded-md border border-input bg-card px-2 text-sm" value="" onChange={(e) => e.target.value && setExtraRows((r) => [...r, e.target.value])}>
            <option value="">—</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
