import "server-only";
import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, invoices, projects, suppliers } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/authorize";

export interface SearchHit {
  type: "project" | "client" | "supplier" | "invoice";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

/** Global search (spec §4): work number, project name, client, invoice number, supplier – filtered by capabilities. */
export async function globalSearch(user: SessionUser, q: string): Promise<SearchHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const like = `%${term}%`;
  const hits: SearchHit[] = [];
  if (can(user, "projects.view")) {
    const rows = await db
      .select({ id: projects.id, workNumber: projects.workNumber, name: projects.name, client: clients.name })
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(and(isNull(projects.deletedAt), or(ilike(projects.workNumber, like), ilike(projects.name, like))))
      .limit(8);
    hits.push(...rows.map((r) => ({ type: "project" as const, id: r.id, title: `${r.workNumber} – ${r.name}`, subtitle: r.client, href: `/projects/${r.id}` })));
  }
  if (can(user, "clients.view")) {
    const rows = await db.select({ id: clients.id, name: clients.name, taxId: clients.taxId }).from(clients).where(and(isNull(clients.deletedAt), ilike(clients.name, like))).limit(5);
    hits.push(...rows.map((r) => ({ type: "client" as const, id: r.id, title: r.name, subtitle: r.taxId ?? undefined, href: `/clients/${r.id}` })));
  }
  if (can(user, "suppliers.view")) {
    const rows = await db.select({ id: suppliers.id, name: suppliers.name, field: suppliers.field }).from(suppliers).where(and(isNull(suppliers.deletedAt), ilike(suppliers.name, like))).limit(5);
    hits.push(...rows.map((r) => ({ type: "supplier" as const, id: r.id, title: r.name, subtitle: r.field ?? undefined, href: `/suppliers/${r.id}` })));
  }
  if (can(user, "invoices.view")) {
    const rows = await db
      .select({ id: invoices.id, number: invoices.invoiceNumber, status: invoices.status })
      .from(invoices)
      .where(and(isNull(invoices.deletedAt), sql`${invoices.invoiceNumber} ilike ${like}`))
      .limit(5);
    hits.push(...rows.map((r) => ({ type: "invoice" as const, id: r.id, title: r.number, subtitle: r.status, href: `/invoices/${r.id}` })));
  }
  return hits;
}
