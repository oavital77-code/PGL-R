"use server";
import { and, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/auth/authorize";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/lib/auth/errors";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { db } from "@/lib/db";
import { contracts, invoiceLines, invoices, milestones, projectCostEstimates, subContractAssignments, subContracts, timeEntries } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { boolFromForm, optionalDate, optionalString, optionalUuid } from "@/lib/utils/zod";
import { statusIdByCode } from "@/lib/projects/queries";
import { recomputeContractStatus } from "@/lib/contracts/status";
import { applyTemplate, subContractPricingSchema, subContractValues } from "./shared";

const scSchema = z
  .object({
    id: optionalUuid,
    contractId: z.uuid(),
    name: z.string().trim().min(1).max(300),
    openingDate: optionalDate,
    departmentId: optionalUuid,
    indexLinked: boolFromForm,
    indexFloor: boolFromForm,
    indexBaseMonth: optionalDate,
    participatesInHours: boolFromForm,
    notes: optionalString,
    templateId: optionalUuid,
    statusCode: optionalString,
  })
  .and(subContractPricingSchema);

function fdToObj(fd: FormData) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) o[k] = v;
  for (const k of ["indexLinked", "indexFloor", "participatesInHours"]) o[k] ??= "off";
  return o;
}

async function loadContract(contractId: string) {
  const [c] = await db.select().from(contracts).where(and(eq(contracts.id, contractId), isNull(contracts.deletedAt)));
  if (!c) throw new NotFoundError("contract");
  return c;
}

function revalidate(contractId: string, projectId: string, subId?: string) {
  revalidatePath(`/contracts/${contractId}`);
  revalidatePath(`/projects/${projectId}`);
  if (subId) revalidatePath(`/sub-contracts/${subId}`);
}

export async function createSubContractAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.edit");
    const d = scSchema.parse(fdToObj(fd));
    const c = await loadContract(d.contractId);
    if (c.isLocked) throw new BusinessRuleError("errors.locked");
    const id = await withUser({ userId: user.id }, async (tx) => {
      // spec §1.2: adding a sub-contract turns the default one into a regular #1
      await tx.update(subContracts).set({ isDefault: false }).where(and(eq(subContracts.contractId, d.contractId), eq(subContracts.isDefault, true)));
      const [m] = await tx.select({ n: max(subContracts.numberInContract) }).from(subContracts).where(eq(subContracts.contractId, d.contractId));
      const [row] = await tx
        .insert(subContracts)
        .values({
          contractId: d.contractId,
          numberInContract: (m?.n ?? 0) + 1,
          name: d.name,
          isDefault: false,
          statusId: c.statusId,
          openingDate: d.openingDate ?? new Date().toISOString().slice(0, 10),
          departmentId: d.departmentId ?? null,
          indexLinked: d.indexLinked,
          indexFloor: d.indexFloor,
          indexBaseMonth: d.indexBaseMonth ? `${d.indexBaseMonth.slice(0, 7)}-01` : null,
          participatesInHours: c.direction === "expense" ? false : d.participatesInHours,
          notes: d.notes ?? null,
          ...subContractValues(d),
          createdBy: user.id,
        })
        .returning({ id: subContracts.id });
      if (d.templateId) await applyTemplate(tx, row!.id, d.templateId, user.id);
      if (d.pricingMethod === "pct_of_cost" && d.initialEstimate) {
        await tx.insert(projectCostEstimates).values({ subContractId: row!.id, estimateType: "initial", amount: d.initialEstimate.toFixed(2), effectiveFrom: new Date().toISOString().slice(0, 10), createdBy: user.id });
      }
      return row!.id;
    });
    revalidate(d.contractId, c.projectId, id);
    return { id };
  });
}

