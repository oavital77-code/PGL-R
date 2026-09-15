import { getTranslations } from "next-intl/server";

/** Streams immediately while a page's data loads – the screen is never blank. */
export default async function Loading() {
  const t = await getTranslations("common");
  return (
    <div className="flex items-center gap-3 py-16 text-muted-foreground" role="status" aria-live="polite">
      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span className="text-sm">{t("loading")}</span>
    </div>
  );
}
