"use client";
import { useTranslations } from "next-intl";
import { markStepDoneAction } from "@/lib/settings/actions";
import type { WizardStepKey } from "@/lib/settings/defaults";
import { ActionButton } from "@/components/shared/action-button";

export function MarkDoneButton({ step, done }: { step: WizardStepKey; done: boolean }) {
  const t = useTranslations("settings.wizard");
  if (done) return <span className="text-sm text-success">✓ {t("done")}</span>;
  return (
    <ActionButton action={() => markStepDoneAction(step)} variant="secondary">
      {t("mark_done")}
    </ActionButton>
  );
}