export async function updateSubContractAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.edit");
    const d = scSchema.parse(fdToObj(fd));
    if (!d.id) throw new ValidationError("errors.validation");
    const [sc] = await db.select().from(subContracts).where(and(eq(subContracts.id, d.id), isNull(subContracts.deletedAt)));
    if (!sc) throw new NotFoundError("sub_contract");
    const c = await loadContract(sc.contractId);
    if (sc.isLocked || c.isLocked) throw new BusinessRuleError("errors.locked");
    await withUser({ userId: user.id }, async (tx) => {
      await tx
        .update(subContracts)
        .set({
          name: d.name,
          openingDate: d.openingDate ?? sc.openingDate,
          departmentId: d.departmentId ?? null,
          indexLinked: d.indexLinked,
          indexFloor: d.indexFloor,
          indexBaseMonth: d.indexBaseMonth ? `${d.indexBaseMonth.slice(0, 7)}-01` : null,
          participatesInHours: c.direction === "expense" ? false : d.participatesInHours,
          notes: d.notes ?? null,
          statusId: d.statusCode ? await statusIdByCode(tx, d.statusCode) : sc.statusId,
          ...subContractValues(d),
        })
        .where(eq(subContracts.id, d.id!));
      // milestones only make sense for fixed_price / pct_of_cost
      if (d.pricingMethod !== "fixed_price" && d.pricingMethod !== "pct_of_cost") {
        const used = await tx.select({ id: invoiceLines.id }).from(invoiceLines).innerJoin(milestones, eq(milestones.id, invoiceLines.milestoneId)).where(eq(milestones.subContractId, d.id!)).limit(1);
        if (used.length === 0) await tx.update(milestones).set({ deletedAt: new Date() }).where(eq(milestones.subContractId, d.id!));
      }
      await recomputeContractStatus(tx, sc.contractId);
    });
    revalidate(sc.contractId, c.projectId, d.id);
    return { id: d.id };
  });
}

const milestoneRow = z.object({
  id: optionalUuid,
  stageNameId: optionalUuid,
  name: z.string().trim().min(1).max(200),
  pctOfSubcontract: z.coerce.number().min(0).max(100),
  discountPct: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().min(0).max(100).nullable()),
  openingBilledPct: z.coerce.number().min(0).max(100).default(0),
  openingPaidAmount: z.coerce.number().min(0).default(0),
  expectedDate: z.preprocess((v) => (v === "" || v == null ? null : v), z.iso.date().nullable()),
  notes: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().max(1000).nullable()),
});
const milestonesSchema = z.object({ subContractId: z.uuid(), rows: z.array(milestoneRow), reason: z.string().optional() });

/** Save the whole milestone table (spec §8.3). Billed milestones require admin + reason. */
export async function saveMilestonesAction(input: z.input<typeof milestonesSchema>): Promise<ActionResult<{ warnings: string[] }>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.edit");
    const d = milestonesSchema.parse(input);
    const [sc] = await db.select().from(subContracts).where(and(eq(subContracts.id, d.subContractId), isNull(subContracts.deletedAt)));
    if (!sc) throw new NotFoundError("sub_contract");
    const c = await loadContract(sc.contractId);
    if (sc.isLocked || c.isLocked) throw new BusinessRuleError("errors.locked");
    const existing = await db.select().from(milestones).where(and(eq(milestones.subContractId, d.subContractId), isNull(milestones.deletedAt)));
    const billedIds = new Set(
      (
        await db
          .select({ id: invoiceLines.milestoneId })
          .from(invoiceLines)
          .innerJoin(invoices, eq(invoices.id, invoiceLines.invoiceId))
          .where(and(inArray(invoiceLines.milestoneId, existing.map((m) => m.id).concat("00000000-0000-0000-0000-000000000000")), sql`${invoices.status} <> 'cancelled'`))
      ).map((r) => r.id!),
    );
    const incomingIds = new Set(d.rows.map((r) => r.id).filter(Boolean));
    const changedBilled = existing.filter((m) => {
      if (!billedIds.has(m.id)) return false;
      const r = d.rows.find((x) => x.id === m.id);
      if (!r) return true; // deletion
      return Number(m.pctOfSubcontract) !== r.pctOfSubcontract || (m.discountPct === null ? null : Number(m.discountPct)) !== r.discountPct || m.name !== r.name;
    });
    if (changedBilled.length > 0) {
      if (user.role !== "admin") throw new BusinessRuleError("milestones.billed_admin_only");
      if (!d.reason || d.reason.trim().length < 2) throw new ValidationError("common.reason_required", { reason: ["common.reason_required"] });
    }
    const warnings: string[] = [];
    const sum = d.rows.reduce((a, r) => a + r.pctOfSubcontract, 0);
    if (Math.abs(sum - 100) > 0.0005) warnings.push("milestones.sum_not_100");
    await withUser({ userId: user.id, reason: changedBilled.length ? d.reason : undefined }, async (tx) => {
      for (const m of existing) {
        if (!incomingIds.has(m.id)) {
          if (billedIds.has(m.id)) throw new BusinessRuleError("milestones.cannot_delete_billed");
          await tx.update(milestones).set({ deletedAt: new Date() }).where(eq(milestones.id, m.id));
        }
      }
      for (const [i, r] of d.rows.entries()) {
        const values = {
          sortOrder: i + 1,
          stageNameId: r.stageNameId ?? null,
          name: r.name,
          pctOfSubcontract: r.pctOfSubcontract.toFixed(3),
          discountPct: r.discountPct === null ? null : r.discountPct.toFixed(2),
          openingBilledPct: r.openingBilledPct.toFixed(3),
          openingPaidAmount: r.openingPaidAmount.toFixed(2),
          expectedDate: r.expectedDate,
          notes: r.notes,
        };
        if (r.id) await tx.update(milestones).set(values).where(eq(milestones.id, r.id));
        else await tx.insert(milestones).values({ ...values, subContractId: d.subContractId, createdBy: user.id });
      }
    });
    revalidate(sc.contractId, c.projectId, d.subContractId);
    return { warnings };
  });
}

