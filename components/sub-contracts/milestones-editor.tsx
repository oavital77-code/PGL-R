"use client";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import { applyTemplateAction, saveMilestonesAction } from "@/lib/sub-contracts/actions";
import type { MilestoneRow } from "@/lib/reports/balances";
import { applyDiscount, applyPct } from "@/lib/calc/money";
import { formatMoney, formatPct } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";

interface EditRow {
  id?: string;
  stageNameId: string | null;
  name: string;
  pctOfSubcontract: number;
  discountPct: number | null;
  openingBilledPct: number;
  openingPaidAmount: number;
  expectedDate: string | null;
  notes: string | null;
  billedPct: number;
  billedAmount: number;
  paidAmount: number;
  hasInvoiceLines: boolean;
}

const OTHER = "__other";

/** Milestones table with live amounts (spec §8.3). Sum ≠ 100 is a warning, never a block. */
export function MilestonesEditor({ subContractId, base, defaultDiscount, rows, stageNames, templates, canEdit, isAdmin }: { subContractId: string; base: number; defaultDiscount: number; rows: MilestoneRow[]; stageNames: { id: string; name: string }[]; templates: { id: string; name: string }[]; canEdit: boolean; isAdmin: boolean }) {
  const t = useTranslations("milestones");
  const tc = useTranslations("common");
  const tAll = useTranslations();
  const router = useRouter();
  const [edit, setEdit] = React.useState(false);
  const [data, setData] = React.useState<EditRow[]>(() => toEdit(rows, stageNames));
  const [reason, setReason] = React.useState("");
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    if (!edit) setData(toEdit(rows, stageNames));
  }, [rows, stageNames, edit]);

  const calc = (r: EditRow) => {
    const amount = applyPct(base, r.pctOfSubcontract);
    const total = applyDiscount(amount, r.discountPct ?? defaultDiscount);
    return { amount, total };
  };
  const sumPct = data.reduce((a, r) => a + (Number(r.pctOfSubcontract) || 0), 0);
  const sumAmount = data.reduce((a, r) => a + calc(r).amount, 0);
  const sumTotal = data.reduce((a, r) => a + calc(r).total, 0);
  const sumBilled = rows.reduce((a, r) => a + r.billedAmount, 0);
  const sumPaid = rows.reduce((a, r) => a + r.paidAmount, 0);
  const needsReason = data.some((r) => {
    if (!r.hasInvoiceLines || !r.id) return false;
    const o = rows.find((x) => x.id === r.id)!;
    return o.pctOfSubcontract !== Number(r.pctOfSubcontract) || (o.discountPct !== (r.discountPct ?? defaultDiscount)) || o.name !== r.name;
  }) || rows.some((r) => r.hasInvoiceLines && !data.some((d) => d.id === r.id));
  const upd = (i: number, patch: Partial<EditRow>) => setData((d) => d.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, dir: -1 | 1) =>
    setData((d) => {
      const n = [...d];
      const j = i + dir;
      if (j < 0 || j >= n.length) return d;
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{t("title")}</h3>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {!edit && templates.length ? (
              <Select className="w-52" defaultValue="" onChange={(e) => e.target.value && start(async () => {
                const res = await applyTemplateAction(subContractId, e.target.value);
                if (res.ok) { toast.success(tc("saved")); router.refresh(); } else toast.error(tAll.has(res.error) ? tAll(res.error) : res.error);
              })}>
                <option value="">{t("apply_template")}</option>
                {templates.map((tp) => (
                  <option key={tp.id} value={tp.id}>{tp.name}</option>
                ))}
              </Select>
            ) : null}
            {edit ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setData((d) => [...d, { stageNameId: null, name: "", pctOfSubcontract: 0, discountPct: null, openingBilledPct: 0, openingPaidAmount: 0, expectedDate: null, notes: null, billedPct: 0, billedAmount: 0, paidAmount: 0, hasInvoiceLines: false }])}>
                  <Plus /> {t("add_row")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEdit(false)}>
                  {tc("cancel")}
                </Button>
                <Button
                  size="sm"
                  disabled={pending || (needsReason && (!isAdmin || reason.trim().length < 2))}
                  onClick={() =>
                    start(async () => {
                      const res = await saveMilestonesAction({ subContractId, reason: needsReason ? reason : undefined, rows: data.map((r) => ({ id: r.id, stageNameId: r.stageNameId ?? undefined, name: r.name, pctOfSubcontract: r.pctOfSubcontract, discountPct: r.discountPct, openingBilledPct: r.openingBilledPct, openingPaidAmount: r.openingPaidAmount, expectedDate: r.expectedDate, notes: r.notes })) });
                      if (res.ok) {
                        toast.success(tc("saved"));
                        for (const w of res.data.warnings) toast.warning(tAll(w));
                        setEdit(false);
                        setReason("");
                        router.refresh();
                      } else toast.error(tAll.has(res.error) ? tAll(res.error) : res.error);
                    })
                  }
                >
                  {tc("save")}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEdit(true)}>
                {tc("edit")}
              </Button>
            )}
          </div>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead className="min-w-48">{t("stage")}</TableHead>
            <TableHead>{t("pct")}</TableHead>
            <TableHead>{t("amount")}</TableHead>
            <TableHead>{t("discount")}</TableHead>
            <TableHead>{t("total")}</TableHead>
            <TableHead>{t("opening_pct")}</TableHead>
            <TableHead>{t("billed_pct")}</TableHead>
            <TableHead>{t("billed")}</TableHead>
            <TableHead>{t("paid")}</TableHead>
            <TableHead>{t("remaining")}</TableHead>
            <TableHead>{t("expected_date")}</TableHead>
            {edit ? <TableHead /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={13} className="text-center text-muted-foreground">
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            data.map((r, i) => {
              const { amount, total } = calc(r);
              const orig = rows.find((x) => x.id === r.id);
              return (
                <TableRow key={r.id ?? `new-${i}`} className={cn(r.hasInvoiceLines && edit && "bg-amber-50")}>
                  <TableCell className="num">{i + 1}</TableCell>
                  <TableCell>
                    {edit ? (
                      <div className="flex flex-col gap-1">
                        <Select value={r.stageNameId ?? OTHER} onChange={(e) => upd(i, { stageNameId: e.target.value === OTHER ? null : e.target.value, name: e.target.value === OTHER ? r.name : (stageNames.find((s) => s.id === e.target.value)?.name ?? r.name) })}>
                          {stageNames.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                          <option value={OTHER}>{t("other")}</option>
                        </Select>
                        {r.stageNameId === null ? <Input value={r.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder={t("stage")} /> : null}
                      </div>
                    ) : (
                      r.name
                    )}
                  </TableCell>
                  <TableCell className="num">{edit ? <Input type="number" step="0.001" min="0" max="100" value={r.pctOfSubcontract} onChange={(e) => upd(i, { pctOfSubcontract: Number(e.target.value) })} className="w-24" /> : formatPct(r.pctOfSubcontract, 3)}</TableCell>
                  <TableCell className="num">{formatMoney(amount)}</TableCell>
                  <TableCell className="num">{edit ? <Input type="number" step="0.01" min="0" max="100" value={r.discountPct ?? ""} placeholder={String(defaultDiscount)} onChange={(e) => upd(i, { discountPct: e.target.value === "" ? null : Number(e.target.value) })} className="w-20" /> : formatPct(r.discountPct ?? defaultDiscount, 2)}</TableCell>
                  <TableCell className="num font-medium">{formatMoney(total)}</TableCell>
                  <TableCell className="num">{edit ? <Input type="number" step="0.001" min="0" max="100" value={r.openingBilledPct} onChange={(e) => upd(i, { openingBilledPct: Number(e.target.value) })} className="w-20" /> : formatPct(r.openingBilledPct, 3)}</TableCell>
                  <TableCell className="num">{formatPct(orig?.billedPct ?? 0, 3)}</TableCell>
                  <TableCell className="num">{formatMoney(orig?.billedAmount ?? 0)}</TableCell>
                  <TableCell className="num">{edit ? <Input type="number" step="0.01" min="0" value={r.openingPaidAmount} onChange={(e) => upd(i, { openingPaidAmount: Number(e.target.value) })} className="w-24" title={t("opening_paid")} /> : formatMoney(orig?.paidAmount ?? 0)}</TableCell>
                  <TableCell className="num">{formatMoney(total - (orig?.billedAmount ?? 0))}</TableCell>
                  <TableCell className="num">{edit ? <Input type="date" value={r.expectedDate ?? ""} onChange={(e) => upd(i, { expectedDate: e.target.value || null })} className="w-36" /> : r.expectedDate ? r.expectedDate.split("-").reverse().join("/") : "—"}</TableCell>
                  {edit ? (
                    <TableCell className="whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" disabled={r.hasInvoiceLines} onClick={() => setData((d) => d.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>{tc("total")}</TableCell>
            <TableCell className={cn("num", Math.abs(sumPct - 100) < 0.0005 ? "text-success" : "text-warning")}>{formatPct(sumPct, 3)}</TableCell>
            <TableCell className="num">{formatMoney(sumAmount)}</TableCell>
            <TableCell />
            <TableCell className="num">{formatMoney(sumTotal)}</TableCell>
            <TableCell colSpan={2} />
            <TableCell className="num">{formatMoney(sumBilled)}</TableCell>
            <TableCell className="num">{formatMoney(sumPaid)}</TableCell>
            <TableCell className="num">{formatMoney(sumTotal - sumBilled)}</TableCell>
            <TableCell colSpan={edit ? 2 : 1} />
          </TableRow>
        </TableFooter>
      </Table>
      {Math.abs(sumPct - 100) >= 0.0005 ? <p className="text-xs text-warning">{t("sum_warning", { sum: sumPct })}</p> : null}
      {edit && needsReason ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="mb-2 font-medium">{isAdmin ? t("billed_change_reason") : t("billed_admin_only")}</p>
          {isAdmin ? <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function toEdit(rows: MilestoneRow[], stageNames: { id: string; name: string }[]): EditRow[] {
  return rows.map((r) => ({
    id: r.id,
    stageNameId: stageNames.find((s) => s.name === r.name)?.id ?? null,
    name: r.name,
    pctOfSubcontract: r.pctOfSubcontract,
    discountPct: null,
    openingBilledPct: r.openingBilledPct,
    openingPaidAmount: r.openingPaidAmount,
    expectedDate: r.expectedDate,
    notes: null,
    billedPct: r.billedPct,
    billedAmount: r.billedAmount,
    paidAmount: r.paidAmount,
    hasInvoiceLines: r.hasInvoiceLines,
  }));
}
