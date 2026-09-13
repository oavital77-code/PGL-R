import { getTranslations } from "next-intl/server";
import { requireCapability } from "@/lib/auth/authorize";
import { PageHeader } from "@/components/ui/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default async function ImportPage() {
  await requireCapability("import.run");
  const t = await getTranslations("import");
  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <Alert variant="info">
        <AlertDescription>{t("coming")}</AlertDescription>
      </Alert>
    </>
  );
}
