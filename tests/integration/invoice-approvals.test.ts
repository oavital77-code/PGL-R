/**
 * Approval chain (customer decision 18/09/2026): draft → project manager → economist → CEO →
 * approved; rejection at any station returns the draft with the reason; every decision is
 * recorded; balances count the draft from the moment it exists.
 */
import "dotenv/config";
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { runSeed } from "@/lib/db/seed/run";
import { withUser } from "@/lib/db/with-user";
import { allocateInvoiceNumber, nextPartialNumber } from "@/lib/invoices/numbering";
import { buildMilestoneLines, loadSubContractContexts, recomputeInvoice } from "@/lib/invoices/build";
import { decide, listDecisions, resolveChain, submitDraft } from "@/lib/invoices/approvals";
import { currentStation } from "@/lib/invoices/approval-chain";
import { isCountedStatus } from "@/lib/calc/balances";
import { DEFAULT_APPROVAL_STATIONS } from "@/lib/settings/defaults";
import { TABA_MILESTONES } from "../fixtures/aderet-raanana";

const WORK_NUMBER = "9001";

describe.skipIf(!process.env.DATABASE_URL)("invoice approval chain", () => {
  let contractId = "";
  let projectId = "";
  let tabaId = "";
  const u = { admin: "", pm: "", eco: "", ceo: "" };

  async function mkUser(first: string, role: "admin" | "manager" | "employee") {
    const [row] = await db.insert(s.users).values({ email: `${first}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@pgl.test`, firstName: first, lastName: "בדיקה", role }).returning({ id: s.users.id });
    return row!.id;
  }

  // each draft bills a different milestone: a draft already counts as prior progress
  // (DEVIATIONS 18/09/2026), so billing the same one twice would exceed 100 %
  let drafts = 0;
  async function mkDraft() {
    const slot = drafts++;
    return withUser({ userId: u.admin }, async (tx) => {
      const num = await allocateInvoiceNumber(tx, u.admin, "2026-11-01");
      const [c] = await tx.select({ clientId: s.contracts.clientId }).from(s.contracts).where(eq(s.contracts.id, contractId));
      const [inv] = await tx.insert(s.invoices).values({ invoiceNumber: num.invoiceNumber, sequenceNo: num.sequenceNo, sequenceYear: num.sequenceYear, contractId, clientId: c!.clientId!, partialNumber: await nextPartialNumber(tx, contractId), status: "draft", invoiceDate: "2026-11-01", createdBy: u.admin }).returning({ id: s.invoices.id });
      const [ctx] = await loadSubContractContexts(tx, [tabaId]);
      const lines = await buildMilestoneLines(tx, ctx!, 1);
      await tx.insert(s.invoiceLines).values(lines.map((l) => ({ ...l, invoiceId: inv!.id, createdBy: u.admin })));
      const first = lines[slot]!;
      await tx.update(s.invoiceLines).set({ progressPctThis: "100", amountThis: first.stageAmount ?? "0" }).where(and(eq(s.invoiceLines.invoiceId, inv!.id), eq(s.invoiceLines.milestoneId, first.milestoneId!)));
      await recomputeInvoice(tx, inv!.id);
      return inv!.id;
    });
  }

  const load = (id: string) => db.select().from(s.invoices).where(eq(s.invoices.id, id)).then((r) => r[0]!);

  beforeAll(async () => {
    await runSeed(db);
    // a project of its own (work number 9001), so this file never depends on the order the
    // suite runs in; a previous run's copy is removed first
    for (const p of await db.select({ id: s.projects.id }).from(s.projects).where(eq(s.projects.workNumber, WORK_NUMBER))) {
      for (const c of await db.select({ id: s.contracts.id }).from(s.contracts).where(eq(s.contracts.projectId, p.id))) {
        for (const i of await db.select({ id: s.invoices.id }).from(s.invoices).where(eq(s.invoices.contractId, c.id))) {
          await db.delete(s.receiptAllocations).where(eq(s.receiptAllocations.invoiceId, i.id));
          await db.delete(s.invoices).where(eq(s.invoices.id, i.id));
        }
        for (const sc of await db.select({ id: s.subContracts.id }).from(s.subContracts).where(eq(s.subContracts.contractId, c.id))) {
          await db.delete(s.milestones).where(eq(s.milestones.subContractId, sc.id));
          await db.delete(s.subContracts).where(eq(s.subContracts.id, sc.id));
        }
        await db.delete(s.contracts).where(eq(s.contracts.id, c.id));
      }
      await db.delete(s.projects).where(eq(s.projects.id, p.id));
    }
    const [client] = await db.insert(s.clients).values({ name: "לקוח אישורים (בדיקה)" }).returning({ id: s.clients.id });
    const [active] = await db.select({ id: s.contractStatuses.id }).from(s.contractStatuses).where(eq(s.contractStatuses.code, "active"));
    const [project] = await db.insert(s.projects).values({ workNumber: WORK_NUMBER, name: "פרויקט אישורים", clientId: client!.id, statusId: active!.id }).returning({ id: s.projects.id });
    projectId = project!.id;
    const [contract] = await db.insert(s.contracts).values({ projectId, direction: "income", clientId: client!.id, numberInProject: 1, name: "חוזה אישורים", statusId: active!.id, signedDate: "2026-01-15" }).returning({ id: s.contracts.id });
    contractId = contract!.id;
    const [taba] = await db.insert(s.subContracts).values({ contractId, numberInContract: 1, name: "תב\"ע", pricingMethod: "fixed_price", basePrice: "84000.00", discountPct: "10.00", statusId: active!.id }).returning({ id: s.subContracts.id });
    tabaId = taba!.id;
    await db.insert(s.milestones).values(TABA_MILESTONES.map((m, i) => ({ subContractId: tabaId, sortOrder: i + 1, name: m.name, pctOfSubcontract: m.pctOfSubcontract.toFixed(3) })));
    u.admin = await mkUser("אדמין", "admin");
    u.pm = await mkUser("מנהל", "manager");
    u.eco = await mkUser("כלכלן", "employee");
    u.ceo = await mkUser("מנכל", "admin");
    await db.update(s.projects).set({ projectManagerUserId: u.pm }).where(eq(s.projects.id, projectId));
    const stations = [DEFAULT_APPROVAL_STATIONS[0]!, { ...DEFAULT_APPROVAL_STATIONS[1]!, user_id: u.eco }, { ...DEFAULT_APPROVAL_STATIONS[2]!, user_id: u.ceo }];
    const [cur] = await db.select({ value: s.settings.value }).from(s.settings).where(eq(s.settings.key, "invoices"));
    const value = { ...((cur?.value as Record<string, unknown>) ?? {}), approval_stations: stations, signature_mode: "manual" };
    await db.insert(s.settings).values({ key: "invoices", value }).onConflictDoUpdate({ target: s.settings.key, set: { value } });
  });

  it("a draft already counts toward the contract's submitted amount", () => {
    expect(isCountedStatus("draft")).toBe(true);
    expect(isCountedStatus("pending_approval")).toBe(true);
    expect(isCountedStatus("cancelled")).toBe(false);
  });

  it("resolves the chain: project manager, economist, CEO", async () => {
    const chain = await resolveChain(contractId);
    expect(chain.map((c) => c.userId)).toEqual([u.pm, u.eco, u.ceo]);
    expect(chain[0]!.userName).toBe("מנהל בדיקה");
  });

  it("walks the invoice through every station and records each decision", async () => {
    const id = await mkDraft();
    expect(await submitDraft({ id: u.admin, role: "admin" }, id)).toBe("pending_approval");
    let inv = await load(id);
    expect(inv.approvalStep).toBe(1);
    expect(currentStation(inv)?.userId).toBe(u.pm);

    // the economist cannot decide at the project manager's station
    await expect(decide({ id: u.eco, role: "employee" }, id, "approved", null)).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(await decide({ id: u.pm, role: "manager" }, id, "approved", "נראה טוב")).toBe("pending_approval");
    inv = await load(id);
    expect(currentStation(inv)?.key).toBe("economist");

    expect(await decide({ id: u.eco, role: "employee" }, id, "approved", null)).toBe("pending_approval");
    expect(currentStation(await load(id))?.key).toBe("ceo");

    expect(await decide({ id: u.ceo, role: "admin" }, id, "approved", null)).toBe("approved");
    inv = await load(id);
    expect(inv.status).toBe("approved");
    expect(inv.approvedBy).toBe(u.ceo);
    expect(inv.approvalChain).toHaveLength(3);

    const decisions = await listDecisions(id);
    expect(decisions.map((d) => [d.step, d.stationKey, d.decision])).toEqual([
      [1, "project_manager", "approved"],
      [2, "economist", "approved"],
      [3, "ceo", "approved"],
    ]);
    expect(decisions[0]!.comment).toBe("נראה טוב");

    // once approved nobody "decides" any more
    await expect(decide({ id: u.ceo, role: "admin" }, id, "approved", null)).rejects.toMatchObject({ code: "invoices.invalid_transition" });
  });

  it("a rejection returns the draft with the reason and clears the chain; an admin may decide for a station", async () => {
    const id = await mkDraft();
    await submitDraft({ id: u.admin, role: "admin" }, id);
    await decide({ id: u.pm, role: "manager" }, id, "approved", null);
    expect(await decide({ id: u.admin, role: "admin" }, id, "rejected", "חסר פירוט")).toBe("draft");
    const inv = await load(id);
    expect(inv.status).toBe("draft");
    expect(inv.approvalStep).toBe(0);
    expect(inv.approvalChain).toBeNull();
    const last = (await listDecisions(id)).at(-1)!;
    expect(last.decision).toBe("rejected");
    expect(last.stationKey).toBe("economist");
    expect(last.comment).toBe("חסר פירוט");

    // and it can be submitted again from the start
    expect(await submitDraft({ id: u.admin, role: "admin" }, id)).toBe("pending_approval");
    expect(currentStation(await load(id))?.key).toBe("project_manager");
  });

  it("refuses to submit when the project has no manager, and approves at once with no stations", async () => {
    const id = await mkDraft();
    await db.update(s.projects).set({ projectManagerUserId: null }).where(eq(s.projects.id, projectId));
    await expect(submitDraft({ id: u.admin, role: "admin" }, id)).rejects.toMatchObject({ code: "invoices.no_project_manager" });
    await db.update(s.projects).set({ projectManagerUserId: u.pm }).where(eq(s.projects.id, projectId));

    const [cur] = await db.select({ value: s.settings.value }).from(s.settings).where(eq(s.settings.key, "invoices"));
    const value = { ...(cur!.value as Record<string, unknown>), approval_stations: [] };
    await db.update(s.settings).set({ value }).where(eq(s.settings.key, "invoices"));
    expect(await submitDraft({ id: u.admin, role: "admin" }, id)).toBe("approved");
    expect((await load(id)).status).toBe("approved");
  });
});
