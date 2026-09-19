/**
 * Approval chain (customer decision 18/09/2026): draft → project manager → economist → CEO →
 * approved; rejection at any station returns the draft with the reason; every decision is
 * recorded; balances count the draft from the moment it exists.
 */
import "dotenv/config";
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { runSeed } from "@/lib/db/seed/run";
import { withUser } from "@/lib/db/with-user";
import { allocateInvoiceNumber, nextPartialNumber } from "@/lib/invoices/numbering";
import { buildMilestoneLines, loadSubContractContexts, recomputeInvoice } from "@/lib/invoices/build";
import { decide, listDecisions, resolveChain, submitDraft } from "@/lib/invoices/approvals";
import { currentStation } from "@/lib/invoices/approval-chain";
import { isCountedStatus } from "@/lib/calc/balances";
import { DEFAULT_APPROVAL_STATIONS } from "@/lib/settings/defaults";

describe.skipIf(!process.env.DATABASE_URL)("invoice approval chain", () => {
  let contractId = "";
  let projectId = "";
  let tabaId = "";
  const u = { admin: "", pm: "", eco: "", ceo: "" };

  async function mkUser(first: string, role: "admin" | "manager" | "employee") {
    const [row] = await db.insert(s.users).values({ email: `${first}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@pgl.test`, firstName: first, lastName: "בדיקה", role }).returning({ id: s.users.id });
    return row!.id;
  }

  async function mkDraft() {
    return withUser({ userId: u.admin }, async (tx) => {
      const num = await allocateInvoiceNumber(tx, u.admin, "2026-11-01");
      const [c] = await tx.select({ clientId: s.contracts.clientId }).from(s.contracts).where(eq(s.contracts.id, contractId));
      const [inv] = await tx.insert(s.invoices).values({ invoiceNumber: num.invoiceNumber, sequenceNo: num.sequenceNo, sequenceYear: num.sequenceYear, contractId, clientId: c!.clientId!, partialNumber: await nextPartialNumber(tx, contractId), status: "draft", invoiceDate: "2026-11-01", createdBy: u.admin }).returning({ id: s.invoices.id });
      const [ctx] = await loadSubContractContexts(tx, [tabaId]);
      const lines = await buildMilestoneLines(tx, ctx!, 1);
      await tx.insert(s.invoiceLines).values(lines.map((l) => ({ ...l, invoiceId: inv!.id, createdBy: u.admin })));
      const first = lines[0]!;
      await tx.update(s.invoiceLines).set({ progressPctThis: "100", amountThis: first.stageAmount ?? "0" }).where(and(eq(s.invoiceLines.invoiceId, inv!.id), eq(s.invoiceLines.milestoneId, first.milestoneId!)));
      await recomputeInvoice(tx, inv!.id);
      return inv!.id;
    });
  }

  const load = (id: string) => db.select().from(s.invoices).where(eq(s.invoices.id, id)).then((r) => r[0]!);

  beforeAll(async () => {
    await runSeed(db);
    const [p] = await db.select({ id: s.projects.id }).from(s.projects).where(eq(s.projects.workNumber, "3489"));
    expect(p, "run aderet-balances test first (creates the project)").toBeTruthy();
    projectId = p!.id;
    const [c] = await db.select({ id: s.contracts.id }).from(s.contracts).where(and(eq(s.contracts.projectId, projectId), isNull(s.contracts.deletedAt)));
    contractId = c!.id;
    const [taba] = await db.select({ id: s.subContracts.id }).from(s.subContracts).where(and(eq(s.subContracts.contractId, contractId), eq(s.subContracts.numberInContract, 1)));
    tabaId = taba!.id;
    for (const o of await db.select({ id: s.invoices.id }).from(s.invoices).where(eq(s.invoices.contractId, contractId))) {
      await db.delete(s.receiptAllocations).where(eq(s.receiptAllocations.invoiceId, o.id));
      await db.delete(s.invoices).where(eq(s.invoices.id, o.id));
    }
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
