import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALES, TIME_ZONE, type Locale } from "./config";

/**
 * Locale resolution: the user's profile locale (spec §2.1) is mirrored to the
 * `pgl_locale` cookie by the app layout; falls back to Hebrew.
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get("pgl_locale")?.value;
  const locale: Locale = (LOCALES as readonly string[]).includes(raw ?? "") ? (raw as Locale) : DEFAULT_LOCALE;
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages, timeZone: TIME_ZONE };
});
