import { and, eq, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { requireCapability } from "@/lib/auth/authorize";
import { auditTables } from "@/lib/audit/query";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { AuditTable } from "@/components/audit/audit-table";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form-field";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireCapability("audit.view");
  const sp = await searchParams;
  const [tables, people, t, tc] = await Promise.all([
    auditTables(),
    db.select({ id: users.id, first: users.firstName, last: users.lastName }).from(users).where(and(isNull(users.deletedAt), eq(users.isActive, true))),
    getTranslations("audit"),
    getTranslations("common"),
  ]);
  const page = Math.max(1, Number(sp.page ?? 1));
  const q = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]);
  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <Button asChild variant="outline">
            <a href={`/api/exports/audit?${q.toString()}`}>{t("export")}</a>
          </Button>
        }
      />
      <form className="mb-4 grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-6" method="get">
        <Field label={t("table")} htmlFor="table">
          <Select id="table" name="table" defaultValue={sp.table ?? ""}>
            <option value="">{tc("all")}</option>
            {tables.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("record")} htmlFor="recordId">
          <Input id="recordId" name="recordId" defaultValue={sp.recordId ?? ""} className="num" />
        </Field>
        <Field label={t("user")} htmlFor="userId">
          <Select id="userId" name="userId" defaultValue={sp.userId ?? ""}>
            <option value="">{tc("all")}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first} {p.last}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("action")} htmlFor="action">
          <Select id="action" name="action" defaultValue={sp.action ?? ""}>
            <option value="">{tc("all")}</option>
            <option value="insert">{t("insert")}</option>
            <option value="update">{t("update")}</option>
            <option value="delete">{t("delete")}</option>
          </Select>
        </Field>
        <Field label={tc("from")} htmlFor="from">
          <Input id="from" name="from" type="date" defaultValue={sp.from ?? ""} />
        </Field>
        <Field label={tc("to")} htmlFor="to">
          <Input id="to" name="to" type="date" defaultValue={sp.to ?? ""} />
        </Field>
        <div className="md:col-span-6 flex gap-2">
          <Button type="submit">{tc("filter")}</Button>
          <Button asChild variant="ghost">
            <a href="/admin/audit">{tc("clear")}</a>
          </Button>
        </div>
      </form>
      <AuditTable
        filter={{
          table: sp.table || undefined,
          recordId: sp.recordId && /^[0-9a-f-]{36}$/i.test(sp.recordId) ? sp.recordId : undefined,
          userId: sp.userId || undefined,
          action: (sp.action as "insert" | "update" | "delete") || undefined,
          from: sp.from || undefined,
          to: sp.to || undefined,
          limit: 100,
          offset: (page - 1) * 100,
        }}
      />
      <div className="mt-3 flex gap-2">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <a href={`/admin/audit?${q.toString()}&page=${page - 1}`}>{tc("prev")}</a>
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm">
          <a href={`/admin/audit?${q.toString()}&page=${page + 1}`}>{tc("next")}</a>
        </Button>
      </div>
    </>
  );
}
