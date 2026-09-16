import { desc, eq, sql } from "drizzle-orm";
import { getFormatter, getTranslations } from "next-intl/server";
import { can, requireCapability } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { importBatches, users } from "@/lib/db/schema";
import { IMPORT_ENTITIES } from "@/lib/import/spec";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { sectionTabsFor } from "@/components/layout/nav-config";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImportUploadForm, BatchActions, DiffReportButton } from "@/components/import/import-client";

export default async function ImportPage() {
  const user = await requireCapability("import.run");
  const [batches, t, tc, f] = await Promise.all([
    db.select({ b: importBatches, runBy: sql<string | null>`${users.firstName} || ' ' || ${users.lastName}` }).from(importBatches).leftJoin(users, eq(users.id, importBatches.runBy)).orderBy(desc(importBatches.createdAt)).limit(50),
    getTranslations("import"),
    getTranslations("common"),
    getFormatter(),
  ]);
  return (
    <>
      <SectionTabs tabs={sectionTabsFor("admin", (c) => can(user, c))} />
      <PageHeader title={t("title")} description={t("intro")} actions={<DiffReportButton />} />
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader><CardTitle>{t("entities")}</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-1 text-sm">
              {IMPORT_ENTITIES.map((e) => (
                <li key={e.key} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted">
                  <span><span className="num text-xs text-muted-foreground me-2">{e.order}</span>{e.label}</span>
                  <a href={`/api/imports/template?entity=${e.key}`} className="text-xs text-primary hover:underline">{t("template")}</a>
                </li>
              ))}
            </ol>
            <div className="mt-4 border-t border-border pt-4">
              <ImportUploadForm entities={IMPORT_ENTITIES.map((e) => ({ key: e.key, label: `${e.order}. ${e.label}` }))} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("batches")}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("date")}</TableHead>
                  <TableHead>{t("entity")}</TableHead>
                  <TableHead>{tc("status")}</TableHead>
                  <TableHead>{t("rows")}</TableHead>
                  <TableHead>{t("errors")}</TableHead>
                  <TableHead>{t("run_by")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{tc("none")}</TableCell></TableRow> : null}
                {batches.map(({ b, runBy }) => (
                  <TableRow key={b.id}>
                    <TableCell className="num text-xs">{f.dateTime(b.createdAt, { dateStyle: "short", timeStyle: "short" })}</TableCell>
                    <TableCell>{IMPORT_ENTITIES.find((e) => e.key === b.entity)?.label ?? b.entity}</TableCell>
                    <TableCell><Badge variant={b.status === "done" ? "success" : b.status === "ready" ? "secondary" : b.status === "failed" ? "destructive" : "muted"}>{t(`status.${b.status}`)}</Badge></TableCell>
                    <TableCell className="num">{b.rowsOk}/{b.rowsTotal}</TableCell>
                    <TableCell className="num">{b.rowsFailed > 0 || (b.log as { error?: string }).error ? <a href={`/api/imports/errors?batch=${b.id}`} className="text-destructive hover:underline">{b.rowsFailed} ↓</a> : "—"}</TableCell>
                    <TableCell>{runBy ?? "—"}</TableCell>
                    <TableCell className="text-end"><BatchActions id={b.id} status={b.status} /></TableCell>
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
