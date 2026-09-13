"use client";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { deleteCostRateAction, resendInvitationAction, upsertCostRateAction } from "@/lib/users/actions";
import { ActionButton } from "@/components/shared/action-button";
import { ActionForm } from "@/components/shared/action-form";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function CostRateForm({ userId }: { userId: string }) {
  const t = useTranslations("users");
  return (
    <ActionForm action={upsertCostRateAction} submitLabel={t("add_cost_rate")} resetOnSuccess className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
      <input type="hidden" name="userId" value={userId} />
      <Field label={t("hourly_cost")} htmlFor="cr-cost" required>
        <Input id="cr-cost" name="hourlyCost" type="number" step="0.01" min="0" required />
      </Field>
      <Field label={t("effective_from")} htmlFor="cr-from" required>
        <Input id="cr-from" name="effectiveFrom" type="date" required />
      </Field>
    </ActionForm>
  );
}

export function DeleteCostRateButton({ id, userId }: { id: string; userId: string }) {
  const t = useTranslations("common");
  return (
    <ActionButton action={() => deleteCostRateAction(id, userId)} variant="ghost" size="icon" confirm={t("confirm_delete")}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </ActionButton>
  );
}

export function ResendInviteButton({ userId }: { userId: string }) {
  const t = useTranslations("users");
  return (
    <ActionButton action={() => resendInvitationAction(userId)} variant="outline" size="sm" successMessage={t("invited")}>
      {t("resend_invite")}
    </ActionButton>
  );
}
