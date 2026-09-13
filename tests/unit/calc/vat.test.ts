import { describe, expect, it } from "vitest";
import { computeVat, expectedReceipt, vatRateFor } from "@/lib/calc/vat";
import { VAT_RATES } from "../../fixtures/aderet-raanana";

describe("vat", () => {
  it("selects the rate in effect", () => {
    expect(vatRateFor(VAT_RATES, "2026-09-13")).toBe(18);
    expect(vatRateFor(VAT_RATES, "2024-12-31")).toBe(17);
    expect(vatRateFor(VAT_RATES, "2025-01-01")).toBe(18);
    expect(vatRateFor(VAT_RATES, "2010-01-01")).toBeNull();
  });
  it("computes 18% on 7,560", () => {
    expect(computeVat({ beforeVat: 7_560, vatRate: 18 })).toEqual({ beforeVat: 7_560, vatRate: 18, vatAmount: 1_360.8, total: 8_920.8 });
  });
  it("exempt → 0 VAT", () => {
    expect(computeVat({ beforeVat: 100, vatRate: 18, vatExempt: true })).toEqual({ beforeVat: 100, vatRate: 0, vatAmount: 0, total: 100 });
  });
  it("withholding tax informative receipt", () => {
    expect(expectedReceipt(8_920.8, 7_560, 5)).toBe(8_542.8);
    expect(expectedReceipt(8_920.8, 7_560, null)).toBe(8_920.8);
    expect(expectedReceipt(8_920.8, 7_560, 0)).toBe(8_920.8);
  });
});
