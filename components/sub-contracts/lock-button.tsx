"use client";
import { Lock, LockOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { setSubContractLockAction } from "@/lib/sub-contracts/actions";
import { ActionButton } from "@/components/shared/action-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";

export function SubContractLockButton({ id, isLocked, canUnlock, canEdit }: { id: string; isLocked: boolean; canUnlock: boolean; canEdit: boolean }) {
  const t = useTranslations("sub_contracts");
  const tc = useTranslations("common");
  if (isLocked) {
    if (!canUnlock) return null;
    return <ConfirmDialog title={tc("unlock")} description={t("unlock_hint")} requireReason action={(reason) => setSubContractLockAction(id, false, reason)} trigger={<Button variant="outline"><LockOpen /> {tc("unlock")}</Button>} />;
  }
  if (!canEdit) return null;
  return (
    <ActionButton action={() => setSubContractLockAction(id, true, "")} variant="outline">
      <Lock /> {t("lock_signed")}
    </ActionButton>
  );
}
