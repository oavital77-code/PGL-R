"use client";
import { useTranslations } from "next-intl";
import { fetchCbsIndexAction, upsertIndexValueAction } from "@/lib/lookups/actions";
import { ActionButton } from "@/components/shared/action-button";
import { ActionForm } from "@/components/shared/action-form";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function IndexValueForm() {
  const t = useTranslations("settings.index");
  return (
    <ActionForm action={upsertIndexValueAction} submitLabel={t("add_value")} resetOnSuccess className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
      <Field label={t("month")} htmlFor="iv-month" required>
        <Input id="iv-month" name="month" type="date" required />
      </Field>
      <Field label={t("value")} htmlFor="iv-value" required>
        <Input id="iv-value" name="value" type="number" step="0.0001" min="0" required />
      </Field>
    </ActionForm>
  );
}

export function FetchCbsButton() {
  const t = useTranslations("settings.index");
  return (
    <ActionButton action={fetchCbsIndexAction} variant="outline" size="sm" onSuccess={() => undefined}>
      {t("fetch_now")}
    </ActionButton>
  );
}
