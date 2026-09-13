import { UserProfile } from "@clerk/nextjs";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** Forced MFA enrolment (spec §2.3): users whose role requires MFA cannot continue without it. */
export default async function MfaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.mfaRequired || user.mfaEnabled) redirect("/dashboard");
  const t = await getTranslations("auth");
  return (
    <div className="w-full max-w-4xl space-y-4">
      <Alert variant="warning">
        <AlertTitle>{t("mfa_required_title")}</AlertTitle>
        <AlertDescription>{t("mfa_required_body")}</AlertDescription>
      </Alert>
      <UserProfile routing="hash" />
    </div>
  );
}
