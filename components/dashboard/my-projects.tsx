import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { clients, contractStatuses, projects } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Projects this user manages – the way a project manager without projects.view reaches them. */
export async function MyProjects({ userId }: { userId: string }) {
  const rows = await db
    .select({ id: projects.id, workNumber: projects.workNumber, name: projects.name, client: clients.name, status: contractStatuses.name })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .leftJoin(contractStatuses, eq(contractStatuses.id, projects.statusId))
    .where(and(isNull(projects.deletedAt), eq(projects.projectManagerUserId, userId)))
    .orderBy(projects.workNumber);
  if (rows.length === 0) return null;
  const t = await getTranslations("dashboard");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("my_projects")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <Link href={`/projects/${r.id}?tab=team`} className="font-medium text-primary hover:underline"><span className="num">{r.workNumber}</span> – {r.name}</Link>
              <span className="text-muted-foreground">{r.client}</span>
              {r.status ? <Badge variant="secondary">{r.status}</Badge> : null}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">{t("my_projects_hint")}</p>
      </CardContent>
    </Card>
  );
}
