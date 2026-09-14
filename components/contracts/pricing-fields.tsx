"use client";
import { useTranslations } from "next-intl";
import * as React from "react";
import type { subContracts } from "@/lib/db/schema";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type SC = Partial<typeof subContracts.$inferSelect>;

/** Pricing block that switches by method (spec §8.3). Shared by contract creation and sub-contract forms. */
export function PricingFields({ sc, unitTypes, templates, showTemplate, disabled }: { sc: SC | null; unitTypes: { id: string; name: string }[]; templates: { id: string; name: string }[]; showTemplate: boolean; disabled?: boolean }) {
  const t = useTranslations("pricing");
  const [method, setMethod] = React.useState(sc?.pricingMethod ?? "fixed_price");
  const [hourlyMode, setHourlyMode] = React.useState(sc?.hourlyMode ?? "rate_card");
  const milestoneMethod = method === "fixed_price" || method === "pct_of_cost";
  return (
    <fieldset disabled={disabled} className="space-y-4 rounded-md border border-border p-4">
      <legend className="px-1 text-sm font-semibold">{t("title")}</legend>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("method")} htmlFor="pricingMethod" required>
          <Select id="pricingMethod" name="pricingMethod" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
            <option value="fixed_price">{t("fixed_price")}</option>
            <option value="hourly">{t("hourly")}</option>
            <option value="retainer">{t("retainer")}</option>
            <option value="pct_of_cost">{t("pct_of_cost")}</option>
            <option value="per_unit">{t("per_unit")}</option>
          </Select>
        </Field>
        {method === "fixed_price" ? (
          <>
            <Field label={t("base_price")} htmlFor="basePrice" required>
              <Input id="basePrice" name="basePrice" type="number" step="0.01" min="0" defaultValue={sc?.basePrice ?? ""} required />
            </Field>
            <Field label={t("discount_pct")} htmlFor="discountPct">
              <Input id="discountPct" name="discountPct" type="number" step="0.01" min="0" max="100" defaultValue={sc?.discountPct ?? "0"} />
            </Field>
          </>
        ) : null}
        {method === "hourly" ? (
          <>
            <Field label={t("hourly_mode")} htmlFor="hourlyMode">
              <Select id="hourlyMode" name="hourlyMode" value={hourlyMode} onChange={(e) => setHourlyMode(e.target.value as typeof hourlyMode)}>
                <option value="rate_card">{t("rate_card")}</option>
                <option value="custom">{t("custom_rate")}</option>
              </Select>
            </Field>
            {hourlyMode === "custom" ? (
              <Field label={t("custom_hourly_rate")} htmlFor="customHourlyRate" required>
                <Input id="customHourlyRate" name="customHourlyRate" type="number" step="0.01" min="0" defaultValue={sc?.customHourlyRate ?? ""} required />
              </Field>
            ) : null}
            <Field label={t("hours_cap")} htmlFor="hoursCap">
              <Input id="hoursCap" name="hoursCap" type="number" step="0.01" min="0" defaultValue={sc?.hoursCap ?? ""} />
            </Field>
            <Field label={t("amount_cap")} htmlFor="amountCap">
              <Input id="amountCap" name="amountCap" type="number" step="0.01" min="0" defaultValue={sc?.amountCap ?? ""} />
            </Field>
          </>
        ) : null}
        {method === "retainer" ? (
          <>
            <Field label={t("monthly_amount")} htmlFor="monthlyAmount" required>
              <Input id="monthlyAmount" name="monthlyAmount" type="number" step="0.01" min="0" defaultValue={sc?.monthlyAmount ?? ""} required />
            </Field>
            <Field label={t("retainer_start")} htmlFor="retainerStart" required>
              <Input id="retainerStart" name="retainerStart" type="date" defaultValue={sc?.retainerStart ?? ""} required />
            </Field>
            <Field label={t("retainer_end")} htmlFor="retainerEnd">
              <Input id="retainerEnd" name="retainerEnd" type="date" defaultValue={sc?.retainerEnd ?? ""} />
            </Field>
            <Field label={t("retainer_billing_day")} htmlFor="retainerBillingDay" hint={t("retainer_billing_day_hint")}>
              <Input id="retainerBillingDay" name="retainerBillingDay" type="number" min="1" max="28" defaultValue={sc?.retainerBillingDay ?? ""} />
            </Field>
          </>
        ) : null}
        {method === "pct_of_cost" ? (
          <>
            <Field label={t("fee_pct")} htmlFor="feePct" required>
              <Input id="feePct" name="feePct" type="number" step="0.001" min="0" max="100" defaultValue={sc?.feePct ?? ""} required />
            </Field>
            <Field label={t("discount_pct")} htmlFor="discountPct">
              <Input id="discountPct" name="discountPct" type="number" step="0.01" min="0" max="100" defaultValue={sc?.discountPct ?? "0"} />
            </Field>
            {!sc?.id ? (
              <Field label={t("initial_estimate")} htmlFor="initialEstimate" hint={t("initial_estimate_hint")}>
                <Input id="initialEstimate" name="initialEstimate" type="number" step="0.01" min="0" />
              </Field>
            ) : null}
          </>
        ) : null}
        {method === "per_unit" ? (
          <>
            <Field label={t("unit_type")} htmlFor="unitTypeId" required>
              <Select id="unitTypeId" name="unitTypeId" defaultValue={sc?.unitTypeId ?? ""} required>
                <option value="">—</option>
                {unitTypes.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("unit_price")} htmlFor="unitPrice" required>
              <Input id="unitPrice" name="unitPrice" type="number" step="0.01" min="0" defaultValue={sc?.unitPrice ?? ""} required />
            </Field>
            <Field label={t("agreed_quantity")} htmlFor="agreedQuantity">
              <Input id="agreedQuantity" name="agreedQuantity" type="number" step="0.001" min="0" defaultValue={sc?.agreedQuantity ?? ""} />
            </Field>
          </>
        ) : null}
        {showTemplate && milestoneMethod ? (
          <Field label={t("template")} htmlFor="templateId" hint={t("template_hint")}>
            <Select id="templateId" name="templateId" defaultValue="">
              <option value="">{t("template_none")}</option>
              {templates.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>
    </fieldset>
  );
}
