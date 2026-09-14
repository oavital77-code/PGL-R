"use client";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { decideSupplierInvoiceAction, markSupplierInvoicePaidAction } from "@/lib/supplier-invoices/actions";
import { ActionButton } from "@/components/shared/action-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import * as React from "react";

export function DecisionButtons({ id }: { id: string }) {
  const t = useTranslations("supplier_invoices");
  return (
    <>
      <ActionButton action={() => decideSupplierInvoiceAction(id, "approved", "")}><Check /> {t("approve")}</ActionButton>
      <ConfirmDialog title={t("reject")} requireReason action={(reason) => decideSupplierInvoiceAction(id, "rejected", reason)} trigger={<Button variant="destructive"><X /> {t("reject")}</Button>} />
    </>
  );
}

export function MarkPaidForm({ id }: { id: string }) {
  const t = useTranslations("supplier_invoices");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  return (
    <span className="inline-flex items-center gap-1">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-md border border-input bg-card px-2 text-sm num" />
      <ActionButton action={() => markSupplierInvoicePaidAction(id, date)} variant="outline">{t("mark_paid")}</ActionButton>
    </span>
  );
}
