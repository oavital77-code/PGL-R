/**
 * Mandatory verification fixture (spec §11.9): project 3489 "אדרת ברעננה".
 */
import type { MilestoneDefinition } from "@/lib/calc/milestones";

export const PROJECT = { workNumber: "3489", name: "אדרת ברעננה" };

export const TABA_SUBCONTRACT = {
  id: "sc-taba",
  name: "תב\"ע",
  pricingMethod: "fixed_price" as const,
  basePrice: 84_000,
  discountPct: 10,
};

export const TABA_MILESTONES: MilestoneDefinition[] = [
  { id: "m1", name: "לימוד מצב קיים", pctOfSubcontract: 10 },
  { id: "m2", name: "הכנת חלופות", pctOfSubcontract: 15 },
  { id: "m3", name: "בחירה ועיבוד חלופה", pctOfSubcontract: 25 },
  { id: "m4", name: "הגשה לוועדות", pctOfSubcontract: 15 },
  { id: "m5", name: "הפקדה", pctOfSubcontract: 10 },
  { id: "m6", name: "התנגדויות", pctOfSubcontract: 15 },
  { id: "m7", name: "מתן תוקף", pctOfSubcontract: 10 },
];

/**
 * NOTE (see DEVIATIONS.md): spec §11.9 states "126,000 (base 140,000, 10% discount)" for this
 * sub-contract, but the same paragraph fixes the contract total at 189,000 and the remaining
 * balance at 181,440. Those contract-level figures (the Definition-of-Done in §18) only hold when
 * this sub-contract totals 113,400 = base 126,000 × 0.9. The contract-level figures are treated
 * as authoritative.
 */
export const DETAILED_SUBCONTRACT = {
  id: "sc-detailed",
  name: "תכנון מפורט",
  pricingMethod: "fixed_price" as const,
  basePrice: 126_000,
  discountPct: 10,
};

export const DETAILED_MILESTONES: MilestoneDefinition[] = [
  { id: "d1", name: "השלמת תכנון מוקדם", pctOfSubcontract: 15 },
  { id: "d2", name: "השלמת תכנון סופי", pctOfSubcontract: 20 },
  { id: "d3", name: "אישור נספח תנועה להיתר", pctOfSubcontract: 25 },
  { id: "d4", name: "הכנת תכניות עבודה לביצוע", pctOfSubcontract: 30 },
  { id: "d5", name: "פיקוח עליון", pctOfSubcontract: 10 },
];

export const VAT_RATES = [{ rate: 18, effectiveFrom: "2025-01-01" }, { rate: 17, effectiveFrom: "2015-10-01" }];

export const EXPECTED = {
  tabaTotal: 75_600,
  detailedTotal: 113_400,
  contractTotal: 189_000,
  partial1: { amountThis: 7_560, cumulativeBase: 7_560, subtotalBase: 7_560, vat: 1_360.8, total: 8_920.8 },
  afterPartial1: { submitted: 7_560, remaining: 181_440 },
};
