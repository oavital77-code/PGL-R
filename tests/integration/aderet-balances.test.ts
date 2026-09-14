/**
 * Stage 1 Definition of Done (spec §18): "אדרת ברעננה" is built through the DB and the
 * balances engine returns 189,000 total / 7,560 submitted / 181,440 remaining after partial #1.
 */
import "dotenv/config";
import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { runSeed } from "@/lib/db/seed/run";
import { contractBalancesReport } from "@/lib/reports/balances";
import { TABA_MILESTONES, DETAILED_MILESTONES, EXPECTED } from "../fixtures/aderet-raanana";

const WORK_NUMBER = "3489";

describe.skipIf(!process.env.DATABASE_URL)("אדרת ברעננה end-to-end balances", () => {
  let projectId = "";
  let contractId = "";
  let tabaId = "";

  beforeAll(async () => {
    await runSeed(db);
    // clean previous runs
    const prev = await db.select({ id: s.projects.id }).from(s.projects).where(eq(s.projects.workNumber, WORK_NUMBER));
    for (const p of prev) {
      const cons = await db.select({ id: s.contracts.id }).from(s.contracts).where(eq(s.contracts.projectId, p.id));
      for (const c of cons) {
        const inv = await db.select({ id: s.invoices.id }).from(s.invoices).where(eq(s.invoices.contractId, c.id));
        for (const i of inv) {
          await db.delete(s.receiptAllocations).where(eq(s.receiptAllocations.invoiceId, i.id));
          await db.delete(s.invoices).where(eq(s.invoices.id, i.id));
        }
        const subs = await db.select({ id: s.subContracts.id }).from(s.subContracts).where(eq(s.subContracts.contractId, c.id));
        for (const sc of subs) {
          await db.delete(s.timeEntries).where(eq(s.timeEntries.subContractId, sc.id));
          await db.delete(s.milestones).where(eq(s.milestones.subContractId, sc.id));
          await db.delete(s.subContracts).where(eq(s.subContracts.id, sc.id));
        }
        await db.delete(s.contracts).where(eq(s.contracts.id, c.id));
      }
      await db.delete(s.projects).where(eq(s.projects.id, p.id));
    }
    const [client] = await db.insert(s.clients).values({ name: "עיריית רעננה (בדיקה)" }).returning({ id: s.clients.id });
    const [active] = await db.select({ id: s.contractStatuses.id }).from(s.contractStatuses).where(eq(s.contractStatuses.code, "active"));
    const [project] = await db.insert(s.projects).values({ workNumber: WORK_NUMBER, name: "אדרת ברעננה", clientId: client!.id, statusId: active!.id }).returning({ id: s.projects.id });
    projectId = project!.id;
    const [contract] = await db
      .insert(s.contracts)
      .values({ projectId, direction: "income", clientId: client!.id, numberInProject: 1, name: "תב\"ע ותכנון מפורט", statusId: active!.id, signedDate: "2026-01-15" })
      .returning({ id: s.contracts.id });
    contractId = contract!.id;
    const [taba] = await db.insert(s.subContracts).values({ contractId, numberInContract: 1, name: "תב\"ע", pricingMethod: "fixed_price", basePrice: "84000.00", discountPct: "10.00", statusId: active!.id }).returning({ id: s.subContracts.id });
    const [det] = await db.insert(s.subContracts).values({ contractId, numberInContract: 2, name: "תכנון מפורט", pricingMethod: "fixed_price", basePrice: "126000.00", discountPct: "10.00", statusId: active!.id }).returning({ id: s.subContracts.id });
    tabaId = taba!.id;
    await db.insert(s.milestones).values(TABA_MILESTONES.map((m, i) => ({ subContractId: taba!.id, sortOrder: i + 1, name: m.name, pctOfSubcontract: m.pctOfSubcontract.toFixed(3) })));
    await db.insert(s.milestones).values(DETAILED_MILESTONES.map((m, i) => ({ subContractId: det!.id, sortOrder: i + 1, name: m.name, pctOfSubcontract: m.pctOfSubcontract.toFixed(3) })));
  });

  it("contract total is 189,000 before any invoice", async () => {
    const rep = await contractBalancesReport({ projectIds: [projectId] });
    const c = rep.projects[0]!.contracts[0]!;
    expect(c.balances.totalAmount).toBe(EXPECTED.contractTotal);
    expect(c.balances.submitted).toBe(0);
    expect(c.balances.remaining).toBe(EXPECTED.contractTotal);
    expect(c.subContracts[0]!.milestones[0]!.total).toBe(7_560);
    expect(c.subContracts[0]!.balances.totalAmount).toBe(EXPECTED.tabaTotal);
    expect(c.subContracts[1]!.balances.totalAmount).toBe(EXPECTED.detailedTotal);
    expect(c.warnings).not.toContain("milestones_not_100");
  });

  it("partial invoice #1 (7,560) → submitted 7,560, remaining 181,440", async () => {
    const [m1] = await db.select({ id: s.milestones.id }).from(s.milestones).where(eq(s.milestones.subContractId, tabaId)).orderBy(s.milestones.sortOrder);
    const [client] = await db.select({ clientId: s.contracts.clientId }).from(s.contracts).where(eq(s.contracts.id, contractId));
    const [inv] = await db
      .insert(s.invoices)
      .values({
        invoiceNumber: "16835-test",
        sequenceNo: 16835,
        contractId,
        clientId: client!.clientId!,
        partialNumber: 1,
        status: "sent",
        invoiceDate: "2026-09-01",
        cumulativeBase: "7560.00",
        subtotalBase: "7560.00",
        beforeVat: "7560.00",
        vatRate: "18.00",
        vatAmount: "1360.80",
        total: "8920.80",
      })
      .returning({ id: s.invoices.id });
    await db.insert(s.invoiceLines).values({ invoiceId: inv!.id, subContractId: tabaId, milestoneId: m1!.id, lineType: "milestone", stagePct: "10.000", stageAmount: "7560.00", progressPctThis: "100.000", cumulativePct: "100.000", amountThis: "7560.00", cumulativeAmount: "7560.00" });
    const rep = await contractBalancesReport({ projectIds: [projectId] });
    const c = rep.projects[0]!.contracts[0]!;
    expect(c.balances.submitted).toBe(EXPECTED.afterPartial1.submitted);
    expect(c.balances.remaining).toBe(EXPECTED.afterPartial1.remaining);
    expect(c.balances.openBalance).toBe(7_560);
    expect(c.balances.progressPct).toBe(4);
    const taba = c.subContracts.find((x) => x.id === tabaId)!;
    expect(taba.milestones[0]!.billedPct).toBe(100);
    expect(taba.milestones[0]!.billedAmount).toBe(7_560);
    expect(taba.milestones[0]!.remaining).toBe(0);
    expect(taba.milestones[0]!.hasInvoiceLines).toBe(true);
    // half receipt → paid 3,780 in base
    const [rc] = await db.insert(s.receipts).values({ clientId: client!.clientId!, receiptDate: "2026-09-10", amount: "4460.40", method: "transfer" }).returning({ id: s.receipts.id });
    await db.insert(s.receiptAllocations).values({ receiptId: rc!.id, invoiceId: inv!.id, amount: "4460.40" });
    const rep2 = await contractBalancesReport({ projectIds: [projectId] });
    expect(rep2.projects[0]!.contracts[0]!.balances.paid).toBe(3_780);
    expect(rep2.projects[0]!.contracts[0]!.balances.openBalance).toBe(3_780);
  });
});

