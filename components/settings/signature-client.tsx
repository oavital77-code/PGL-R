"use client";
import { useTranslations } from "next-intl";
import { saveSignatureAction, setDefaultSignerAction } from "@/lib/settings/upload-actions";
import { Select } from "@/components/ui/select";
import { ActionForm } from "@/components/shared/action-form";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export function SignatureForm({ userId, title }: { userId: string; title: string }) {
  const t = useTranslations("settings.signatures");
  return (
    <ActionForm action={saveSignatureAction} submitLabel={t("upload")}>
      <input type="hidden" name="userId" value={userId} />
      <Field label={t("signature_title")} htmlFor={`title-${userId}`}>
        <Input id={`title-${userId}`} name="signatureTitle" defaultValue={title} />
      </Field>
      <Field label={t("signature_image")} htmlFor={`file-${userId}`}>
        <Input id={`file-${userId}`} name="file" type="file" accept=".png" />
      </Field>
    </ActionForm>
  );
}

export function DefaultSignerForm({ admins, current }: { admins: { id: string; name: string }[]; current: string | null }) {
  const t = useTranslations("settings.signatures");
  return (
    <ActionForm action={setDefaultSignerAction}>
      <Field label={t("default_signer")} htmlFor="default_signer_user_id">
        <Select id="default_signer_user_id" name="default_signer_user_id" defaultValue={current ?? ""}>
          <option value="">—</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
    </ActionForm>
  );
}
