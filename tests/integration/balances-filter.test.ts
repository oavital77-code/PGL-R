/**
 * Regression: filtering the balances report by contract / sub-contract must return only the
 * owning project. Before the fix every project was loaded and pages read `projects[0]`, which
 * broke the sub-contract page as soon as a second project sorted first by work number.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { runSeed } from "@/lib/db/seed/run";
import { contractBalancesReport } from "@/lib/reports/balances";

const FIRST = "0001"; // sorts before every real work number
const TARGET = "0002";

describe.skipIf(!process.env.DATABASE_URL)("balances report – contract-level filters", () => {
  let clientId = "";
  let targetContractId = "";
  let targetSubId = "";
  const projectIds: string[] = [];

  async function wipe(workNumber: string) {
    const prev = await db.select({ id: s.projects.id }).from(s.projects).where(eq(s.projects.workNumber, workNumber));
    for (const p of prev) {
      const cons = await db.select({ id: s.contracts.id }).from(s.contracts).where(eq(s.contracts.projectId, p.id));
      for (const c of cons) {
        const subs = await db.select({ id: s.subContracts.id }).from(s.subContracts).where(eq(s.subContracts.contractId, c.id));
        for (const sc of subs) {
          await db.delete(s.milestones).where(eq(s.milestones.subContractId, sc.id));
          await db.delete(s.subContracts).where(eq(s.subContracts.id, sc.id));
        }
        await db.delete(s.contracts).where(eq(s.contracts.id, c.id));
      }
      await db.delete(s.projects).where(eq(s.projects.id, p.id));
    }
  }

  beforeAll(async () => {
    await runSeed(db);
    await wipe(FIRST);
    await wipe(TARGET);
    const [client] = await db.insert(s.clients).values({ name: "לקוח בדיקת סינון" }).returning({ id: s.clients.id });
    clientId = client!.id;
    const [active] = await db.select({ id: s.contractStatuses.id }).from(s.contractStatuses).where(eq(s.contractStatuses.code, "active"));
    for (const [wn, name] of [
      [FIRST, "פרויקט שממוין ראשון"],
      [TARGET, "פרויקט היעד"],
    ] as const) {
      const [p] = await db.insert(s.projects).values({ workNumber: wn, name, clientId, statusId: active!.id }).returning({ id: s.projects.id });
      projectIds.push(p!.id);
      const [c] = await db
        .insert(s.contracts)
        .values({ projectId: p!.id, direction: "income", clientId, numberInProject: 1, name: `חוזה ${wn}`, statusId: active!.id })
        .returning({ id: s.contracts.id });
      const [sc] = await db
        .insert(s.subContracts)
        .values({ contractId: c!.id, numberInContract: 1, name: `תת-חוזה ${wn}`, pricingMethod: "fixed_price", basePrice: "1000.00", statusId: active!.id })
        .returning({ id: s.subContracts.id });
      if (wn === TARGET) {
        targetContractId = c!.id;
        targetSubId = sc!.id;
      }
    }
  });

  afterAll(async () => {
    await wipe(FIRST);
    await wipe(TARGET);
    await db.delete(s.clients).where(eq(s.clients.id, clientId));
  });

  it("filter by contract returns only the owning project, as the first entry", async () => {
    const rep = await contractBalancesReport({ contractIds: [targetContractId] });
    expect(rep.projects).toHaveLength(1);
    expect(rep.projects[0]!.workNumber).toBe(TARGET);
    expect(rep.projects[0]!.contracts.map((c) => c.id)).toEqual([targetContractId]);
  });

  it("filter by sub-contract (the sub-contract page) finds the sub-contract", async () => {
    const rep = await contractBalancesReport({ contractIds: [targetContractId], subContractIds: [targetSubId] });
    const found = rep.projects.flatMap((p) => p.contracts).flatMap((c) => c.subContracts).find((x) => x.id === targetSubId);
    expect(found).toBeDefined();
    expect(found!.name).toBe(`תת-חוזה ${TARGET}`);
    expect(rep.projects).toHaveLength(1);
  });

  it("an unknown contract id yields an empty report instead of every project", async () => {
    const rep = await contractBalancesReport({ contractIds: ["00000000-0000-0000-0000-000000000000"] });
    expect(rep.projects).toEqual([]);
  });
});
