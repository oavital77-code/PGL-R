import { and, eq, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings/service";
import { SignatureForm } from "../signature-client";
import { DefaultSignerForm } from "../signature-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export async function SignaturesStep() {
  const [admins, inv, t] = await Promise.all([
    db.select({ id: users.id, first: users.firstName, last: users.lastName, title: users.signatureTitle, path: users.signatureImagePath }).from(users).where(and(eq(users.role, "admin"), eq(users.isActive, true), isNull(users.deletedAt))),
    getSetting("invoices"),
    getTranslations("settings.signatures"),
  ]);
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {admins.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>
                {a.first} {a.last}
              </CardTitle>
              {a.path ? <Badge variant="success">{t("has_signature")}</Badge> : <Badge variant="warning">{t("no_signature")}</Badge>}
            </CardHeader>
            <CardContent>
              <SignatureForm userId={a.id} title={a.title ?? ""} />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-5">
          <DefaultSignerForm admins={admins.map((a) => ({ id: a.id, name: `${a.first} ${a.last}` }))} current={inv.default_signer_user_id} />
        </CardContent>
      </Card>
    </div>
  );
}
