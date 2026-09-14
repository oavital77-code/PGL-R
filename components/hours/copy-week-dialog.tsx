"use client";
import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { previousWeekPatternAction, saveTimeEntryAction } from "@/lib/hours/actions";
import { formatDate, formatHours } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Row {
  subContractId: string;
  label: string;
  workDate: string;
  minutes: number;
  description: string;
  include: boolean;
}

/** "Copy from previous week": sub-contracts + durations, descriptions re-entered (spec §10.2). */
export function CopyWeekDialog({ userId, weekStart, subs, canEditDay }: { userId: string; weekStart: string; subs: { id: string; label: string }[]; canEditDay: (d: string) => boolean }) {
  const t = useTranslations("hours");
  const tc = useTranslations("common");
  const tAll = useTranslations();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [pending, start] = React.useTransition();
  const load = () =>
    start(async () => {
      const res = await previousWeekPatternAction(userId, weekStart);
      if (res.ok) setRows(res.data.filter((r) => subs.some((s) => s.id === r.subContractId) && canEditDay(r.workDate)).map((r) => ({ ...r, description: "", include: true })));
      else toast.error(tAll.has(res.error) ? tAll(res.error) : res.error);
    });
  const save = () =>
    start(async () => {
      let ok = 0;
      for (const r of rows ?? []) {
        if (!r.include) continue;
        const fd = new FormData();
        fd.set("userId", userId);
        fd.set("subContractId", r.subContractId);
        fd.set("workDate", r.workDate);
        fd.set("duration", formatHours(r.minutes));
        fd.set("description", r.description);
        const res = await saveTimeEntryAction(fd);
        if (res.ok) ok++;
        else toast.error(`${formatDate(r.workDate)} ${r.label}: ${tAll.has(res.error) ? tAll(res.error) : res.error}`);
      }
      toast.success(t("copied", { n: ok }));
      setOpen(false);
      setRows(null);
      router.refresh();
    });
  const valid = (rows ?? []).filter((r) => r.include).every((r) => r.description.trim().length >= 3);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setOpen(true); load(); }}>
        <Copy /> {t("copy_prev_week")}
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setRows(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("copy_prev_week")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("copy_hint")}</p>
          {rows === null ? <p className="text-sm">…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("nothing_to_copy")}</p> : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr_auto_2fr] items-center gap-2 text-sm">
                  <input type="checkbox" checked={r.include} onChange={(e) => setRows((rs) => rs!.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} />
                  <span><span className="num">{formatDate(r.workDate)}</span> · {r.label}</span>
                  <span className="num">{formatHours(r.minutes)}</span>
                  <Input value={r.description} placeholder={t("description")} onChange={(e) => setRows((rs) => rs!.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} disabled={!r.include} />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button disabled={pending || !rows?.length || !valid} onClick={save}>{tc("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
