"use client";
import { useTranslations } from "next-intl";
import { uploadCompanyAssetAction } from "@/lib/settings/upload-actions";
import { ActionForm } from "@/components/shared/action-form";
import { Input } from "@/components/ui/input";

export function CompanyAssetUpload({ kind }: { kind: "logo" | "iso_badge" }) {
  const t = useTranslations("common");
  return (
    <ActionForm action={(fd) => uploadCompanyAssetAction(kind, fd)} submitLabel={t("upload")} resetOnSuccess>
      <Input type="file" name="file" accept=".png,.svg,.jpg,.jpeg" required />
    </ActionForm>
  );
}
