"use client";
import { DirectionProvider } from "@radix-ui/react-direction";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import { intlMessageFallback, onIntlError } from "@/lib/i18n/errors";

/**
 * Client-side i18n provider. Exists so the error handlers can be passed as functions:
 * they cannot cross the server/client boundary as props from the root layout.
 *
 * It also carries the text direction to every Radix primitive (tabs, select, menus, dialogs…).
 * Radix does not read `<html dir>`: without a DirectionProvider each primitive stamps
 * `dir="ltr"` on its root, and everything inside it – tab order, a table in a tab panel,
 * menu alignment – lays out left-to-right in an otherwise right-to-left page.
 */
export function IntlProvider({ locale, dir, messages, children }: { locale: string; dir: "rtl" | "ltr"; messages: AbstractIntlMessages; children: React.ReactNode }) {
  return (
    <DirectionProvider dir={dir}>
      <NextIntlClientProvider locale={locale} messages={messages} onError={onIntlError} getMessageFallback={intlMessageFallback}>
        {children}
      </NextIntlClientProvider>
    </DirectionProvider>
  );
}
