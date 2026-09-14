import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Tx } from "@/lib/db";
import { milestones, stageNames, stageTemplateItems, subContracts } from "@/lib/db/schema";
import { optionalDate, optionalNumber, optionalUuid } from "@/lib/utils/zod";

/** Pricing fields shared by contract creation (default sub-contract) and sub-contract forms (spec §8.3). */
export const subContractPricingSchema = z.object({
  pricingMethod: z.enum(["fixed_price", "hourly", "retainer", "pct_of_cost", "per_unit"]),
  basePrice: optionalNumber,
  discountPct: optionalNumber,
  hourlyMode: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["rate_card", "custom"]).optional()),
  customHourlyRate: optionalNumber,
  hoursCap: optionalNumber,
  amountCap: optionalNumber,
  monthlyAmount: optionalNumber,
  retainerStart: optionalDate,
  retainerEnd: optionalDate,
  retainerBillingDay: optionalNumber,
  feePct: optionalNumber,
  unitTypeId: optionalUuid,
  unitPrice: optionalNumber,
  agreedQuantity: optionalNumber,
  initialEstimate: optionalNumber,
});
export type SubContractPricing = z.infer<typeof subContractPricingSchema>;

const f2 = (v: number | undefined) => (v === undefined ? null : v.toFixed(2));
const f3 = (v: number | undefined) => (v === undefined ? null : v.toFixed(3));

export function subContractValues(p: SubContractPricing): Pick<typeof subContracts.$inferInsert, "pricingMethod" | "basePrice" | "discountPct" | "hourlyMode" | "customHourlyRate" | "hoursCap" | "amountCap" | "monthlyAmount" | "retainerStart" | "retainerEnd" | "retainerBillingDay" | "feePct" | "unitTypeId" | "unitPrice" | "agreedQuantity"> {
  const m = p.pricingMethod;
  return {
    pricingMethod: m,
    basePrice: m === "fixed_price" ? f2(p.basePrice) : null,
    discountPct: m === "fixed_price" || m === "pct_of_cost" ? (p.discountPct ?? 0).toFixed(2) : "0",
    hourlyMode: m === "hourly" ? (p.hourlyMode ?? "rate_card") : null,
    customHourlyRate: m === "hourly" && p.hourlyMode === "custom" ? f2(p.customHourlyRate) : null,
    hoursCap: m === "hourly" ? f2(p.hoursCap) : null,
    amountCap: m === "hourly" ? f2(p.amountCap) : null,
    monthlyAmount: m === "retainer" ? f2(p.monthlyAmount) : null,
    retainerStart: m === "retainer" ? (p.retainerStart ?? null) : null,
    retainerEnd: m === "retainer" ? (p.retainerEnd ?? null) : null,
    retainerBillingDay: m === "retainer" && p.retainerBillingDay ? Math.min(28, Math.max(1, Math.round(p.retainerBillingDay))) : null,
    feePct: m === "pct_of_cost" ? f3(p.feePct) : null,
    unitTypeId: m === "per_unit" ? (p.unitTypeId ?? null) : null,
    unitPrice: m === "per_unit" ? f2(p.unitPrice) : null,
    agreedQuantity: m === "per_unit" ? f3(p.agreedQuantity) : null,
  };
}

/** Replace milestones with a template's stages (spec §8.3). */
export async function applyTemplate(tx: Tx, subContractId: string, templateId: string, userId: string) {
  const items = await tx
    .select({ pct: stageTemplateItems.defaultPct, sortOrder: stageTemplateItems.sortOrder, stageNameId: stageTemplateItems.stageNameId, name: stageNames.name })
    .from(stageTemplateItems)
    .innerJoin(stageNames, eq(stageNames.id, stageTemplateItems.stageNameId))
    .where(eq(stageTemplateItems.templateId, templateId))
    .orderBy(stageTemplateItems.sortOrder);
  await tx.update(milestones).set({ deletedAt: new Date() }).where(and(eq(milestones.subContractId, subContractId)));
  if (items.length) await tx.insert(milestones).values(items.map((it) => ({ subContractId, sortOrder: it.sortOrder, stageNameId: it.stageNameId, name: it.name, pctOfSubcontract: it.pct, createdBy: userId })));
}
