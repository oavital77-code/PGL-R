import { describe, expect, it } from "vitest";
import {
  MilestoneProgressError,
  computeMilestoneLine,
  milestoneAmounts,
  milestoneTotals,
  progressFromCumulative,
  subcontractLinesTotals,
} from "@/lib/calc/milestones";
import { TABA_MILESTONES, TABA_SUBCONTRACT, DETAILED_MILESTONES, DETAILED_SUBCONTRACT, EXPECTED } from "../../fixtures/aderet-raanana";

describe("milestone amounts – אדרת ברעננה", () => {
  it("taba milestones: 10% of 84,000 with 10% discount = 7,560", () => {
    const rows = TABA_MILESTONES.map((m) => milestoneAmounts(TABA_SUBCONTRACT.basePrice, m, TABA_SUBCONTRACT.discountPct));
    expect(rows[0]).toEqual({ amount: 8_400, total: 7_560, discountPct: 10 });
    expect(rows.map((r) => r.total)).toEqual([7_560, 11_340, 18_900, 11_340, 7_560, 11_340, 7_560]);
    const totals = milestoneTotals(rows.map((r, i) => ({ ...r, pctOfSubcontract: TABA_MILESTONES[i]!.pctOfSubcontract })));
    expect(totals).toEqual({ sumPct: 100, sumAmount: 84_000, sumTotal: EXPECTED.tabaTotal, isComplete: true });
  });
  it("detailed sub-contract totals 126,000", () => {
    const rows = DETAILED_MILESTONES.map((m) => milestoneAmounts(DETAILED_SUBCONTRACT.basePrice, m, DETAILED_SUBCONTRACT.discountPct));
    expect(milestoneTotals(rows.map((r, i) => ({ ...r, pctOfSubcontract: DETAILED_MILESTONES[i]!.pctOfSubcontract }))).sumTotal).toBe(EXPECTED.detailedTotal);
  });
  it("row-level discount override & incomplete pct warning", () => {
    expect(milestoneAmounts(1000, { id: "x", name: "x", pctOfSubcontract: 50, discountPct: 0 }, 10)).toEqual({ amount: 500, total: 500, discountPct: 0 });
    const t = milestoneTotals([{ pctOfSubcontract: 40, amount: 400, total: 400 }]);
    expect(t.isComplete).toBe(false);
  });
});

describe("invoice milestone lines", () => {
  it("partial invoice #1: 100% of 'לימוד מצב קיים'", () => {
    const line = computeMilestoneLine({ milestoneId: "m1", stageAmount: 7_560, stagePct: 10, openingBilledPct: 0, priorProgressPct: 0, progressPctThis: 100 });
    expect(line).toEqual({
      milestoneId: "m1", stagePct: 10, stageAmount: 7_560, prevCumulativePct: 0, maxThis: 100,
      progressPctThis: 100, cumulativePct: 100, amountThis: EXPECTED.partial1.amountThis, cumulativeAmount: 7_560,
    });
  });
  it("zero-progress lines are kept (shown with 0.00)", () => {
    const line = computeMilestoneLine({ milestoneId: "m2", stageAmount: 11_340, stagePct: 15, openingBilledPct: 0, priorProgressPct: 0, progressPctThis: 0 });
    expect(line.amountThis).toBe(0);
    expect(line.cumulativeAmount).toBe(0);
  });
  it("opening balance + prior progress limit max_this", () => {
    const line = computeMilestoneLine({ milestoneId: "m3", stageAmount: 18_900, stagePct: 25, openingBilledPct: 30, priorProgressPct: 20, progressPctThis: 25 });
    expect(line.prevCumulativePct).toBe(50);
    expect(line.maxThis).toBe(50);
    expect(line.amountThis).toBe(4_725);
    expect(line.cumulativePct).toBe(75);
    expect(line.cumulativeAmount).toBe(14_175);
  });
  it("blocks cumulative > 100 and < 0", () => {
    expect(() => computeMilestoneLine({ milestoneId: "m1", stageAmount: 7_560, stagePct: 10, openingBilledPct: 0, priorProgressPct: 60, progressPctThis: 50 })).toThrow(MilestoneProgressError);
    try {
      computeMilestoneLine({ milestoneId: "m1", stageAmount: 7_560, stagePct: 10, openingBilledPct: 0, priorProgressPct: 60, progressPctThis: 50 });
    } catch (e) {
      expect((e as MilestoneProgressError).code).toBe("OVER_100");
      expect((e as MilestoneProgressError).cumulativePct).toBe(110);
    }
    expect(() => computeMilestoneLine({ milestoneId: "m1", stageAmount: 7_560, stagePct: 10, openingBilledPct: 0, priorProgressPct: 10, progressPctThis: -20 })).toThrow(/below 0/);
  });
  it("credit invoice: negative progress reduces cumulative", () => {
    const line = computeMilestoneLine({ milestoneId: "m1", stageAmount: 7_560, stagePct: 10, openingBilledPct: 0, priorProgressPct: 100, progressPctThis: -50 });
    expect(line.amountThis).toBe(-3_780);
    expect(line.cumulativePct).toBe(50);
    expect(line.cumulativeAmount).toBe(3_780);
  });
  it("derives progress from a new cumulative", () => {
    expect(progressFromCumulative(10, 20, 75)).toBe(45);
  });
  it("sub-contract totals row", () => {
    const lines = [
      computeMilestoneLine({ milestoneId: "m1", stageAmount: 7_560, stagePct: 10, openingBilledPct: 0, priorProgressPct: 0, progressPctThis: 100 }),
      computeMilestoneLine({ milestoneId: "m2", stageAmount: 11_340, stagePct: 15, openingBilledPct: 0, priorProgressPct: 0, progressPctThis: 0 }),
    ];
    const t = subcontractLinesTotals(lines);
    expect(t.sumStagePct).toBe(25);
    expect(t.sumStageAmount).toBe(18_900);
    expect(t.sumAmountThis).toBe(7_560);
    expect(t.sumCumulativeAmount).toBe(7_560);
    expect(t.progressPctThisInvoice).toBe(40);
    expect(t.cumulativePct).toBe(40);
    expect(subcontractLinesTotals([]).progressPctThisInvoice).toBeNull();
  });
});
