import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-semibold">{t("not_found_title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("not_found_body")}</p>
      <Link href="/dashboard" className="mt-6 inline-block text-primary underline">
        {t("go_home")}
      </Link>
    </div>
  );
}
