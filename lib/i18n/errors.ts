import { IntlErrorCode, type IntlError } from "next-intl";

/**
 * A missing or malformed translation degrades one label; it must never take down the page.
 * next-intl throws by default, which turns a one-word gap into a blank screen for the user.
 * The key is still logged, and `tests/unit/i18n-keys.test.ts` fails the build on a static gap.
 */
export function onIntlError(error: IntlError): void {
  if (error.code === IntlErrorCode.MISSING_MESSAGE) {
    console.warn(`[i18n] missing message: ${error.message}`);
    return;
  }
  if (error.code === IntlErrorCode.ENVIRONMENT_FALLBACK) {
    // a static render without a request locale fell back to the default – expected, not a failure
    console.warn(`[i18n] ${error.message}`);
    return;
  }
  console.error(`[i18n] ${error.code}: ${error.message}`);
}

/** Shown in place of a missing translation: the last segment of the key, never an empty box. */
export function intlMessageFallback({ key, namespace }: { key: string; namespace?: string }): string {
  const full = namespace ? `${namespace}.${key}` : key;
  return full.split(".").pop() || full;
}
