import { getTranslations } from "next-intl/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 flex flex-col items-center justify-center p-4">
      <div className="mb-6 text-center text-white">
        <div className="text-3xl font-bold tracking-tight">PGL</div>
        <div className="text-sm opacity-80">{t("tagline")}</div>
      </div>
      {children}
    </div>
  );
}
