import { describe, expect, it } from "vitest";
import {
  aggregateBalances,
  allocationToBase,
  computeSubContractBalances,
  hoursByMonth,
  hoursCost,
  hoursTotal,
  isCountedStatus,
  kindSign,
  rateFor,
} from "@/lib/calc/balances";
import { EXPECTED } from "../../fixtures/aderet-raanana";

describe("balances – אדרת ברעננה after partial invoice #1", () => {
  const tabaMilestones = [7_560, 11_340, 18_900, 11_340, 7_560, 11_340, 7_560].map((total) => ({ total }));
  const detailedMilestones = [17_010, 22_680, 28_350, 34_020, 11_340].map((total) => ({ total }));

  const taba = computeSubContractBalances({
    totalAmount: 75_600,
    milestones: tabaMilestones,
    lines: [{ invoiceId: "inv1", invoiceStatus: "sent", invoiceKind: "proforma", amountThis: 7_560 }],
    invoices: [{ invoiceId: "inv1", status: "sent", kind: "proforma", subtotalBase: 7_560, total: 8_920.8, allocated: 0 }],
  });
  const detailed = computeSubContractBalances({ totalAmount: 113_400, milestones: detailedMilestones, lines: [], invoices: [] });

  it("sub-contract balances", () => {
    expect(taba).toEqual({ totalAmount: 75_600, openingBilled: 0, openingPaid: 0, submitted: 7_560, paid: 0, openBalance: 7_560, remaining: 68_040, progressPct: 10 });
    expect(detailed.remaining).toBe(113_400);
    expect(detailed.progressPct).toBe(0);
  });
  it("contract aggregate: 189,000 / submitted 7,560 / remaining 181,440", () => {
    const c = aggregateBalances([taba, detailed]);
    expect(c.totalAmount).toBe(EXPECTED.contractTotal);
    expect(c.submitted).toBe(EXPECTED.afterPartial1.submitted);
    expect(c.remaining).toBe(EXPECTED.afterPartial1.remaining);
    expect(c.openBalance).toBe(7_560);
    expect(c.progressPct).toBe(4);
  });
  it("partial receipt converts back to base prices", () => {
    // 4,460.40 paid of 8,920.80 total → 50% → 3,780 in base
    const b = computeSubContractBalances({
      totalAmount: 75_600,
      milestones: tabaMilestones,
      lines: [{ invoiceId: "inv1", invoiceStatus: "partially_paid", invoiceKind: "proforma", amountThis: 7_560 }],
      invoices: [{ invoiceId: "inv1", status: "partially_paid", kind: "proforma", subtotalBase: 7_560, total: 8_920.8, allocated: 4_460.4 }],
    });
    expect(b.paid).toBe(3_780);
    expect(b.openBalance).toBe(3_780);
  });
  it("credit invoice reduces submitted", () => {
    const b = computeSubContractBalances({
      totalAmount: 75_600,
      milestones: tabaMilestones,
      lines: [
        { invoiceId: "inv1", invoiceStatus: "sent", invoiceKind: "proforma", amountThis: 7_560 },
        { invoiceId: "cr1", invoiceStatus: "sent", invoiceKind: "credit", amountThis: 3_780 },
      ],
      invoices: [],
    });
    expect(b.submitted).toBe(3_780);
    const signed = computeSubContractBalances({
      totalAmount: 75_600, milestones: tabaMilestones, amountIsSigned: true,
      lines: [
        { invoiceId: "inv1", invoiceStatus: "sent", invoiceKind: "proforma", amountThis: 7_560 },
        { invoiceId: "cr1", invoiceStatus: "sent", invoiceKind: "credit", amountThis: -3_780 },
      ],
      invoices: [],
    });
    expect(signed.submitted).toBe(3_780);
  });
  it("draft / pending / cancelled invoices are ignored", () => {
    const b = computeSubContractBalances({
      totalAmount: 75_600, milestones: tabaMilestones,
      lines: [
        { invoiceId: "d", invoiceStatus: "draft", invoiceKind: "proforma", amountThis: 100 },
        { invoiceId: "p", invoiceStatus: "pending_approval", invoiceKind: "proforma", amountThis: 100 },
        { invoiceId: "c", invoiceStatus: "cancelled", invoiceKind: "proforma", amountThis: 100 },
      ],
      invoices: [{ invoiceId: "c", status: "cancelled", kind: "proforma", subtotalBase: 100, total: 118, allocated: 118 }],
    });
    expect(b.submitted).toBe(0);
    expect(b.paid).toBe(0);
    expect(isCountedStatus("approved")).toBe(true);
    expect(kindSign("credit")).toBe(-1);
  });
  it("opening balances", () => {
    const b = computeSubContractBalances({
      totalAmount: 75_600,
      milestones: [{ total: 7_560, openingBilledPct: 100, openingPaidAmount: 7_560 }, { total: 11_340, openingBilledPct: 50, openingPaidAmount: 0 }],
      lines: [], invoices: [],
    });
    expect(b.openingBilled).toBe(13_230);
    expect(b.openingPaid).toBe(7_560);
    expect(b.submitted).toBe(13_230);
    expect(b.openBalance).toBe(5_670);
    expect(b.remaining).toBe(62_370);
  });
  it("open-ended methods have null remaining/progress", () => {
    const b = computeSubContractBalances({ totalAmount: null, milestones: [], lines: [{ invoiceId: "i", invoiceStatus: "paid", invoiceKind: "proforma", amountThis: 500 }], invoices: [] });
    expect(b.remaining).toBeNull();
    expect(b.progressPct).toBeNull();
    expect(computeSubContractBalances({ totalAmount: 0, milestones: [], lines: [], invoices: [] }).progressPct).toBeNull();
    const agg = aggregateBalances([b, b]);
    expect(agg.totalAmount).toBeNull();
    expect(agg.remaining).toBeNull();
    const mixed = aggregateBalances([b, computeSubContractBalances({ totalAmount: 100, milestones: [], lines: [], invoices: [] })]);
    expect(mixed.totalAmount).toBe(100);
    expect(mixed.remaining).toBeNull();
    expect(mixed.progressPct).toBeNull();
    expect(aggregateBalances([]).progressPct).toBeNull();
  });
  it("allocation apportioned by sub-contract share", () => {
    // invoice covers two sub-contracts: 7,560 + 2,440 = 10,000 base, total 11,800 ; paid fully
    expect(allocationToBase({ invoiceId: "i", status: "paid", kind: "proforma", subtotalBase: 10_000, total: 11_800, allocated: 11_800, subcontractShareBase: 7_560 })).toBe(7_560);
    expect(allocationToBase({ invoiceId: "i", status: "paid", kind: "proforma", subtotalBase: 10_000, total: 0, allocated: 0 })).toBe(0);
  });
});

describe("hours & cost", () => {
  const rates = new Map([
    ["u1", [{ effectiveFrom: "2026-01-01", hourlyCost: 100 }, { effectiveFrom: "2026-07-01", hourlyCost: 120 }]],
  ]);
  const entries = [
    { userId: "u1", workDate: "2026-06-30", minutes: 90 },
    { userId: "u1", workDate: "2026-07-01", minutes: 30 },
    { userId: "u2", workDate: "2026-07-01", minutes: 60 },
  ];
  it("totals, cost by historical rate, by month", () => {
    expect(hoursTotal(entries)).toBe(3);
    expect(hoursCost(entries, rates)).toBe(210); // 1.5×100 + 0.5×120 + (u2 no rate → 0)
    expect(hoursByMonth(entries)).toEqual(new Map([["2026-06", 1.5], ["2026-07", 1.5]]));
    expect(rateFor(rates.get("u1")!, "2025-12-31")).toBeNull();
  });
});
