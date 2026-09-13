import { describe, expect, it } from "vitest";
import { computeSubContractTotal, hasMilestones, monthsBetweenInclusive } from "@/lib/calc/subcontract";
import { TABA_SUBCONTRACT, DETAILED_SUBCONTRACT, EXPECTED } from "../../fixtures/aderet-raanana";

describe("sub-contract total amount", () => {
  it("fixed price with discount", () => {
    expect(computeSubContractTotal(TABA_SUBCONTRACT)).toEqual({ totalAmount: EXPECTED.tabaTotal, isOpen: false, milestoneBase: 84_000 });
    expect(computeSubContractTotal(DETAILED_SUBCONTRACT).totalAmount).toBe(EXPECTED.detailedTotal);
    expect(computeSubContractTotal({ pricingMethod: "fixed_price" }).totalAmount).toBe(0);
  });
  it("pct of cost", () => {
    expect(computeSubContractTotal({ pricingMethod: "pct_of_cost", feePct: 5, discountPct: 0 }, { currentEstimate: 2_000_000 })).toEqual({ totalAmount: 100_000, isOpen: false, milestoneBase: 100_000 });
    expect(computeSubContractTotal({ pricingMethod: "pct_of_cost", feePct: 5, discountPct: 10 }, { currentEstimate: 2_000_000 }).totalAmount).toBe(90_000);
    expect(computeSubContractTotal({ pricingMethod: "pct_of_cost", feePct: 5 }, { billedSoFar: 1_234 })).toEqual({ totalAmount: 1_234, isOpen: true, milestoneBase: null });
  });
  it("hourly", () => {
    expect(computeSubContractTotal({ pricingMethod: "hourly", amountCap: 50_000 }).totalAmount).toBe(50_000);
    expect(computeSubContractTotal({ pricingMethod: "hourly", hourlyMode: "custom", customHourlyRate: 250, hoursCap: 100 }).totalAmount).toBe(25_000);
    expect(computeSubContractTotal({ pricingMethod: "hourly", hourlyMode: "rate_card", hoursCap: 100 }, { representativeHourlyRate: 300 }).totalAmount).toBe(30_000);
    expect(computeSubContractTotal({ pricingMethod: "hourly", hourlyMode: "rate_card" }, { billedSoFar: 999 })).toEqual({ totalAmount: 999, isOpen: true, milestoneBase: null });
  });
  it("retainer", () => {
    expect(monthsBetweenInclusive("2026-01-01", "2026-12-01")).toBe(12);
    expect(monthsBetweenInclusive("2026-01-01", "2025-12-01")).toBe(0);
    expect(computeSubContractTotal({ pricingMethod: "retainer", monthlyAmount: 5_000, retainerStart: "2026-01-01", retainerEnd: "2026-06-30" })).toEqual({ totalAmount: 30_000, isOpen: false, milestoneBase: null });
    expect(computeSubContractTotal({ pricingMethod: "retainer", monthlyAmount: 5_000, retainerStart: "2026-01-01" }, { today: "2026-03-15" })).toEqual({ totalAmount: 15_000, isOpen: true, milestoneBase: null });
    expect(computeSubContractTotal({ pricingMethod: "retainer", monthlyAmount: 5_000, retainerStart: "2000-01-01" }).isOpen).toBe(true);
    expect(computeSubContractTotal({ pricingMethod: "retainer", monthlyAmount: 5_000 }, { billedSoFar: 10 }).totalAmount).toBe(10);
  });
  it("per unit", () => {
    expect(computeSubContractTotal({ pricingMethod: "per_unit", unitPrice: 1_500, agreedQuantity: 40 })).toEqual({ totalAmount: 60_000, isOpen: false, milestoneBase: null });
    expect(computeSubContractTotal({ pricingMethod: "per_unit", unitPrice: 1_500 }, { billedSoFar: 3_000 }).isOpen).toBe(true);
  });
  it("milestone methods", () => {
    expect(hasMilestones("fixed_price")).toBe(true);
    expect(hasMilestones("pct_of_cost")).toBe(true);
    expect(hasMilestones("hourly")).toBe(false);
  });
});

describe("sub-contract edge branches", () => {
  it("pct_of_cost with explicit null estimate / no fee", () => {
    expect(computeSubContractTotal({ pricingMethod: "pct_of_cost", feePct: null }, { currentEstimate: null }).isOpen).toBe(true);
    expect(computeSubContractTotal({ pricingMethod: "pct_of_cost" }, { currentEstimate: 1_000 }).totalAmount).toBe(0);
  });
  it("hourly custom without cap; rate_card with cap but no rate", () => {
    expect(computeSubContractTotal({ pricingMethod: "hourly", hourlyMode: "custom", customHourlyRate: 250 }).isOpen).toBe(true);
    expect(computeSubContractTotal({ pricingMethod: "hourly", hourlyMode: "rate_card", hoursCap: 100 }).isOpen).toBe(true);
    expect(computeSubContractTotal({ pricingMethod: "hourly", hourlyMode: "custom", hoursCap: 100 }).isOpen).toBe(true);
  });
  it("retainer without monthly amount", () => {
    expect(computeSubContractTotal({ pricingMethod: "retainer", retainerStart: "2026-01-01", retainerEnd: "2026-03-01" }).totalAmount).toBe(0);
  });
  it("per_unit with quantity but no price", () => {
    expect(computeSubContractTotal({ pricingMethod: "per_unit", agreedQuantity: 3 }).isOpen).toBe(true);
  });
});
