"use client";
import { Lock, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TimeEntryRow } from "@/lib/hours/queries";
import { formatHours } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils/cn";

export function DailyList({ date, entries, stdMinutes, isWorkDay, locked, canEdit, onEdit, onAdd }: { date: string; entries: TimeEntryRow[]; stdMinutes: number; isWorkDay: boolean; locked: boolean; canEdit: boolean; onEdit: (e: TimeEntryRow) => void; onAdd: () => void }) {
  const t = useTranslations("hours");
  const total = entries.reduce((a, e) => a + e.minutes, 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {locked ? <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> {t("locked_period")}</span> : null}
          {!isWorkDay ? <span className="ms-2">{t("non_work_day")}</span> : null}
        </div>
        {canEdit ? (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus /> {t("quick_add")}
          </Button>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("sub_contract")}</TableHead>
            <TableHead>{t("start")}</TableHead>
            <TableHead>{t("end")}</TableHead>
            <TableHead>{t("duration")}</TableHead>
            <TableHead>{t("description")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">{t("no_entries")}</TableCell>
            </TableRow>
          ) : (
            entries.map((e) => (
              <TableRow key={e.id} className="cursor-pointer" onClick={() => onEdit(e)}>
                <TableCell>{e.label}</TableCell>
                <TableCell className="num-cell">{e.startTime?.slice(0, 5) ?? "—"}</TableCell>
                <TableCell className="num-cell">{e.endTime?.slice(0, 5) ?? "—"}</TableCell>
                <TableCell className="num-cell">{formatHours(e.minutes)}</TableCell>
                <TableCell>
                  {e.description}
                  {e.reportedByName ? <span className="ms-2 text-xs text-muted-foreground">({t("reported_by", { name: e.reportedByName })})</span> : null}
                  {e.invoiceId ? <span className="ms-2 text-xs text-muted-foreground">({t("invoiced")})</span> : null}
                </TableCell>
                <TableCell className="text-end text-xs text-primary">{canEdit && !e.invoiceId ? t("edit") : ""}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>{t("day_total")} ({date.split("-").reverse().join("/")})</TableCell>
            <TableCell className={cn("num", isWorkDay && total < stdMinutes ? "text-destructive" : total > stdMinutes ? "text-warning" : "text-success")}>{formatHours(total)}</TableCell>
            <TableCell colSpan={2} className="text-xs text-muted-foreground">{t("standard")}: {formatHours(stdMinutes)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
