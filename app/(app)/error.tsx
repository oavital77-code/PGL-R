"use client";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Route error boundary (inside the app shell): shows the failure instead of a blank page. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");
  useEffect(() => {
    console.error("[page-error]", error.digest ?? "", error.message);
  }, [error]);
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-semibold">{t("page_title")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("page_body")}</p>
      {error.digest ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("error_code")}: <code className="num">{error.digest}</code>
        </p>
      ) : null}
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={() => reset()}>{t("retry")}</Button>
        <Button variant="outline" asChild>
          <a href="/dashboard">{t("go_home")}</a>
        </Button>
      </div>
    </div>
  );
}