export async function applyTemplateAction(subContractId: string, templateId: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.edit");
    const [sc] = await db.select().from(subContracts).where(eq(subContracts.id, subContractId));
    if (!sc) throw new NotFoundError("sub_contract");
    const c = await loadContract(sc.contractId);
    if (sc.isLocked || c.isLocked) throw new BusinessRuleError("errors.locked");
    const used = await db.select({ id: invoiceLines.id }).from(invoiceLines).innerJoin(milestones, eq(milestones.id, invoiceLines.milestoneId)).where(eq(milestones.subContractId, subContractId)).limit(1);
    if (used.length) throw new BusinessRuleError("milestones.cannot_replace_billed");
    await withUser({ userId: user.id }, (tx) => applyTemplate(tx, subContractId, templateId, user.id));
    revalidate(sc.contractId, c.projectId, subContractId);
    return undefined;
  });
}

/** Team assignment (spec §10.6). Removing does not delete existing time entries. */
export async function setAssignmentsAction(subContractId: string, userIds: string[]): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("assignments.manage");
    const ids = z.array(z.uuid()).parse(userIds);
    const [sc] = await db.select({ contractId: subContracts.contractId }).from(subContracts).where(eq(subContracts.id, subContractId));
    if (!sc) throw new NotFoundError("sub_contract");
    const c = await loadContract(sc.contractId);
    await withUser({ userId: user.id }, async (tx) => {
      const existing = await tx.select().from(subContractAssignments).where(eq(subContractAssignments.subContractId, subContractId));
      const want = new Set(ids);
      for (const e of existing) {
        const shouldBe = want.has(e.userId);
        if (e.isActive !== shouldBe) await tx.update(subContractAssignments).set({ isActive: shouldBe, assignedBy: user.id, assignedAt: new Date() }).where(eq(subContractAssignments.id, e.id));
        want.delete(e.userId);
      }
      if (want.size) await tx.insert(subContractAssignments).values([...want].map((userId) => ({ subContractId, userId, assignedBy: user.id, isActive: true, createdBy: user.id })));
    });
    revalidate(sc.contractId, c.projectId, subContractId);
    return undefined;
  });
}

const estimateSchema = z.object({ subContractId: z.uuid(), estimateType: z.enum(["initial", "tender", "execution", "actual", "other"]), amount: z.coerce.number().min(0), effectiveFrom: z.iso.date(), note: optionalString });

