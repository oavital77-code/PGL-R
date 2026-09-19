import Link from "next/link";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { clients, contracts, invoices, projects } from "@/lib/db/schema";
import { formatMoney } from "@/lib/i18n/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Invoices waiting at a station held by this user – shown on every role's dashboard, since a
 * project manager who approves invoices may have no other way into the invoices module.
 */
export async function MyApprovals({ userId, always }: { userId: string; always: boolean }) {
  const rows = await db
    .select({ id: invoices.id, number: invoices.invoiceNumber, total: invoices.total, station: sql<string>`${invoices.approvalChain} -> (${invoices.approvalStep} - 1) ->> 'name'`, client: clients.name, workNumber: projects.workNumber, project: projects.name })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .innerJoin(contracts, eq(contracts.id, invoices.contractId))
    .innerJoin(projects, eq(projects.id, contracts.projectId))
    .where(and(isNull(invoices.deletedAt), eq(invoices.status, "pending_approval"), sql`${invoices.approvalChain} -> (${invoices.approvalStep} - 1) ->> 'userId' = ${userId}`))
    .orderBy(invoices.createdAt);
  if (rows.length === 0 && !always) return null;
  const t = await getTranslations("dashboard");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("my_approvals")}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("approvals_none")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <Link href={`/invoices/${r.id}`} className="num font-medium text-primary hover:underline">{r.number}</Link>
                <span className="text-muted-foreground"><span className="num">{r.workNumber}</span> – {r.project} · {r.client}</span>
                <Badge variant="warning">{r.station}</Badge>
                <span className="num ms-auto">{formatMoney(r.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
