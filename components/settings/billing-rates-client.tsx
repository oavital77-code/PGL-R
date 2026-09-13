"use client";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { deleteBillingRateAction, upsertBillingRateAction } from "@/lib/lookups/actions";
import { ActionButton } from "@/components/shared/action-button";
import { ActionForm } from "@/components/shared/action-form";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function BillingRateForm({ grades }: { grades: { id: string; name: string }[] }) {
  const t = useTranslations("settings.rates");
  return (
    <ActionForm action={upsertBillingRateAction} submitLabel={t("add_rate")} resetOnSuccess className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] items-end">
      <Field label={t("grade")} htmlFor="br-grade" required>
        <Select id="br-grade" name="gradeId" required>
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("hourly_rate")} htmlFor="br-rate" required>
        <Input id="br-rate" name="hourlyRate" type="number" step="0.01" min="0" required />
      </Field>
      <Field label={t("effective_from")} htmlFor="br-from" required>
        <Input id="br-from" name="effectiveFrom" type="date" required />
      </Field>
    </ActionForm>
  );
}

export function DeleteBillingRateButton({ id }: { id: string }) {
  const t = useTranslations("common");
  return (
    <ActionButton action={() => deleteBillingRateAction(id)} variant="ghost" size="icon" confirm={t("confirm_delete")}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </ActionButton>
  );
}
