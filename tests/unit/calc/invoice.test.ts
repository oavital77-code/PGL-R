import { describe, expect, it } from "vitest";
import { agingBucket, computeInvoiceSummary, daysBetween, dueDate, paymentStatus, priorReceiptsBase } from "@/lib/calc/invoice";
import { EXPECTED } from "../../fixtures/aderet-raanana";

describe("invoice summary – חשבון עסקה 16835", () => {
  it("partial #1 of אדרת ברעננה", () => {
    const s = computeInvoiceSummary({ cumulativeBase: 7_560, sumAmountThis: 7_560, openingBilled: 0, openingPaid: 0, priorInvoices: [], indexRatio: 1, vatRate: 18 });
    expect(s.cumulativeBase).toBe(EXPECTED.partial1.cumulativeBase);
    expect(s.receiptsBase).toBe(0);
    expect(s.openBase).toBe(0);
    expect(s.subtotalBase).toBe(EXPECTED.partial1.subtotalBase);
    expect(s.consistencyWarning).toBe(false);
    expect(s.indexDiff).toBe(0);
    expect(s.retentionAmount).toBe(0);
    expect(s.beforeVat).toBe(7_560);
    expect(s.vatAmount).toBe(EXPECTED.partial1.vat);
    expect(s.total).toBe(EXPECTED.partial1.total);
    expect(s.expectedReceipt).toBeNull();
  });
  it("partial #2 after #1 fully paid: receipts 7,560, open 0", () => {
    const s = computeInvoiceSummary({
      cumulativeBase: 18_900, sumAmountThis: 11_340, openingBilled: 0, openingPaid: 0,
      priorInvoices: [{ subtotalBase: 7_560, total: 8_920.8, allocated: 8_920.8 }],
      indexRatio: 1, vatRate: 18,
    });
    expect(s.receiptsBase).toBe(7_560);
    expect(s.openBase).toBe(0);
    expect(s.subtotalBase).toBe(11_340);
    expect(s.consistencyWarning).toBe(false);
  });
  it("partial #2 after #1 half paid: receipts 3,780, open 3,780", () => {
    const s = computeInvoiceSummary({
      cumulativeBase: 18_900, sumAmountThis: 11_340, openingBilled: 0, openingPaid: 0,
      priorInvoices: [{ subtotalBase: 7_560, total: 8_920.8, allocated: 4_460.4 }],
      indexRatio: 1, vatRate: 18,
    });
    expect(s.receiptsBase).toBe(3_780);
    expect(s.openBase).toBe(3_780);
    expect(s.subtotalBase).toBe(11_340);
  });
  it("opening balances feed receipts / open", () => {
    const s = computeInvoiceSummary({ cumulativeBase: 18_900, sumAmountThis: 11_340, openingBilled: 7_560, openingPaid: 7_560, priorInvoices: [], indexRatio: 1, vatRate: 18 });
    expect(s.receiptsBase).toBe(7_560);
    expect(s.openBase).toBe(0);
    expect(s.subtotalBase).toBe(11_340);
  });
  it("index ratio 1.03", () => {
    const s = computeInvoiceSummary({ cumulativeBase: 7_560, sumAmountThis: 7_560, openingBilled: 0, openingPaid: 0, priorInvoices: [], indexRatio: 1.03, vatRate: 18 });
    expect(s.indexDiff).toBe(226.8);
    expect(s.gross).toBe(7_786.8);
    expect(s.beforeVat).toBe(7_786.8);
    expect(s.vatAmount).toBe(1_401.62);
    expect(s.total).toBe(9_188.42);
  });
  it("index floor (ratio already floored to 1) – no diff", () => {
    const s = computeInvoiceSummary({ cumulativeBase: 7_560, sumAmountThis: 7_560, openingBilled: 0, openingPaid: 0, priorInvoices: [], indexRatio: 1, vatRate: 18 });
    expect(s.indexDiff).toBe(0);
  });
  it("negative ratio 0.98 without floor", () => {
    const s = computeInvoiceSummary({ cumulativeBase: 7_560, sumAmountThis: 7_560, openingBilled: 0, openingPaid: 0, priorInvoices: [], indexRatio: 0.98, vatRate: 18 });
    expect(s.indexDiff).toBe(-151.2);
    expect(s.total).toBe(8_742.38);
  });
  it("retention 5% and withholding 5%", () => {
    const s = computeInvoiceSummary({ cumulativeBase: 7_560, sumAmountThis: 7_560, openingBilled: 0, openingPaid: 0, priorInvoices: [], indexRatio: 1, retentionPct: 5, vatRate: 18, withholdingPct: 5 });
    expect(s.retentionAmount).toBe(378);
    expect(s.beforeVat).toBe(7_182);
    expect(s.vatAmount).toBe(1_292.76);
    expect(s.total).toBe(8_474.76);
    expect(s.expectedReceipt).toBe(8_115.66);
  });
  it("credit invoice (negative)", () => {
    const s = computeInvoiceSummary({
      cumulativeBase: 3_780, sumAmountThis: -3_780, openingBilled: 0, openingPaid: 0,
      priorInvoices: [{ subtotalBase: 7_560, total: 8_920.8, allocated: 0 }],
      indexRatio: 1, vatRate: 18,
    });
    expect(s.openBase).toBe(7_560);
    expect(s.subtotalBase).toBe(-3_780);
    expect(s.total).toBe(-4_460.4);
    expect(s.consistencyWarning).toBe(false);
  });
  it("VAT exempt + consistency warning", () => {
    const s = computeInvoiceSummary({ cumulativeBase: 7_560, sumAmountThis: 7_500, openingBilled: 0, openingPaid: 0, priorInvoices: [], indexRatio: 1, vatRate: 18, vatExempt: true });
    expect(s.vatAmount).toBe(0);
    expect(s.total).toBe(7_560);
    expect(s.consistencyDiff).toBe(60);
    expect(s.consistencyWarning).toBe(true);
  });
  it("prior receipts base ignores zero-total invoices", () => {
    expect(priorReceiptsBase([{ subtotalBase: 0, total: 0, allocated: 0 }])).toBe(0);
  });
});

describe("invoice helpers", () => {
  it("due date, payment status, aging", () => {
    expect(dueDate("2026-09-13", 30)).toBe("2026-10-13");
    expect(dueDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(paymentStatus(100, 0)).toBe("unpaid");
    expect(paymentStatus(100, 50)).toBe("partially_paid");
    expect(paymentStatus(100, 100)).toBe("paid");
    expect(daysBetween("2026-09-01", "2026-09-13")).toBe(12);
    expect(agingBucket(0)).toBe("current");
    expect(agingBucket(15)).toBe("1-30");
    expect(agingBucket(45)).toBe("31-60");
    expect(agingBucket(90)).toBe("61-90");
    expect(agingBucket(91)).toBe("90+");
  });
});
