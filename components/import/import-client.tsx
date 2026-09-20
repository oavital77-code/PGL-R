"use client";
import { Play, RotateCcw, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { diffReportAction, executeImportAction, rollbackImportAction, uploadImportAction } from "@/lib/import/actions";
import { formatMoney } from "@/lib/i18n/format";
import { ActionButton } from "@/components/shared/action-button";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ImportUploadForm({ entities }: { entities: { key: string; label: string }[] }) {
  const t = useTranslations("import");
  return (
    <ActionForm action={uploadImportAction} submitLabel={t("upload_validate")} resetOnSuccess onSuccess={(d) => (d.ok ? toast.success(t("validated_ok", { n: d.total })) : toast.error(t("validated_failed", { n: d.failed, total: d.total })))}>
      <Field label={t("entity")} htmlFor="imp-entity" required>
        <Select id="imp-entity" name="entity" required>{entities.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}</Select>
      </Field>
      <Field label={t("file")} htmlFor="imp-file" required hint={t("file_hint")}>
        <Input id="imp-file" name="file" type="file" accept=".xlsx" required />
      </Field>
    </ActionForm>
  );
}

export function BatchActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations("import");
  const tc = useTranslations("common");
  return (
    <span className="inline-flex gap-1">
      {status === "ready" ? <ActionButton action={() => executeImportAction(id)} size="sm" successMessage={t("executed")}><Play /> {t("execute")}</ActionButton> : null}
      {status === "done" ? <ActionButton action={() => rollbackImportAction(id)} size="sm" variant="outline" confirm={tc("confirm_title")}><RotateCcw /> {t("rollback")}</ActionButton> : null}
    </span>
  );
}

export function DiffReportButton() {
  const t = useTranslations("import");
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<{ key: string; name: string; field: string; expected: number; actual: number | null; diff: number | null }[] | null>(null);
  const [pending, start] = React.useTransition();
  return (
    <>
      <Button variant="outline" onClick={() => { setOpen(true); start(async () => { const r = await diffReportAction(); if (r.ok) setRows(r.data); else toast.error(r.error); }); }}><Upload /> {t("diff_report")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{t("diff_report")}</DialogTitle></DialogHeader>
          {pending || rows === null ? <p className="text-sm text-muted-foreground">…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">{t("diff_empty")}</p> : (
            <div className="max-h-[70vh] overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead>{t("sub_contract")}</TableHead><TableHead>{t("field")}</TableHead><TableHead>{t("admiral")}</TableHead><TableHead>{t("system")}</TableHead><TableHead>{t("diff")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i} className={r.diff !== null && Math.abs(r.diff) > 0.01 ? "bg-amber-50" : ""}>
                      <TableCell>{r.name}</TableCell><TableCell>{t(`fields.${r.field}` as "fields.submitted")}</TableCell><TableCell className="num-cell">{formatMoney(r.expected)}</TableCell><TableCell className="num-cell">{formatMoney(r.actual)}</TableCell><TableCell className="num-cell">{formatMoney(r.diff)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
