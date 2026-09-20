"use client";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { addExtraLineAction, removeLineAction, updateInvoiceLinesAction } from "@/lib/invoices/actions";
import type { invoiceLines } from "@/lib/db/schema";
import { formatMoney, formatPct } from "@/lib/i18n/format";
import { ActionButton } from "@/components/shared/action-button";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/ui/form-field";

type Line = typeof invoiceLines.$inferSelect;
interface Group {
  subContractId: string;
  title: string;
  method: string;
  lines: Line[];
}

/** Step 3 (spec §11.4/§11.5): per sub-contract table with editable progress / quantity / amounts. */
export function LinesEditor({ invoiceId, kind, editable, canExtra, groups }: { invoiceId: string; kind: "proforma" | "credit"; editable: boolean; canExtra: boolean; groups: Group[] }) {
  const t = useTranslations("invoices.detail");
  const tc = useTranslations("common");
  const tAll = useTranslations();
  const router = useRouter();
  const [edits, setEdits] = React.useState<Record<string, { progressPctThis?: number; cumulativePct?: number; quantity?: number; amountThis?: number; description?: string }>>({});
  const [pending, start] = React.useTransition();
  const upd = (id: string, patch: Record<string, number | string>) => setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
  const save = () =>
    start(async () => {
      const res = await updateInvoiceLinesAction({ invoiceId, lines: Object.entries(edits).map(([id, v]) => ({ id, ...v })) });
      if (res.ok) {
        toast.success(tc("saved"));
        for (const w of res.data.warnings) toast.warning(tAll(w));
        setEdits({});
        router.refresh();
      } else toast.error(tAll.has(res.error) ? tAll(res.error) : res.error);
    });
  const sign = kind === "credit" ? -1 : 1;
  const dirty = Object.keys(edits).length > 0;
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.subContractId} className="space-y-2">
          <h3 className="font-semibold">{g.method === "extras" ? t("extra") + " / " + t("adjustment") : g.title}</h3>
          {g.method === "fixed_price" || g.method === "pct_of_cost" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("stage")}</TableHead>
                  <TableHead>{t("stage_pct")}</TableHead>
                  <TableHead>{t("stage_amount")}</TableHead>
                  <TableHead>{t("prev_cum")}</TableHead>
                  <TableHead>{t("progress_this")}</TableHead>
                  <TableHead>{t("new_cum")}</TableHead>
                  <TableHead>{t("amount_this")}</TableHead>
                  <TableHead>{t("cumulative_amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.lines.map((l) => {
                  const prev = Number(l.cumulativePct) - Number(l.progressPctThis);
                  const e = edits[l.id] ?? {};
                  const progress = e.progressPctThis ?? (e.cumulativePct !== undefined ? e.cumulativePct - prev : Number(l.progressPctThis));
                  const cum = prev + progress;
                  const amt = (Number(l.stageAmount) * progress) / 100;
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{l.description}</TableCell>
                      <TableCell className="num-cell">{formatPct(l.stagePct, 3)}</TableCell>
                      <TableCell className="num-cell">{formatMoney(l.stageAmount)}</TableCell>
                      <TableCell className="num-cell">{formatPct(prev, 3)}</TableCell>
                      <TableCell className="num-cell">{editable ? <Input type="number" step="0.001" min={kind === "credit" ? -100 : 0} max="100" value={Math.abs(progress) * (kind === "credit" ? -1 : 1)} onChange={(ev) => upd(l.id, { progressPctThis: Math.abs(Number(ev.target.value)) })} className="w-24" /> : formatPct(Number(l.progressPctThis), 3)}</TableCell>
                      <TableCell className="num-cell">{editable ? <Input type="number" step="0.001" min="0" max="100" value={Number(cum.toFixed(3))} onChange={(ev) => upd(l.id, { cumulativePct: Number(ev.target.value) })} className="w-24" /> : formatPct(l.cumulativePct, 3)}</TableCell>
                      <TableCell className="num-cell">{formatMoney(Math.abs(amt) * sign)}</TableCell>
                      <TableCell className="num-cell">{formatMoney((Number(l.stageAmount) * cum) / 100)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>{tc("total")}</TableCell>
                  <TableCell className="num-cell">{formatPct(g.lines.reduce((a, l) => a + Number(l.stagePct), 0), 3)}</TableCell>
                  <TableCell className="num-cell">{formatMoney(g.lines.reduce((a, l) => a + Number(l.stageAmount), 0))}</TableCell>
                  <TableCell colSpan={3} />
                  <TableCell className="num-cell">{formatMoney(g.lines.reduce((a, l) => a + Number(l.amountThis), 0) * sign)}</TableCell>
                  <TableCell className="num-cell">{formatMoney(g.lines.reduce((a, l) => a + Number(l.cumulativeAmount), 0))}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : g.method === "hourly" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("description")}</TableHead>
                  <TableHead>{t("hours")}</TableHead>
                  <TableHead>{t("rate")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  {editable ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.description}</TableCell>
                    <TableCell className="num-cell">{Number(l.hours).toFixed(2)}</TableCell>
                    <TableCell className="num-cell">{formatMoney(l.hourlyRate)}</TableCell>
                    <TableCell className="num-cell">{formatMoney(l.amountThis)}</TableCell>
                    {editable ? <TableCell><ActionButton action={() => removeLineAction(l.id)} variant="ghost" size="icon" confirm={tc("confirm_delete")}><Trash2 className="h-4 w-4 text-destructive" /></ActionButton></TableCell> : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : g.method === "per_unit" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("description")}</TableHead>
                  <TableHead>{t("quantity")}</TableHead>
                  <TableHead>{t("unit_price")}</TableHead>
                  <TableHead>{t("cum_quantity")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.lines.map((l) => {
                  const q = edits[l.id]?.quantity ?? Number(l.quantity);
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{l.description}</TableCell>
                      <TableCell className="num-cell">{editable ? <Input type="number" step="0.001" min="0" value={q} onChange={(ev) => upd(l.id, { quantity: Number(ev.target.value) })} className="w-28" /> : Number(l.quantity).toFixed(3)}</TableCell>
                      <TableCell className="num-cell">{formatMoney(l.unitPrice)}</TableCell>
                      <TableCell className="num-cell">{(Number(l.cumulativeQuantity) + q).toFixed(3)}</TableCell>
                      <TableCell className="num-cell">{formatMoney(q * Number(l.unitPrice))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("description")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  {editable ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{editable ? <Input value={edits[l.id]?.description ?? l.description ?? ""} onChange={(ev) => upd(l.id, { description: ev.target.value })} /> : l.description}</TableCell>
                    <TableCell className="num-cell">{editable ? <Input type="number" step="0.01" value={edits[l.id]?.amountThis ?? Number(l.amountThis)} onChange={(ev) => upd(l.id, { amountThis: Number(ev.target.value) })} className="w-32" /> : formatMoney(l.amountThis)}</TableCell>
                    {editable ? <TableCell><ActionButton action={() => removeLineAction(l.id)} variant="ghost" size="icon" confirm={tc("confirm_delete")}><Trash2 className="h-4 w-4 text-destructive" /></ActionButton></TableCell> : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      ))}
      {editable ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Button onClick={save} disabled={!dirty || pending}>{t("save_lines")}</Button>
          {canExtra ? (
            <ActionForm action={addExtraLineAction} submitLabel={t("add_extra")} resetOnSuccess className="grid grid-cols-[auto_auto_1fr_auto_auto] items-end gap-2 rounded-md border border-border p-2">
              <input type="hidden" name="invoiceId" value={invoiceId} />
              <Field label={t("extra")} htmlFor="ex-type"><Select id="ex-type" name="lineType" defaultValue="extra"><option value="extra">{t("extra")}</option><option value="adjustment">{t("adjustment")}</option></Select></Field>
              <Field label={t("stage")} htmlFor="ex-sc"><Select id="ex-sc" name="subContractId">{groups.filter((g) => g.method !== "extras").map((g) => <option key={g.subContractId} value={g.subContractId}>{g.title}</option>)}</Select></Field>
              <Field label={tc("description")} htmlFor="ex-desc"><Input id="ex-desc" name="description" required /></Field>
              <Field label={t("amount")} htmlFor="ex-amt"><Input id="ex-amt" name="amount" type="number" step="0.01" required className="w-32" /></Field>
            </ActionForm>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
