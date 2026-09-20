/**
 * Stage 3 DoD (spec §18): partial invoice #1 for אדרת ברעננה through the real builder/recompute
 * → 7,560 / VAT 1,360.80 / total 8,920.80, and the PDF renders.
 */
import "dotenv/config";
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema as s } from "@/lib/db";
import { runSeed } from "@/lib/db/seed/run";
import { withUser } from "@/lib/db/with-user";
import { allocateInvoiceNumber, nextPartialNumber } from "@/lib/invoices/numbering";
import { buildMilestoneLines, loadSubContractContexts, recomputeInvoice } from "@/lib/invoices/build";
import { computeMilestoneLine } from "@/lib/calc/milestones";
import { buildInvoiceHtml, renderInvoicePdf } from "@/lib/pdf/invoice";
import { EXPECTED } from "../fixtures/aderet-raanana";

describe.skipIf(!process.env.DATABASE_URL)("invoice pipeline – חשבון חלקי 1", () => {
  let contractId = "";
  let tabaId = "";
  let adminId = "";
  let invoiceId = "";

  beforeAll(async () => {
    await runSeed(db);
    const [p] = await db.select({ id: s.projects.id }).from(s.projects).where(eq(s.projects.workNumber, "3489"));
    expect(p, "run aderet-balances test first (creates the project)").toBeTruthy();
    const [c] = await db.select({ id: s.contracts.id }).from(s.contracts).where(and(eq(s.contracts.projectId, p!.id), isNull(s.contracts.deletedAt)));
    contractId = c!.id;
    const [taba] = await db.select({ id: s.subContracts.id }).from(s.subContracts).where(and(eq(s.subContracts.contractId, contractId), eq(s.subContracts.numberInContract, 1)));
    tabaId = taba!.id;
    // remove invoices created by earlier tests so cumulative starts from zero
    const old = await db.select({ id: s.invoices.id }).from(s.invoices).where(eq(s.invoices.contractId, contractId));
    for (const o of old) {
      await db.delete(s.receiptAllocations).where(eq(s.receiptAllocations.invoiceId, o.id));
      await db.delete(s.invoices).where(eq(s.invoices.id, o.id));
    }
    await db.delete(s.receipts);
    const [admin] = await db.insert(s.users).values({ email: `admin-test-${Date.now()}@pgl.test`, firstName: "עידו", lastName: "בדיקה", role: "admin", signatureTitle: "כלכלן" }).returning({ id: s.users.id });
    adminId = admin!.id;
  });

  it("creates a draft with milestone lines, sets stage 1 to 100% and recomputes", async () => {
    invoiceId = await withUser({ userId: adminId }, async (tx) => {
      const num = await allocateInvoiceNumber(tx, adminId, "2026-09-01");
      const partial = await nextPartialNumber(tx, contractId);
      expect(partial).toBe(1);
      const [c] = await tx.select({ clientId: s.contracts.clientId }).from(s.contracts).where(eq(s.contracts.id, contractId));
      const [inv] = await tx.insert(s.invoices).values({ invoiceNumber: num.invoiceNumber, sequenceNo: num.sequenceNo, sequenceYear: num.sequenceYear, contractId, clientId: c!.clientId!, partialNumber: partial, status: "draft", invoiceDate: "2026-09-01", subject: "אדרת ברעננה", introText: "להלן חשבון עסקה." }).returning({ id: s.invoices.id });
      const [ctx] = await loadSubContractContexts(tx, [tabaId]);
      const lines = await buildMilestoneLines(tx, ctx!, 1);
      expect(lines).toHaveLength(7);
      expect(lines[0]!.stageAmount).toBe("7560.00");
      await tx.insert(s.invoiceLines).values(lines.map((l) => ({ ...l, invoiceId: inv!.id })));
      return inv!.id;
    });
    // user enters 100% on "לימוד מצב קיים"
    const [l1] = await db.select().from(s.invoiceLines).where(eq(s.invoiceLines.invoiceId, invoiceId)).orderBy(s.invoiceLines.sortOrder);
    const line = computeMilestoneLine({ milestoneId: l1!.milestoneId!, stageAmount: Number(l1!.stageAmount), stagePct: Number(l1!.stagePct), openingBilledPct: 0, priorProgressPct: 0, progressPctThis: 100 });
    await db.update(s.invoiceLines).set({ progressPctThis: line.progressPctThis.toFixed(3), cumulativePct: line.cumulativePct.toFixed(3), amountThis: line.amountThis.toFixed(2), cumulativeAmount: line.cumulativeAmount.toFixed(2) }).where(eq(s.invoiceLines.id, l1!.id));
    const res = await recomputeInvoice(db, invoiceId);
    expect(res.consistencyWarning).toBe(false);
    expect(res.missingIndex).toBe(false);
    const [inv] = await db.select().from(s.invoices).where(eq(s.invoices.id, invoiceId));
    expect(Number(inv!.cumulativeBase)).toBe(EXPECTED.partial1.cumulativeBase);
    expect(Number(inv!.receiptsBase)).toBe(0);
    expect(Number(inv!.openBase)).toBe(0);
    expect(Number(inv!.subtotalBase)).toBe(EXPECTED.partial1.subtotalBase);
    expect(Number(inv!.indexRatio)).toBe(1);
    expect(Number(inv!.vatRate)).toBe(18);
    expect(Number(inv!.vatAmount)).toBe(EXPECTED.partial1.vat);
    expect(Number(inv!.total)).toBe(EXPECTED.partial1.total);
    expect(inv!.dueDate).toBe("2026-10-01");
  });

  it("second draft sees prior progress (max 0% on stage 1) and prior open invoice in the summary", async () => {
    await db.update(s.invoices).set({ status: "sent" }).where(eq(s.invoices.id, invoiceId));
    const second = await withUser({ userId: adminId }, async (tx) => {
      const num = await allocateInvoiceNumber(tx, adminId, "2026-10-01");
      const [c] = await tx.select({ clientId: s.contracts.clientId }).from(s.contracts).where(eq(s.contracts.id, contractId));
      const [inv] = await tx.insert(s.invoices).values({ invoiceNumber: num.invoiceNumber, sequenceNo: num.sequenceNo, sequenceYear: num.sequenceYear, contractId, clientId: c!.clientId!, partialNumber: await nextPartialNumber(tx, contractId), status: "draft", invoiceDate: "2026-10-01" }).returning({ id: s.invoices.id });
      const [ctx] = await loadSubContractContexts(tx, [tabaId]);
      const lines = await buildMilestoneLines(tx, ctx!, 1, undefined, new Map([[ctx!.sc.id, 0]]));
      expect(lines[0]!.cumulativePct).toBe("100.000");
      expect(lines[0]!.progressPctThis).toBe("0.000");
      // stage 2 at 100%
      const l2 = computeMilestoneLine({ milestoneId: lines[1]!.milestoneId!, stageAmount: Number(lines[1]!.stageAmount), stagePct: 15, openingBilledPct: 0, priorProgressPct: 0, progressPctThis: 100 });
      lines[1] = { ...lines[1]!, progressPctThis: "100.000", cumulativePct: "100.000", amountThis: l2.amountThis.toFixed(2), cumulativeAmount: l2.cumulativeAmount.toFixed(2) };
      await tx.insert(s.invoiceLines).values(lines.map((l) => ({ ...l, invoiceId: inv!.id })));
      await recomputeInvoice(tx, inv!.id);
      return inv!.id;
    });
    const [inv] = await db.select().from(s.invoices).where(eq(s.invoices.id, second));
    expect(inv!.partialNumber).toBe(2);
    expect(Number(inv!.cumulativeBase)).toBe(18_900);
    expect(Number(inv!.openBase)).toBe(7_560);
    expect(Number(inv!.subtotalBase)).toBe(11_340);
    expect(Number(inv!.total)).toBe(13_381.2);
  });

  it("renders the invoice HTML/PDF with the spec structure", async () => {
    const html = await buildInvoiceHtml(invoiceId, { draft: true });
    expect(html).toContain("חשבון עסקה");
    expect(html).toContain("חשבון חלקי מס'");
    expect(html).toContain("לימוד מצב קיים");
    expect(html).toContain("7,560.00");
    expect(html).toContain("1,360.80");
    expect(html).toContain("8,920.80");
    expect(html).toContain("טיוטה");
    const pdf = await renderInvoicePdf(invoiceId, { draft: true });
    if (process.env.DEMO_PDF_OUT) {
      const fs = await import("node:fs");
      fs.writeFileSync(process.env.DEMO_PDF_OUT, pdf);
      fs.writeFileSync(process.env.DEMO_PDF_OUT.replace(/\.pdf$/, ".html"), await buildInvoiceHtml(invoiceId, { draft: true, signer: { id: "x", name: "אור אביטל", title: "מנכ\"ל", signaturePath: null } }));
    }
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(10_000);
  }, 120_000);
});
