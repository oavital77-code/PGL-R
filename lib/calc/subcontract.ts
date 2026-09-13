/**
 * Sub-contract total amount by pricing method (spec §8.3 table).
 */
import { applyDiscount, applyPct, dec, money } from "./money";

export type PricingMethod = "fixed_price" | "hourly" | "retainer" | "pct_of_cost" | "per_unit";
export type HourlyMode = "rate_card" | "custom";

export interface SubContractPricing {
  pricingMethod: PricingMethod;
  // fixed_price
  basePrice?: number | null;
  discountPct?: number | null;
  // hourly
  hourlyMode?: HourlyMode | null;
  customHourlyRate?: number | null;
  hoursCap?: number | null;
  amountCap?: number | null;
  // retainer
  monthlyAmount?: number | null;
  retainerStart?: string | null; // yyyy-mm-dd
  retainerEnd?: string | null;
  // pct_of_cost
  feePct?: number | null;
  // per_unit
  unitPrice?: number | null;
  agreedQuantity?: number | null;
}

export interface SubContractTotalContext {
  /** Σ amount_this already billed (status ≥ approved) – used for "open" methods */
  billedSoFar?: number;
  /** current active cost estimate (pct_of_cost) */
  currentEstimate?: number | null;
  /** hourly rate to apply for hours_cap when mode is rate_card (e.g. average/representative) */
  representativeHourlyRate?: number | null;
  /** today's ISO date – for open-ended retainers */
  today?: string;
}

export interface SubContractTotal {
  /** null only when the method is open and nothing is billed yet is *not* the case – we always return a number; `isOpen` tells if it's a cap-less running sum */
  totalAmount: number;
  /** true when there is no contractual ceiling (running Σ of billed amounts is shown) */
  isOpen: boolean;
  /** base used for milestone % (fixed_price: base_price; pct_of_cost: fee) */
  milestoneBase: number | null;
}

/** Number of calendar months between two month-starts, inclusive of both. */
export function monthsBetweenInclusive(start: string, end: string): number {
  const sy = Number(start.slice(0, 4));
  const sm = Number(start.slice(5, 7));
  const ey = Number(end.slice(0, 4));
  const em = Number(end.slice(5, 7));
  const n = (ey - sy) * 12 + (em - sm) + 1;
  return Math.max(0, n);
}

export function computeSubContractTotal(sc: SubContractPricing, ctx: SubContractTotalContext = {}): SubContractTotal {
  const billed = money(ctx.billedSoFar ?? 0);
  switch (sc.pricingMethod) {
    case "fixed_price": {
      const base = money(sc.basePrice ?? 0);
      return { totalAmount: applyDiscount(base, sc.discountPct ?? 0), isOpen: false, milestoneBase: base };
    }
    case "pct_of_cost": {
      const est = ctx.currentEstimate;
      if (est === null || est === undefined) return { totalAmount: billed, isOpen: true, milestoneBase: null };
      const fee = applyPct(est, sc.feePct ?? 0);
      return { totalAmount: applyDiscount(fee, sc.discountPct ?? 0), isOpen: false, milestoneBase: fee };
    }
    case "hourly": {
      if (sc.amountCap) return { totalAmount: money(sc.amountCap), isOpen: false, milestoneBase: null };
      const rate = sc.hourlyMode === "custom" ? sc.customHourlyRate : ctx.representativeHourlyRate;
      if (sc.hoursCap && rate) return { totalAmount: money(dec(sc.hoursCap).times(rate)), isOpen: false, milestoneBase: null };
      return { totalAmount: billed, isOpen: true, milestoneBase: null };
    }
    case "retainer": {
      const monthly = money(sc.monthlyAmount ?? 0);
      if (!sc.retainerStart) return { totalAmount: billed, isOpen: true, milestoneBase: null };
      if (sc.retainerEnd) {
        return { totalAmount: money(dec(monthly).times(monthsBetweenInclusive(sc.retainerStart, sc.retainerEnd))), isOpen: false, milestoneBase: null };
      }
      const today = ctx.today ?? new Date().toISOString().slice(0, 10);
      return { totalAmount: money(dec(monthly).times(monthsBetweenInclusive(sc.retainerStart, today))), isOpen: true, milestoneBase: null };
    }
    case "per_unit": {
      if (sc.agreedQuantity && sc.unitPrice) {
        return { totalAmount: money(dec(sc.agreedQuantity).times(sc.unitPrice)), isOpen: false, milestoneBase: null };
      }
      return { totalAmount: billed, isOpen: true, milestoneBase: null };
    }
  }
}

/** Methods that carry milestones. */
export function hasMilestones(method: PricingMethod): boolean {
  return method === "fixed_price" || method === "pct_of_cost";
}