export async function addCostEstimateAction(fd: FormData): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.edit");
    const d = estimateSchema.parse(fdToObj(fd));
    const [sc] = await db.select({ contractId: subContracts.contractId, isLocked: subContracts.isLocked }).from(subContracts).where(eq(subContracts.id, d.subContractId));
    if (!sc) throw new NotFoundError("sub_contract");
    const c = await loadContract(sc.contractId);
    if (sc.isLocked || c.isLocked) throw new BusinessRuleError("errors.locked");
    await withUser({ userId: user.id }, (tx) => tx.insert(projectCostEstimates).values({ subContractId: d.subContractId, estimateType: d.estimateType, amount: d.amount.toFixed(2), effectiveFrom: d.effectiveFrom, note: d.note ?? null, createdBy: user.id }));
    revalidate(sc.contractId, c.projectId, d.subContractId);
    return undefined;
  });
}

export async function setSubContractLockAction(id: string, locked: boolean, reason: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = locked ? await requireCapability("contracts.edit") : await requireCapability("contracts.unlock");
    if (!locked && reason.trim().length < 2) throw new ValidationError("common.reason_required");
    const [sc] = await db.select({ contractId: subContracts.contractId }).from(subContracts).where(eq(subContracts.id, id));
    if (!sc) throw new NotFoundError("sub_contract");
    const c = await loadContract(sc.contractId);
    await withUser({ userId: user.id, reason: locked ? undefined : reason }, (tx) => tx.update(subContracts).set({ isLocked: locked }).where(eq(subContracts.id, id)));
    revalidate(sc.contractId, c.projectId, id);
    return undefined;
  });
}

export async function duplicateSubContractAction(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.edit");
    const [s] = await db.select().from(subContracts).where(and(eq(subContracts.id, id), isNull(subContracts.deletedAt)));
    if (!s) throw new NotFoundError("sub_contract");
    const c = await loadContract(s.contractId);
    if (c.isLocked) throw new BusinessRuleError("errors.locked");
    const newId = await withUser({ userId: user.id }, async (tx) => {
      await tx.update(subContracts).set({ isDefault: false }).where(and(eq(subContracts.contractId, s.contractId), eq(subContracts.isDefault, true)));
      const [m] = await tx.select({ n: max(subContracts.numberInContract) }).from(subContracts).where(eq(subContracts.contractId, s.contractId));
      const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, createdBy: _cb, ...rest } = s;
      void _id; void _c; void _u; void _d; void _cb;
      const [ns] = await tx.insert(subContracts).values({ ...rest, numberInContract: (m?.n ?? 0) + 1, name: `${s.name} (עותק)`, isDefault: false, isLocked: false, createdBy: user.id }).returning({ id: subContracts.id });
      const ms = await tx.select().from(milestones).where(and(eq(milestones.subContractId, s.id), isNull(milestones.deletedAt)));
      if (ms.length) await tx.insert(milestones).values(ms.map((mm) => ({ subContractId: ns!.id, sortOrder: mm.sortOrder, stageNameId: mm.stageNameId, name: mm.name, pctOfSubcontract: mm.pctOfSubcontract, discountPct: mm.discountPct, notes: mm.notes, createdBy: user.id })));
      return ns!.id;
    });
    revalidate(s.contractId, c.projectId, newId);
    return { id: newId };
  });
}

export async function deleteSubContractAction(id: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.edit");
    const [s] = await db.select({ contractId: subContracts.contractId, isDefault: subContracts.isDefault }).from(subContracts).where(eq(subContracts.id, id));
    if (!s) return undefined;
    const c = await loadContract(s.contractId);
    if (c.isLocked) throw new BusinessRuleError("errors.locked");
    const [te] = await db.select({ n: sql<number>`count(*)` }).from(timeEntries).where(eq(timeEntries.subContractId, id));
    const [il] = await db.select({ n: sql<number>`count(*)` }).from(invoiceLines).where(eq(invoiceLines.subContractId, id));
    if (Number(te?.n ?? 0) > 0 || Number(il?.n ?? 0) > 0) throw new BusinessRuleError("sub_contracts.cannot_delete_used");
    await withUser({ userId: user.id }, async (tx) => {
      await tx.update(subContracts).set({ deletedAt: new Date() }).where(eq(subContracts.id, id));
      await tx.update(subContractAssignments).set({ isActive: false }).where(eq(subContractAssignments.subContractId, id));
    });
    revalidate(s.contractId, c.projectId);
    return undefined;
  });
}
