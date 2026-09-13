"use client";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { deleteVatRateAction, upsertVatRateAction } from "@/lib/lookups/actions";
import { ActionButton } from "@/components/shared/action-button";
import { ActionForm } from "@/components/shared/action-form";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function VatRateForm() {
  const t = useTranslations("settings.vat");
  return (
    <ActionForm action={upsertVatRateAction} submitLabel={t("add")} resetOnSuccess className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
      <Field label={t("rate")} htmlFor="vat-rate" required>
        <Input id="vat-rate" name="rate" type="number" step="0.01" min="0" max="100" required />
      </Field>
      <Field label={t("effective_from")} htmlFor="vat-from" required>
        <Input id="vat-from" name="effectiveFrom" type="date" required />
      </Field>
    </ActionForm>
  );
}

export function DeleteVatRateButton({ id }: { id: string }) {
  const t = useTranslations("common");
  return (
    <ActionButton action={() => deleteVatRateAction(id)} variant="ghost" size="icon" confirm={t("confirm_delete")}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </ActionButton>
  );
}
