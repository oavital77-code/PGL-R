"use client";
import { useTranslations } from "next-intl";
import { addCostEstimateAction } from "@/lib/sub-contracts/actions";
import { ActionForm } from "@/components/shared/action-form";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/i18n/format";

export function EstimatesPanel({ subContractId, rows, canEdit }: { subContractId: string; rows: { id: string; estimateType: string; amount: string; effectiveFrom: string; note: string | null }[]; canEdit: boolean }) {
  const t = useTranslations("estimates");
  const tc = useTranslations("common");
  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <h3 className="font-semibold">{t("title")}</h3>
      {canEdit ? (
        <ActionForm action={addCostEstimateAction} submitLabel={t("add")} resetOnSuccess className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_2fr_auto] items-end">
          <input type="hidden" name="subContractId" value={subContractId} />
          <Field label={t("type")} htmlFor="est-type">
            <Select id="est-type" name="estimateType" defaultValue="execution">
              {["initial", "tender", "execution", "actual", "other"].map((k) => (
                <option key={k} value={k}>{t(`types.${k}` as "types.initial")}</option>
              ))}
            </Select>
          </Field>
          <Field label={tc("amount")} htmlFor="est-amount" required>
            <Input id="est-amount" name="amount" type="number" step="0.01" min="0" required />
          </Field>
          <Field label={t("effective_from")} htmlFor="est-from" required>
            <Input id="est-from" name="effectiveFrom" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label={tc("notes")} htmlFor="est-note">
            <Input id="est-note" name="note" />
          </Field>
        </ActionForm>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("type")}</TableHead>
            <TableHead>{tc("amount")}</TableHead>
            <TableHead>{t("effective_from")}</TableHead>
            <TableHead>{tc("notes")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">{tc("none")}</TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{t(`types.${r.estimateType}` as "types.initial")}</TableCell>
                <TableCell className="num">{formatMoney(r.amount)}</TableCell>
                <TableCell className="num">{formatDate(r.effectiveFrom)}</TableCell>
                <TableCell>{r.note ?? "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
