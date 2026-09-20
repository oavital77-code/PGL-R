import Link from "next/link";
import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { can, requireCapability } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { clients, contractStatuses, projects, users } from "@/lib/db/schema";
import { contractBalancesReport } from "@/lib/reports/balances";
import { projectFormLookups } from "@/lib/projects/lookups";
import { formatMoney, formatPct } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectDialog } from "@/components/projects/project-form";
import { StatusBadge } from "@/components/contracts/status-badge";

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; client?: string }> }) {
  const user = await requireCapability("projects.view");
  const sp = await searchParams;
  const [rows, lookups, statuses, t, tc] = await Promise.all([
    db
      .select({ p: projects, client: clients.name, pm: users.firstName, pmLast: users.lastName, status: contractStatuses.code, statusName: contractStatuses.name })
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .leftJoin(users, eq(users.id, projects.projectManagerUserId))
      .leftJoin(contractStatuses, eq(contractStatuses.id, projects.statusId))
      .where(
        and(
          isNull(projects.deletedAt),
          sp.q ? or(ilike(projects.workNumber, `%${sp.q}%`), ilike(projects.name, `%${sp.q}%`), ilike(clients.name, `%${sp.q}%`)) : undefined,
          sp.status ? eq(contractStatuses.code, sp.status) : undefined,
          sp.client ? eq(projects.clientId, sp.client) : undefined,
        ),
      )
      .orderBy(asc(projects.workNumber)),
    projectFormLookups(),
    db.select({ code: contractStatuses.code, name: contractStatuses.name }).from(contractStatuses).orderBy(contractStatuses.sortOrder),
    getTranslations("projects"),
    getTranslations("common"),
  ]);
  const report = rows.length ? await contractBalancesReport({ projectIds: rows.map((r) => r.p.id) }) : { projects: [], months: [] };
  const bal = new Map(report.projects.map((p) => [p.id, p]));
  return (
    <>
      <PageHeader title={t("title")} actions={can(user, "projects.edit") ? <ProjectDialog project={null} lookups={lookups} /> : undefined} />
      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <Input name="q" defaultValue={sp.q ?? ""} placeholder={t("search_placeholder")} className="max-w-xs" />
        <Select name="status" defaultValue={sp.status ?? ""} className="w-40">
          <option value="">{tc("all")}</option>
          {statuses.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select name="client" defaultValue={sp.client ?? ""} className="w-56">
          <option value="">{tc("all")}</option>
          {lookups.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline" size="sm">
          {tc("filter")}
        </Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("work_number")}</TableHead>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("client")}</TableHead>
            <TableHead>{t("project_manager")}</TableHead>
            <TableHead>{tc("status")}</TableHead>
            <TableHead>{t("contracts_total")}</TableHead>
            <TableHead>{t("submitted")}</TableHead>
            <TableHead>{t("remaining")}</TableHead>
            <TableHead>{t("progress")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const b = bal.get(r.p.id)?.balances;
              return (
                <TableRow key={r.p.id}>
                  <TableCell className="num-cell">
                    <Link href={`/projects/${r.p.id}`} className="font-medium text-primary hover:underline">
                      {r.p.workNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/projects/${r.p.id}`} className="hover:underline">
                      {r.p.name}
                    </Link>
                  </TableCell>
                  <TableCell>{r.client}</TableCell>
                  <TableCell>{r.pm ? `${r.pm} ${r.pmLast}` : "—"}</TableCell>
                  <TableCell>
                    <StatusBadge code={r.status} name={r.statusName} />
                  </TableCell>
                  <TableCell className="num-cell">{formatMoney(b?.totalAmount)}</TableCell>
                  <TableCell className="num-cell">{formatMoney(b?.submitted)}</TableCell>
                  <TableCell className="num-cell">{formatMoney(b?.remaining)}</TableCell>
                  <TableCell className="num-cell">{b?.progressPct === null || b?.progressPct === undefined ? <Badge variant="muted">—</Badge> : formatPct(b.progressPct)}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </>
  );
}
