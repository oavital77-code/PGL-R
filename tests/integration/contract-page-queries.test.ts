/**
 * The contract page fires its whole data set in one Promise.all. This runs the same set through
 * the real client (guard, pipelining off) so a hang or a driver-level failure shows up here and
 * not only in production.
 */
import "dotenv/config";
import { describe, expect, it } from "vitest";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { contractBalancesReport } from "@/lib/reports/balances";
import { contractFormLookups } from "@/lib/projects/lookups";

const { contracts, contractRoles, contractNotes, invoices, clients, departments, suppliers, users, stageNames, projects } = s;

describe.skipIf(!process.env.DATABASE_URL)("contract page query set", () => {
  it("resolves for an existing contract within a few seconds", async () => {
    const [row] = await db
      .select({ id: contracts.id, clientId: contracts.clientId, projectId: contracts.projectId })
      .from(contracts)
      .where(isNull(contracts.deletedAt))
      .limit(1);
    expect(row).toBeDefined();
    const id = row!.id;
    const started = Date.now();
    const results = await Promise.all([
      contractBalancesReport({ contractIds: [id] }),
      contractFormLookups(),
      db.select({ r: contractRoles }).from(contractRoles).where(and(eq(contractRoles.contractId, id), isNull(contractRoles.deletedAt))),
      db.select({ n: contractNotes, author: sql<string>`${users.firstName} || ' ' || ${users.lastName}` }).from(contractNotes).innerJoin(users, eq(users.id, contractNotes.userId)).where(and(eq(contractNotes.contractId, id), isNull(contractNotes.deletedAt))).orderBy(desc(contractNotes.createdAt)),
      db.select().from(invoices).where(and(eq(invoices.contractId, id), isNull(invoices.deletedAt))).orderBy(desc(invoices.invoiceDate)),
      row!.clientId ? db.select({ name: clients.name }).from(clients).where(eq(clients.id, row!.clientId)) : Promise.resolve([]),
      db.select({ name: departments.name }).from(departments).limit(1),
      db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(and(isNull(suppliers.deletedAt), eq(suppliers.isActive, true))).orderBy(suppliers.name),
      db.select({ id: users.id, first: users.firstName, last: users.lastName }).from(users).where(and(eq(users.isActive, true), isNull(users.deletedAt))).orderBy(users.lastName),
      db.selectDistinct({ t: contractRoles.roleTitle }).from(contractRoles),
      db.select({ id: stageNames.id, name: stageNames.name }).from(stageNames).where(eq(stageNames.isActive, true)).orderBy(stageNames.sortOrder),
      db.select({ id: projects.id }).from(projects).where(eq(projects.id, row!.projectId)),
    ]);
    const ms = Date.now() - started;
    expect(results[0].projects.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(5000);
  });
});
