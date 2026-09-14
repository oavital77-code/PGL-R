"use client";
import { Copy, Lock, LockOpen, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteContractAction, duplicateContractAction, setContractLockAction, setContractStatusAction } from "@/lib/contracts/actions";
import { ActionButton } from "@/components/shared/action-button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function ContractActions({ id, projectId, isLocked, statusManual, statusCode, statuses, canUnlock, canEdit }: { id: string; projectId: string; isLocked: boolean; statusManual: boolean; statusCode: string | null; statuses: { code: string; name: string }[]; canUnlock: boolean; canEdit: boolean }) {
  const t = useTranslations("contracts");
  const tc = useTranslations("common");
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit ? (
        <Select className="w-44" value={statusManual ? (statusCode ?? "") : "__auto"} onChange={(e) => setContractStatusAction(id, e.target.value === "__auto" ? null : e.target.value).then(() => router.refresh())}>
          <option value="__auto">{t("status_auto")}</option>
          {statuses.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
      ) : null}
      {isLocked ? (
        canUnlock ? (
          <ConfirmDialog title={tc("unlock")} description={t("unlock_hint")} requireReason action={(reason) => setContractLockAction(id, false, reason)} trigger={<Button variant="outline"><LockOpen /> {tc("unlock")}</Button>} />
        ) : null
      ) : canEdit ? (
        <ActionButton action={() => setContractLockAction(id, true, "")} variant="outline">
          <Lock /> {tc("lock")}
        </ActionButton>
      ) : null}
      {canEdit ? (
        <>
          <ActionButton action={() => duplicateContractAction(id)} variant="outline" onSuccess={(d) => router.push(`/contracts/${d.id}`)}>
            <Copy /> {tc("duplicate")}
          </ActionButton>
          <ActionButton action={() => deleteContractAction(id)} variant="ghost" confirm={tc("confirm_delete")} onSuccess={() => router.push(`/projects/${projectId}`)}>
            <Trash2 className="text-destructive" /> {tc("delete")}
          </ActionButton>
        </>
      ) : null}
      {statusManual && canEdit ? (
        <ActionButton action={() => setContractStatusAction(id, null)} variant="ghost" size="sm">
          <RotateCcw /> {t("status_back_to_auto")}
        </ActionButton>
      ) : null}
    </div>
  );
}
