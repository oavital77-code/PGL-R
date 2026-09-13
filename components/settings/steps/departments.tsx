import { and, eq, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { departments, users } from "@/lib/db/schema";
import { LookupTable } from "../lookup-table";

export async function DepartmentsStep() {
  const [rows, mgrs, t] = await Promise.all([
    db.select().from(departments).orderBy(departments.sortOrder),
    db.select({ id: users.id, first: users.firstName, last: users.lastName }).from(users).where(and(eq(users.isActive, true), isNull(users.deletedAt))),
    getTranslations("settings"),
  ]);
  return <LookupTable table="departments" rows={rows} title={t("steps.departments")} addLabel={t("departments.add")} showCode managers={mgrs.map((m) => ({ id: m.id, name: `${m.first} ${m.last}` }))} />;
}
