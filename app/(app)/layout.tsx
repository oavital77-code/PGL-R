import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { GlobalSearch } from "@/components/layout/global-search";
import { navFor } from "@/components/layout/nav-config";
import { NotificationsList } from "@/components/layout/notifications-list";
import { can } from "@/lib/auth/authorize";
import { getCurrentUser } from "@/lib/auth/current-user";
import { unreadCount } from "@/lib/notifications/service";
import { getSetting } from "@/lib/settings/service";

/**
 * Gate (spec §2.3, §3.3, §6.1):
 *  - no users row → /no-account ; inactive → /inactive ; MFA required & missing → /mfa
 *  - onboarding incomplete: admin → /settings/wizard ; others → /pending-setup
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/no-account");
  if (!user.isActive) redirect("/inactive");
  if (user.mfaRequired && !user.mfaEnabled) redirect("/mfa");

  const [onboarding, company, t, unread] = await Promise.all([getSetting("onboarding"), getSetting("company"), getTranslations("roles"), unreadCount(user.id)]);
  if (!onboarding.completed && user.role !== "admin") redirect("/pending-setup");
  // Admins land in the wizard until it is complete; elsewhere the banner below nags instead of
  // redirecting, so a router.refresh() after a save never turns into a redirect mid-render.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (!onboarding.completed && user.role === "admin" && pathname === "/dashboard") redirect("/settings/wizard");

  const items = navFor((c) => can(user, c));

  return (
    <AppShell
      items={items}
      userName={user.fullName}
      roleLabel={t(user.role)}
      unreadCount={unread}
      companyName={company.name}
      searchSlot={<GlobalSearch />}
      notificationsSlot={<NotificationsList userId={user.id} />}
    >
      <OnboardingGate completed={onboarding.completed} isAdmin={user.role === "admin"}>
        {children}
      </OnboardingGate>
    </AppShell>
  );
}

async function OnboardingGate({ completed, isAdmin, children }: { completed: boolean; isAdmin: boolean; children: React.ReactNode }) {
  if (completed || !isAdmin) return <>{children}</>;
  const t = await getTranslations("settings.wizard");
  return (
    <>
      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
        {t("banner")}{" "}
        <Link href="/settings/wizard" className="font-medium underline">
          {t("banner_link")}
        </Link>
      </div>
      {children}
    </>
  );
}
