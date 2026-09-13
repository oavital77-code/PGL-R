import { describe, expect, it } from "vitest";
import { computeProfitability, supplierCost } from "@/lib/calc/profitability";

describe("profitability", () => {
  it("supplier cost counts approved/paid only", () => {
    expect(
      supplierCost([
        { status: "approved", amountBeforeVat: 1_000 },
        { status: "paid", amountBeforeVat: 500 },
        { status: "pending", amountBeforeVat: 9_999 },
        { status: "rejected", amountBeforeVat: 9_999 },
        { status: "partially_approved", amountBeforeVat: 9_999 },
      ]),
    ).toBe(1_500);
  });
  it("income = submitted by default", () => {
    const p = computeProfitability({ submitted: 7_560, hoursCost: 2_000, supplierCost: 1_500, openBalance: 7_560, vatRate: 18 });
    expect(p).toEqual({ income: 7_560, cost: 3_500, profit: 4_060, profitPct: 53.704, openBalanceGross: 8_920.8 });
  });
  it("income by completed milestones", () => {
    const p = computeProfitability({ submitted: 7_560, hoursCost: 0, supplierCost: 0, completedMilestonesTotal: 18_900, incomeMode: "completed_milestones" });
    expect(p.income).toBe(18_900);
    expect(p.openBalanceGross).toBeNull();
    expect(computeProfitability({ submitted: 0, hoursCost: 10, supplierCost: 0 }).profitPct).toBeNull();
    expect(computeProfitability({ submitted: 0, hoursCost: 0, supplierCost: 0, incomeMode: "completed_milestones" }).income).toBe(0);
  });
});
