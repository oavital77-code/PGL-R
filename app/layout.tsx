import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { heIL, enUS } from "@clerk/localizations";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";
import { IntlProvider } from "@/components/layout/intl-provider";
import { dirFor, type Locale } from "@/lib/i18n/config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PGL", template: "%s | PGL" },
  description: "PGL – ניהול פרויקטים, דיווח שעות וחשבונות",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const dir = dirFor(locale);
  return (
    <ClerkProvider localization={locale === "he" ? heIL : enUS} signInUrl="/sign-in" afterSignOutUrl="/sign-in">
      <html lang={locale} dir={dir} suppressHydrationWarning>
        <body>
          <IntlProvider locale={locale} messages={messages}>
            {children}
            <Toaster position={dir === "rtl" ? "bottom-left" : "bottom-right"} dir={dir} richColors closeButton />
          </IntlProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
