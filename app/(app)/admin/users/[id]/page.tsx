import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireCapability } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { departments, employeeCostRates, grades, users } from "@/lib/db/schema";
import { formatDate, formatMoney } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserForm } from "@/components/users/user-form";
import { CostRateForm, DeleteCostRateButton, ResendInviteButton } from "@/components/users/user-client";
import { Badge } from "@/components/ui/badge";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCapability("users.manage");
  const { id } = await params;
  const [row] = await db.select().from(users).where(eq(users.id, id));
  if (!row) notFound();
  const [depts, grs, costs, t] = await Promise.all([
    db.select({ id: departments.id, name: departments.name }).from(departments).orderBy(departments.sortOrder),
    db.select({ id: grades.id, name: grades.name }).from(grades).orderBy(grades.sortOrder),
    db.select().from(employeeCostRates).where(eq(employeeCostRates.userId, id)).orderBy(desc(employeeCostRates.effectiveFrom)),
    getTranslations("users"),
  ]);
  return (
    <>
      <PageHeader
        title={`${row.firstName} ${row.lastName}`}
        description={row.email}
        actions={
          <>
            {row.clerkUserId ? <Badge variant="success">{t("status_active")}</Badge> : <Badge variant="warning">{t("not_linked")}</Badge>}
            {!row.clerkUserId ? <ResendInviteButton userId={row.id} /> : null}
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>{t("edit_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <UserForm user={row} departments={depts} grades={grs} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("cost_rates")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CostRateForm userId={row.id} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("hourly_cost")}</TableHead>
                  <TableHead>{t("effective_from")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {costs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="num">{formatMoney(c.hourlyCost)}</TableCell>
                    <TableCell className="num">{formatDate(c.effectiveFrom)}</TableCell>
                    <TableCell className="text-end">
                      <DeleteCostRateButton id={c.id} userId={row.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
