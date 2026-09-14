"use client";
import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { upsertSupplierInvoiceAction } from "@/lib/supplier-invoices/actions";
import type { supplierInvoices } from "@/lib/db/schema";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function SupplierInvoiceDialog({ invoice, contracts, defaultContractId }: { invoice: typeof supplierInvoices.$inferSelect | null; contracts: { id: string; label: string }[]; defaultContractId?: string }) {
  const t = useTranslations("supplier_invoices");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant={invoice ? "outline" : "default"} onClick={() => setOpen(true)}>{invoice ? <><Pencil /> {tc("edit")}</> : <><Plus /> {t("new")}</>}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{invoice ? tc("edit") : t("new")}</DialogTitle></DialogHeader>
          <ActionForm action={upsertSupplierInvoiceAction} onSuccess={(d) => { setOpen(false); if (!invoice) router.push(`/supplier-invoices/${d.id}`); }}>
            {invoice ? <input type="hidden" name="id" value={invoice.id} /> : null}
            <Field label={t("contract")} htmlFor="si-contract" required>
              <Select id="si-contract" name="contractId" defaultValue={invoice?.contractId ?? defaultContractId ?? ""} required><option value="">{tc("select")}</option>{contracts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t("number")} htmlFor="si-num" required><Input id="si-num" name="supplierInvoiceNumber" defaultValue={invoice?.supplierInvoiceNumber ?? ""} required className="num" /></Field>
              <Field label={t("date")} htmlFor="si-date" required><Input id="si-date" name="invoiceDate" type="date" defaultValue={invoice?.invoiceDate ?? ""} required /></Field>
              <Field label={t("received_date")} htmlFor="si-recv"><Input id="si-recv" name="receivedDate" type="date" defaultValue={invoice?.receivedDate ?? new Date().toISOString().slice(0, 10)} /></Field>
              <Field label={t("progress_claimed")} htmlFor="si-prog"><Input id="si-prog" name="progressPctClaimed" type="number" step="0.001" min="0" max="100" defaultValue={invoice?.progressPctClaimed ?? ""} /></Field>
              <Field label={t("before_vat")} htmlFor="si-bv" required><Input id="si-bv" name="amountBeforeVat" type="number" step="0.01" min="0" defaultValue={invoice?.amountBeforeVat ?? ""} required /></Field>
              <Field label={t("vat")} htmlFor="si-vat"><Input id="si-vat" name="vatAmount" type="number" step="0.01" min="0" defaultValue={invoice?.vatAmount ?? "0"} /></Field>
            </div>
            <Field label={t("description")} htmlFor="si-desc"><Textarea id="si-desc" name="description" defaultValue={invoice?.description ?? ""} rows={2} /></Field>
            <Field label={t("file")} htmlFor="si-file" required={!invoice}><Input id="si-file" name="file" type="file" required={!invoice} /></Field>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
