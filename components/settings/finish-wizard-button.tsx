"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { finishWizardAction } from "@/lib/settings/actions";
import { ActionButton } from "@/components/shared/action-button";

export function FinishWizardButton({ disabled }: { disabled: boolean }) {
  const t = useTranslations("settings.wizard");
  const router = useRouter();
  return (
    <ActionButton action={finishWizardAction} disabled={disabled} successMessage={t("completed")} onSuccess={() => router.push("/dashboard")}>
      {t("finish")}
    </ActionButton>
  );
}
