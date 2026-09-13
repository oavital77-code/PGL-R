import { SignOutButton } from "@clerk/nextjs";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PendingSetupPage() {
  const t = await getTranslations("auth");
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("pending_setup_title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("pending_setup_body")}</p>
        <SignOutButton>
          <Button variant="outline">{t("sign_out")}</Button>
        </SignOutButton>
      </CardContent>
    </Card>
  );
}
