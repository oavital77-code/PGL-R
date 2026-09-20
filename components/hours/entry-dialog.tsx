"use client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { deleteTimeEntryAction, saveTimeEntryAction } from "@/lib/hours/actions";
import { formatHours } from "@/lib/i18n/format";
import { ActionButton } from "@/components/shared/action-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubContractPicker } from "./sub-contract-picker";

export interface EntryDraft {
  id?: string;
  workDate: string;
  subContractId: string;
  startTime?: string;
  endTime?: string;
  minutes?: number;
  description?: string;
  invoiced?: boolean;
}

/** Time entry form (spec §10.3): date | sub-contract combobox | start | end | duration HH:MM | description. */
export function EntryDialog({ userId, subs, draft, onClose, onSaved, onSaveAndNew }: { userId: string; subs: { id: string; label: string }[]; draft: EntryDraft; onClose: () => void; onSaved: () => void; onSaveAndNew: (d: EntryDraft) => void }) {
  const t = useTranslations("hours");
  const tc = useTranslations("common");
  const tAll = useTranslations();
  const [start, setStart] = React.useState(draft.startTime ?? "");
  const [end, setEnd] = React.useState(draft.endTime ?? "");
  const [duration, setDuration] = React.useState(draft.minutes ? formatHours(draft.minutes) : "");
  const [pending, start_] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  React.useEffect(() => {
    if (start && end) {
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      const m = eh! * 60 + em! - (sh! * 60 + sm!);
      if (m > 0) setDuration(formatHours(m));
    }
  }, [start, end]);

  const submit = (andNew: boolean) =>
    start_(async () => {
      const fd = new FormData(formRef.current!);
      const res = await saveTimeEntryAction(fd);
      if (res.ok) {
        toast.success(tc("saved"));
        if (res.data.overStandard) toast.warning(t("over_standard", { total: formatHours(res.data.dayMinutes) }));
        setErrors({});
        if (andNew) onSaveAndNew({ workDate: String(fd.get("workDate")), subContractId: String(fd.get("subContractId")) });
        else onSaved();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(tAll.has(res.error) ? tAll(res.error) : res.error);
      }
    });
  const err = (k: string) => {
    const e = errors[k]?.[0];
    return e ? (tAll.has(e) ? tAll(e) : e) : undefined;
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{draft.id ? t("edit_entry") : t("add_entry")}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} className="space-y-3" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
          {draft.id ? <input type="hidden" name="id" value={draft.id} /> : null}
          <input type="hidden" name="userId" value={userId} />
          <fieldset disabled={draft.invoiced} className="space-y-3">
            <Field label={t("date")} htmlFor="te-date" required error={err("workDate")}>
              <Input id="te-date" name="workDate" type="date" defaultValue={draft.workDate} required />
            </Field>
            <Field label={t("sub_contract")} htmlFor="te-sc" required error={err("subContractId")}>
              <SubContractPicker id="te-sc" name="subContractId" options={subs} defaultValue={draft.subContractId} required />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t("start")} htmlFor="te-start" error={err("startTime")}>
                <Input id="te-start" name="startTime" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label={t("end")} htmlFor="te-end" error={err("endTime")}>
                <Input id="te-end" name="endTime" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </Field>
              <Field label={t("duration")} htmlFor="te-dur" required error={err("duration")}>
                <Input id="te-dur" name="duration" placeholder="HH:MM" value={duration} onChange={(e) => setDuration(e.target.value)} pattern="^\d{1,2}:[0-5]\d$" required className="num" />
              </Field>
            </div>
            <Field label={t("description")} htmlFor="te-desc" required error={err("description")} hint={t("description_hint")}>
              <Textarea id="te-desc" name="description" defaultValue={draft.description ?? ""} rows={3} minLength={3} required />
            </Field>
          </fieldset>
          {draft.invoiced ? <p className="text-xs text-warning">{t("already_invoiced")}</p> : null}
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <div>
              {draft.id && !draft.invoiced ? (
                <ActionButton action={() => deleteTimeEntryAction(draft.id!)} variant="ghost" confirm={tc("confirm_delete")} onSuccess={onSaved} refresh={false}>
                  {tc("delete")}
                </ActionButton>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>{tc("cancel")}</Button>
              {!draft.id && !draft.invoiced ? (
                <Button type="button" variant="secondary" disabled={pending} onClick={() => submit(true)}>{t("save_and_new")}</Button>
              ) : null}
              <Button type="submit" disabled={pending || draft.invoiced}>{tc("save")}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
