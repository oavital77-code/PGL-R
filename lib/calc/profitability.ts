/**
 * Profitability (spec §9, assumption #8 in §19).
 * income = submitted (base prices) – or Σ total of milestones with cumulative_pct = 100 when requested
 * cost   = hours cost + approved/paid supplier invoices (before VAT)
 */
import { dec, money, pctOf, sumMoney } from "./money";

export type SupplierInvoiceStatus = "pending" | "partially_approved" | "approved" | "rejected" | "paid";

export interface SupplierInvoiceLike {
  status: SupplierInvoiceStatus;
  amountBeforeVat: number;
}

export function supplierCost(invoices: readonly SupplierInvoiceLike[]): number {
  return sumMoney(invoices.filter((i) => i.status === "approved" || i.status === "paid").map((i) => i.amountBeforeVat));
}

export interface ProfitabilityInput {
  submitted: number;
  hoursCost: number;
  supplierCost: number;
  /** optional alternative income: Σ total of milestones fully completed */
  completedMilestonesTotal?: number | null;
  incomeMode?: "submitted" | "completed_milestones";
  openBalance?: number;
  vatRate?: number;
}

export interface Profitability {
  income: number;
  cost: number;
  profit: number;
  profitPct: number | null;
  /** open_balance × (1 + VAT) – "ח-ן פתוח נטו" */
  openBalanceGross: number | null;
}

export function computeProfitability(i: ProfitabilityInput): Profitability {
  const income = i.incomeMode === "completed_milestones" ? money(i.completedMilestonesTotal ?? 0) : money(i.submitted);
  const cost = money(dec(i.hoursCost).plus(i.supplierCost));
  const profit = money(dec(income).minus(cost));
  const openBalanceGross =
    i.openBalance === undefined || i.vatRate === undefined ? null : money(dec(i.openBalance).times(dec(1).plus(dec(i.vatRate).div(100))));
  return { income, cost, profit, profitPct: pctOf(profit, income), openBalanceGross };
}
