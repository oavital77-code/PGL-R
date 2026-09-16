"use client";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import { intlMessageFallback, onIntlError } from "@/lib/i18n/errors";

/**
 * Client-side i18n provider. Exists so the error handlers can be passed as functions:
 * they cannot cross the server/client boundary as props from the root layout.
 */
export function IntlProvider({ locale, messages, children }: { locale: string; messages: AbstractIntlMessages; children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} onError={onIntlError} getMessageFallback={intlMessageFallback}>
      {children}
    </NextIntlClientProvider>
  );
}
