"use client";
import { useTranslations } from "next-intl";
import { saveSettingAction } from "@/lib/settings/actions";
import type { SettingsKey, WizardStepKey } from "@/lib/settings/defaults";
import { ActionForm } from "@/components/shared/action-form";
import { SubmitButton } from "@/components/ui/submit-button";

/** Form bound to saveSettingAction(key). Primary button also marks the wizard step done. */
export function SettingsForm({ settingKey, step, children }: { settingKey: SettingsKey; step: WizardStepKey | null; children: React.ReactNode }) {
  const t = useTranslations("settings.wizard");
  return (
    <ActionForm action={(fd) => saveSettingAction(settingKey, step, fd)} hideSubmit>
      {children}
      <div className="flex flex-wrap gap-2 pt-2">
        <SubmitButton>{step ? t("step_and_continue") : t("mark_done")}</SubmitButton>
      </div>
    </ActionForm>
  );
}