describe.skipIf(!process.env.DATABASE_URL)("hours aggregation with historical cost rates", () => {
  it("sums hours per month and costs them at the rate in effect", async () => {
    const [p] = await db.select({ id: s.projects.id }).from(s.projects).where(eq(s.projects.workNumber, WORK_NUMBER));
    const [c] = await db.select({ id: s.contracts.id }).from(s.contracts).where(eq(s.contracts.projectId, p!.id));
    const [sc] = await db.select({ id: s.subContracts.id }).from(s.subContracts).where(eq(s.subContracts.contractId, c!.id));
    const [u] = await db.insert(s.users).values({ email: `emp-${Date.now()}@pgl.test`, firstName: "עובד", lastName: "בדיקה", role: "employee" }).returning({ id: s.users.id });
    await db.insert(s.employeeCostRates).values([{ userId: u!.id, hourlyCost: "100.00", effectiveFrom: "2026-01-01" }, { userId: u!.id, hourlyCost: "120.00", effectiveFrom: "2026-07-01" }]);
    await db.insert(s.timeEntries).values([
      { userId: u!.id, subContractId: sc!.id, workDate: "2026-06-30", minutes: 90, description: "בדיקה", reportedByUserId: u!.id },
      { userId: u!.id, subContractId: sc!.id, workDate: "2026-07-01", minutes: 30, description: "בדיקה", reportedByUserId: u!.id },
    ]);
    const rep = await contractBalancesReport({ projectIds: [p!.id] });
    const sub = rep.projects[0]!.contracts[0]!.subContracts.find((x) => x.id === sc!.id)!;
    expect(sub.hoursTotal).toBe(2);
    expect(sub.hoursCost).toBe(210); // 1.5h × 100 + 0.5h × 120
    expect(sub.hoursByMonth["2026-06"]).toBe(1.5);
    expect(sub.hoursByMonth["2026-07"]).toBe(0.5);
    expect(rep.projects[0]!.hoursCost).toBe(210);
  });
});
