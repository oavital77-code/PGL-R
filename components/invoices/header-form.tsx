"use client";
import { useTranslations } from "next-intl";
import * as React from "react";
import { updateInvoiceHeaderAction } from "@/lib/invoices/actions";
import type { invoices } from "@/lib/db/schema";
import { formatMonth } from "@/lib/i18n/format";
import { ActionForm } from "@/components/shared/action-form";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function HeaderForm({ invoice, editable, indexMonths, payers }: { invoice: typeof invoices.$inferSelect; editable: boolean; indexMonths: string[]; payers: { id: string; name: string }[] }) {
  const t = useTranslations("invoices.detail");
  const [vat, setVat] = React.useState(String(invoice.vatRate));
  const [exempt, setExempt] = React.useState(invoice.vatExempt);
  const vatChanged = Number(vat) !== Number(invoice.vatRate);
  const exemptChanged = exempt !== invoice.vatExempt;
  return (
    <ActionForm action={updateInvoiceHeaderAction} hideSubmit={!editable}>
      <input type="hidden" name="invoiceId" value={invoice.id} />
      <fieldset disabled={!editable} className="grid gap-4 md:grid-cols-2">
        <Field label={t("subject")} htmlFor="subject" className="md:col-span-2"><Input id="subject" name="subject" defaultValue={invoice.subject ?? ""} /></Field>
        <Field label={t("intro_text")} htmlFor="introText" className="md:col-span-2"><Textarea id="introText" name="introText" defaultValue={invoice.introText ?? ""} rows={2} /></Field>
        <Field label={t("notes")} htmlFor="notes" className="md:col-span-2"><Textarea id="notes" name="notes" defaultValue={invoice.notes ?? ""} rows={2} /></Field>
        <Field label={useTranslations("invoices")("date")} htmlFor="invoiceDate"><Input id="invoiceDate" name="invoiceDate" type="date" defaultValue={invoice.invoiceDate} required /></Field>
        <Field label={t("paying_client")} htmlFor="payingClientId"><Select id="payingClientId" name="payingClientId" defaultValue={invoice.payingClientId ?? ""}><option value="">—</option>{payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        {invoice.indexLinked ? (
          <Field label={t("index_month")} htmlFor="indexMonth"><Select id="indexMonth" name="indexMonth" defaultValue={invoice.indexMonth ?? ""}><option value="">{t("index_month_auto")}</option>{indexMonths.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}</Select></Field>
        ) : null}
        <Field label={t("retention_pct")} htmlFor="retentionPct"><Input id="retentionPct" name="retentionPct" type="number" step="0.01" min="0" max="100" defaultValue={invoice.retentionPct ?? ""} /></Field>
        <Field label={t("vat_rate")} htmlFor="vatRate"><Input id="vatRate" name="vatRate" type="number" step="0.01" min="0" max="100" value={vat} onChange={(e) => setVat(e.target.value)} /></Field>
        {vatChanged ? <Field label={t("vat_override_reason")} htmlFor="vatOverrideReason" required><Input id="vatOverrideReason" name="vatOverrideReason" defaultValue={invoice.vatOverrideReason ?? ""} required /></Field> : null}
        <label className="flex items-center gap-2 text-sm pt-6"><input type="checkbox" name="vatExempt" value="true" checked={exempt} onChange={(e) => setExempt(e.target.checked)} /> {t("vat_exempt")}</label>
        {exemptChanged || invoice.vatExemptReason ? <Field label={t("vat_exempt_reason")} htmlFor="vatExemptReason" required={exemptChanged}><Input id="vatExemptReason" name="vatExemptReason" defaultValue={invoice.vatExemptReason ?? ""} required={exemptChanged} /></Field> : null}
      </fieldset>
    </ActionForm>
  );
}
