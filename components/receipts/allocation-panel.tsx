"use client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { allocateReceiptAction, autoAllocateReceiptAction, cancelAllocationAction } from "@/lib/receipts/actions";
import { formatDate, formatMoney } from "@/lib/i18n/format";
import { ActionButton } from "@/components/shared/action-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function AllocationPanel({ receipt, open, allocations, isAdmin }: { receipt: { id: string; amount: number; allocated: number; client: string }; open: { id: string; number: string; date: string; total: number; paid: number }[]; allocations: { id: string; number: string; amount: number; invoiceId: string }[]; isAdmin: boolean }) {
  const t = useTranslations("receipts");
  const tc = useTranslations("common");
  const [amounts, setAmounts] = React.useState<Record<string, number>>({});
  const remaining = receipt.amount - receipt.allocated;
  const sum = Object.values(amounts).reduce((a, b) => a + (b || 0), 0);
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{t("allocate")} · {receipt.client}</CardTitle>
        <p className="text-sm text-muted-foreground num">{formatMoney(receipt.amount)} · {t("allocated")} {formatMoney(receipt.allocated)} · {t("unallocated")} {formatMoney(remaining)}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {remaining > 0.005 ? (
          <>
            <ActionButton action={() => autoAllocateReceiptAction(receipt.id)} variant="outline" size="sm">{t("auto_allocate")}</ActionButton>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoice")}</TableHead>
                  <TableHead>{t("invoice_due")}</TableHead>
                  <TableHead>{t("allocate_amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {open.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">{tc("none")}</TableCell></TableRow> : null}
                {open.map((i) => {
                  const due = i.total - i.paid;
                  return (
                    <TableRow key={i.id}>
                      <TableCell><span className="num">{i.number}</span> <span className="text-xs text-muted-foreground num">{formatDate(i.date)}</span></TableCell>
                      <TableCell className="num-cell">{formatMoney(due)}</TableCell>
                      <TableCell><Input type="number" step="0.01" min="0" max={due} value={amounts[i.id] ?? ""} onChange={(e) => setAmounts((a) => ({ ...a, [i.id]: Number(e.target.value) }))} className="w-28" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between">
              <span className={`num text-sm ${sum > remaining + 0.005 ? "text-destructive" : ""}`}>{formatMoney(sum)} / {formatMoney(remaining)}</span>
              <ActionButton action={() => allocateReceiptAction({ receiptId: receipt.id, allocations: Object.entries(amounts).filter(([, v]) => v > 0).map(([invoiceId, amount]) => ({ invoiceId, amount })) })} disabled={sum <= 0 || sum > remaining + 0.005} onSuccess={() => setAmounts({})}>{t("allocate")}</ActionButton>
            </div>
          </>
        ) : null}
        <div>
          <h4 className="mb-1 text-sm font-semibold">{t("allocations")}</h4>
          {allocations.length === 0 ? <p className="text-sm text-muted-foreground">{tc("none")}</p> : (
            <ul className="divide-y divide-border text-sm">
              {allocations.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-1.5">
                  <span className="num">{a.number}</span>
                  <span className="num">{formatMoney(a.amount)}</span>
                  {isAdmin ? <ConfirmDialog title={t("cancel_allocation")} requireReason action={(reason) => cancelAllocationAction(a.id, reason)} trigger={<Button variant="ghost" size="sm">{t("cancel_allocation")}</Button>} /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
