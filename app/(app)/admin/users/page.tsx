import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { can, requireCapability } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { departments, grades, users } from "@/lib/db/schema";
import { formatDate } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { sectionTabsFor } from "@/components/layout/nav-config";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InviteUserDialog } from "@/components/users/invite-user-dialog";

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ inactive?: string }> }) {
  const user = await requireCapability("users.manage");
  const sp = await searchParams;
  const [rows, depts, grs, t, tr, tc] = await Promise.all([
    db
      .select({ u: users, dept: departments.name })
      .from(users)
      .leftJoin(departments, eq(departments.id, users.departmentId))
      .orderBy(asc(users.lastName), asc(users.firstName)),
    db.select({ id: departments.id, name: departments.name }).from(departments).where(eq(departments.isActive, true)).orderBy(departments.sortOrder),
    db.select({ id: grades.id, name: grades.name }).from(grades).where(eq(grades.isActive, true)).orderBy(grades.sortOrder),
    getTranslations("users"),
    getTranslations("roles"),
    getTranslations("common"),
  ]);
  const visible = rows.filter((r) => sp.inactive === "1" || (r.u.isActive && !r.u.deletedAt));
  return (
    <>
      <SectionTabs tabs={sectionTabsFor("admin", (c) => can(user, c))} />
      <PageHeader
        title={t("title")}
        actions={
          <>
            <Link href={sp.inactive === "1" ? "/admin/users" : "/admin/users?inactive=1"} className="text-sm text-primary hover:underline">
              {tc("show_inactive")}
            </Link>
            <InviteUserDialog departments={depts} grades={grs} />
          </>
        }
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{tc("name")}</TableHead>
            <TableHead>{t("email")}</TableHead>
            <TableHead>{t("role")}</TableHead>
            <TableHead>{t("department")}</TableHead>
            <TableHead>{t("employment_start")}</TableHead>
            <TableHead>{tc("status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            visible.map(({ u, dept }) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-primary hover:underline">
                    {u.firstName} {u.lastName}
                  </Link>
                </TableCell>
                <TableCell className="num-cell">{u.email}</TableCell>
                <TableCell>{tr(u.role)}</TableCell>
                <TableCell>{dept ?? "—"}</TableCell>
                <TableCell className="num-cell">{formatDate(u.employmentStart)}</TableCell>
                <TableCell>
                  {!u.isActive || u.deletedAt ? <Badge variant="muted">{t("status_inactive")}</Badge> : u.clerkUserId ? <Badge variant="success">{t("status_active")}</Badge> : <Badge variant="warning">{t("status_invited")}</Badge>}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}
