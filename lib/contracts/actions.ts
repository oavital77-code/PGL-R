"use server";
import { and, eq, isNull, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability, requireUser } from "@/lib/auth/authorize";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/lib/auth/errors";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { db } from "@/lib/db";
import { contractNotes, contractRoles, contracts, milestones, projects, subContractAssignments, subContracts, users } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { boolFromForm, optionalDate, optionalNumber, optionalString, optionalUuid } from "@/lib/utils/zod";
import { notify } from "@/lib/notifications/service";
import { statusIdByCode } from "@/lib/projects/queries";
import { recomputeContractStatus } from "./status";
import { applyTemplate, subContractPricingSchema, subContractValues } from "@/lib/sub-contracts/shared";

const contractSchema = z.object({
  id: optionalUuid,
  projectId: z.uuid(),
  direction: z.enum(["income", "expense"]),
  clientId: optionalUuid,
  payingClientId: optionalUuid,
  supplierId: optionalUuid,
  name: z.string().trim().min(1).max(300),
  orderNumber: optionalString,
  contractTypeId: optionalUuid,
  signedDate: optionalDate,
  openingDate: optionalDate,
  targetDate: optionalDate,
  actualEndDate: optionalDate,
  description: optionalString,
  indexLinked: boolFromForm,
  indexBaseMonth: optionalDate,
  indexFloor: boolFromForm,
  participatesInHours: boolFromForm,
  retentionPct: optionalNumber,
  budgetAmount: optionalNumber,
  notes: optionalString,
  statusManual: boolFromForm,
  statusCode: optionalString,
  // creation only
  withSubContracts: boolFromForm,
  templateId: optionalUuid,
});

function fdToObj(fd: FormData) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) o[k] = v;
  return o;
}

export async function createContractAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.edit");
    const raw = fdToObj(fd);
    for (const k of ["indexLinked", "indexFloor", "statusManual", "withSubContracts"]) raw[k] ??= "off";
    raw.participatesInHours ??= "off";
    const d = contractSchema.parse(raw);
    const pricing = d.withSubContracts ? null : subContractPricingSchema.parse(raw);
    if (d.direction === "income" && !d.clientId) throw new ValidationError("errors.validation", { clientId: ["common.required"] });
    if (d.direction === "expense" && !d.supplierId) throw new ValidationError("errors.validation", { supplierId: ["common.required"] });
    if (d.indexLinked && !d.indexBaseMonth) throw new ValidationError("errors.validation", { indexBaseMonth: ["common.required"] });
    const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.id, d.projectId), isNull(projects.deletedAt)));
    if (!project) throw new NotFoundError("project");
    const id = await withUser({ userId: user.id }, async (tx) => {
      const [m] = await tx.select({ n: max(contracts.numberInProject) }).from(contracts).where(and(eq(contracts.projectId, d.projectId), eq(contracts.direction, d.direction)));
      const numberInProject = (m?.n ?? 0) + 1;
      const statusId = await statusIdByCode(tx, d.signedDate ? "active" : "draft");
      const baseMonth = d.indexBaseMonth ? `${d.indexBaseMonth.slice(0, 7)}-01` : null;
      const [row] = await tx
        .insert(contracts)
        .values({
          projectId: d.projectId,
          direction: d.direction,
          clientId: d.direction === "income" ? d.clientId! : null,
          payingClientId: d.direction === "income" ? (d.payingClientId ?? null) : null,
          supplierId: d.direction === "expense" ? d.supplierId! : null,
          numberInProject,
          name: d.name,
          orderNumber: d.orderNumber ?? null,
          contractTypeId: d.contractTypeId ?? null,
          statusId,
          signedDate: d.signedDate ?? null,
          openingDate: d.openingDate ?? new Date().toISOString().slice(0, 10),
          targetDate: d.targetDate ?? null,
          description: d.description ?? null,
          indexLinked: d.indexLinked,
          indexBaseMonth: baseMonth,
          indexFloor: d.indexFloor,
          participatesInHours: d.direction === "expense" ? false : d.participatesInHours,
          retentionPct: d.retentionPct?.toFixed(2) ?? null,
          budgetAmount: d.budgetAmount?.toFixed(2) ?? null,
          notes: d.notes ?? null,
          createdBy: user.id,
        })
        .returning({ id: contracts.id });
      const contractId = row!.id;
      // spec §1.2: a contract without sub-contracts gets a hidden default sub-contract
      if (!d.withSubContracts && pricing) {
        const [sc] = await tx
          .insert(subContracts)
          .values({
            contractId,
            numberInContract: 1,
            name: d.name,
            isDefault: true,
            statusId,
            openingDate: d.openingDate ?? new Date().toISOString().slice(0, 10),
            indexLinked: d.indexLinked,
            indexFloor: d.indexFloor,
            participatesInHours: d.direction === "expense" ? false : d.participatesInHours,
            ...subContractValues(pricing),
            createdBy: user.id,
          })
          .returning({ id: subContracts.id });
        if (d.templateId) await applyTemplate(tx, sc!.id, d.templateId, user.id);
      }
      await recomputeContractStatus(tx, contractId);
      return contractId;
    });
    revalidatePath(`/projects/${d.projectId}`);
    return { id };
  });
}

export async function updateContractAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.edit");
    const raw = fdToObj(fd);
    for (const k of ["indexLinked", "indexFloor", "statusManual", "participatesInHours"]) raw[k] ??= "off";
    raw.withSubContracts = "on";
    const d = contractSchema.parse(raw);
    if (!d.id) throw new ValidationError("errors.validation");
    const [c] = await db.select().from(contracts).where(and(eq(contracts.id, d.id), isNull(contracts.deletedAt)));
    if (!c) throw new NotFoundError("contract");
    if (c.isLocked) throw new BusinessRuleError("errors.locked");
    if (d.indexLinked && !d.indexBaseMonth) throw new ValidationError("errors.validation", { indexBaseMonth: ["common.required"] });
    await withUser({ userId: user.id }, async (tx) => {
      await tx
        .update(contracts)
        .set({
          clientId: c.direction === "income" ? (d.clientId ?? c.clientId) : null,
          payingClientId: c.direction === "income" ? (d.payingClientId ?? null) : null,
          supplierId: c.direction === "expense" ? (d.supplierId ?? c.supplierId) : null,
          name: d.name,
          orderNumber: d.orderNumber ?? null,
          contractTypeId: d.contractTypeId ?? null,
          signedDate: d.signedDate ?? null,
          openingDate: d.openingDate ?? c.openingDate,
          targetDate: d.targetDate ?? null,
          actualEndDate: d.actualEndDate ?? null,
          description: d.description ?? null,
          indexLinked: d.indexLinked,
          indexBaseMonth: d.indexBaseMonth ? `${d.indexBaseMonth.slice(0, 7)}-01` : null,
          indexFloor: d.indexFloor,
          participatesInHours: c.direction === "expense" ? false : d.participatesInHours,
          retentionPct: d.retentionPct?.toFixed(2) ?? null,
          budgetAmount: d.budgetAmount?.toFixed(2) ?? null,
          notes: d.notes ?? null,
          statusManual: d.statusManual,
          statusId: d.statusManual && d.statusCode ? await statusIdByCode(tx, d.statusCode) : c.statusId,
        })
        .where(eq(contracts.id, d.id!));
      // default sub-contract mirrors the contract name (spec §1.2)
      await tx.update(subContracts).set({ name: d.name }).where(and(eq(subContracts.contractId, d.id!), eq(subContracts.isDefault, true)));
      await recomputeContractStatus(tx, d.id!);
    });
    revalidatePath(`/contracts/${d.id}`);
    revalidatePath(`/projects/${c.projectId}`);
    return { id: d.id };
  });
}

export async function setContractStatusAction(id: string, statusCode: string | null): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.edit");
    await withUser({ userId: user.id }, async (tx) => {
      if (statusCode === null) {
        await tx.update(contracts).set({ statusManual: false }).where(eq(contracts.id, id));
      } else {
        await tx.update(contracts).set({ statusManual: true, statusId: await statusIdByCode(tx, statusCode) }).where(eq(contracts.id, id));
      }
      await recomputeContractStatus(tx, id);
    });
    revalidatePath(`/contracts/${id}`);
    return undefined;
  });
}

/** Lock / unlock (spec §8.2). Unlock requires contracts.unlock + reason (audited). */
export async function setContractLockAction(id: string, locked: boolean, reason: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = locked ? await requireCapability("contracts.edit") : await requireCapability("contracts.unlock");
    if (!locked && reason.trim().length < 2) throw new ValidationError("common.reason_required");
    await withUser({ userId: user.id, reason: locked ? undefined : reason }, async (tx) => {
      await tx.update(contracts).set({ isLocked: locked, notes: sql`${contracts.notes}` }).where(eq(contracts.id, id));
      if (!locked) await tx.execute(sql`update contracts set updated_at = now() where id = ${id}`);
    });
    revalidatePath(`/contracts/${id}`);
    return undefined;
  });
}

const roleSchema = z.object({ id: optionalUuid, contractId: z.uuid(), roleTitle: z.string().trim().min(1).max(200), userId: optionalUuid, contactId: optionalUuid, freeName: optionalString, notes: optionalString });

export async function upsertContractRoleAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.edit");
    const d = roleSchema.parse(fdToObj(fd));
    const id = await withUser({ userId: user.id }, async (tx) => {
      const values = { contractId: d.contractId, roleTitle: d.roleTitle, userId: d.userId ?? null, contactId: d.contactId ?? null, freeName: d.freeName ?? null, notes: d.notes ?? null };
      if (d.id) {
        await tx.update(contractRoles).set(values).where(eq(contractRoles.id, d.id));
        return d.id;
      }
      const [r] = await tx.insert(contractRoles).values({ ...values, createdBy: user.id }).returning({ id: contractRoles.id });
      return r!.id;
    });
    revalidatePath(`/contracts/${d.contractId}`);
    return { id };
  });
}

export async function deleteContractRoleAction(id: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.edit");
    const [r] = await db.select({ contractId: contractRoles.contractId }).from(contractRoles).where(eq(contractRoles.id, id));
    await withUser({ userId: user.id }, (tx) => tx.update(contractRoles).set({ deletedAt: new Date() }).where(eq(contractRoles.id, id)));
    if (r) revalidatePath(`/contracts/${r.contractId}`);
    return undefined;
  });
}

const noteSchema = z.object({ contractId: z.uuid(), subContractId: optionalUuid, body: z.string().trim().min(1).max(5000) });

/** Status notes journal with @mentions (spec §8.5). */
export async function addContractNoteAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.view");
    const d = noteSchema.parse(fdToObj(fd));
    const id = await withUser({ userId: user.id }, async (tx) => {
      const [r] = await tx.insert(contractNotes).values({ contractId: d.contractId, subContractId: d.subContractId ?? null, userId: user.id, body: d.body, createdBy: user.id }).returning({ id: contractNotes.id });
      return r!.id;
    });
    // @mentions: "@first last" or "@email"
    const mentions = [...d.body.matchAll(/@([\p{L}\p{N}._-]+(?:\s[\p{L}\p{N}._-]+)?)/gu)].map((m) => m[1]!.trim());
    if (mentions.length) {
      const all = await db.select({ id: users.id, first: users.firstName, last: users.lastName, email: users.email }).from(users).where(eq(users.isActive, true));
      const targets = all.filter((u) => mentions.some((m) => m === u.email || m === `${u.first} ${u.last}` || m === u.first)).map((u) => u.id);
      if (targets.length) await notify({ userIds: targets.filter((t) => t !== user.id), type: "note.mention", title: `${user.fullName} הזכיר/ה אותך בהערת סטטוס`, body: d.body.slice(0, 200), link: `/contracts/${d.contractId}` });
    }
    revalidatePath(`/contracts/${d.contractId}`);
    return { id };
  });
}

export async function deleteContractNoteAction(id: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireUser();
    const [n] = await db.select({ contractId: contractNotes.contractId, userId: contractNotes.userId, createdAt: contractNotes.createdAt }).from(contractNotes).where(eq(contractNotes.id, id));
    if (!n) return undefined;
    const ageHours = (Date.now() - n.createdAt.getTime()) / 3_600_000;
    if (user.role !== "admin" && !(n.userId === user.id && ageHours <= 24)) throw new BusinessRuleError("errors.forbidden");
    await withUser({ userId: user.id }, (tx) => tx.update(contractNotes).set({ deletedAt: new Date() }).where(eq(contractNotes.id, id)));
    revalidatePath(`/contracts/${n.contractId}`);
    return undefined;
  });
}

/** Duplicate contract with its sub-contracts + roles (spec §8.6). */
export async function duplicateContractAction(sourceId: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.edit");
    const [c] = await db.select().from(contracts).where(and(eq(contracts.id, sourceId), isNull(contracts.deletedAt)));
    if (!c) throw new NotFoundError("contract");
    const id = await withUser({ userId: user.id }, async (tx) => {
      const [m] = await tx.select({ n: max(contracts.numberInProject) }).from(contracts).where(and(eq(contracts.projectId, c.projectId), eq(contracts.direction, c.direction)));
      const draft = await statusIdByCode(tx, "draft");
      const [nc] = await tx
        .insert(contracts)
        .values({
          projectId: c.projectId,
          direction: c.direction,
          clientId: c.clientId,
          payingClientId: c.payingClientId,
          supplierId: c.supplierId,
          numberInProject: (m?.n ?? 0) + 1,
          name: `${c.name} (עותק)`,
          contractTypeId: c.contractTypeId,
          statusId: draft,
          description: c.description,
          indexLinked: c.indexLinked,
          indexBaseMonth: c.indexBaseMonth,
          indexFloor: c.indexFloor,
          participatesInHours: c.participatesInHours,
          retentionPct: c.retentionPct,
          budgetAmount: c.budgetAmount,
          createdBy: user.id,
        })
        .returning({ id: contracts.id });
      const roles = await tx.select().from(contractRoles).where(and(eq(contractRoles.contractId, c.id), isNull(contractRoles.deletedAt)));
      if (roles.length) await tx.insert(contractRoles).values(roles.map((r) => ({ contractId: nc!.id, roleTitle: r.roleTitle, userId: r.userId, contactId: r.contactId, freeName: r.freeName, notes: r.notes, createdBy: user.id })));
      const subs = await tx.select().from(subContracts).where(and(eq(subContracts.contractId, c.id), isNull(subContracts.deletedAt)));
      for (const s of subs) {
        const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, createdBy: _cb, ...rest } = s;
        void _id; void _c; void _u; void _d; void _cb;
        const [ns] = await tx.insert(subContracts).values({ ...rest, contractId: nc!.id, statusId: draft, isLocked: false, createdBy: user.id }).returning({ id: subContracts.id });
        const ms = await tx.select().from(milestones).where(and(eq(milestones.subContractId, s.id), isNull(milestones.deletedAt)));
        if (ms.length) await tx.insert(milestones).values(ms.map((mm) => ({ subContractId: ns!.id, sortOrder: mm.sortOrder, stageNameId: mm.stageNameId, name: mm.name, pctOfSubcontract: mm.pctOfSubcontract, discountPct: mm.discountPct, notes: mm.notes, createdBy: user.id })));
      }
      return nc!.id;
    });
    revalidatePath(`/projects/${c.projectId}`);
    return { id };
  });
}

export async function deleteContractAction(id: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.edit");
    const [c] = await db.select({ projectId: contracts.projectId }).from(contracts).where(eq(contracts.id, id));
    if (!c) return undefined;
    const [usage] = await db
      .select({ hours: sql<number>`(select count(*) from time_entries te join sub_contracts s on s.id = te.sub_contract_id where s.contract_id = ${id})`, inv: sql<number>`(select count(*) from invoices i where i.contract_id = ${id})` })
      .from(contracts)
      .where(eq(contracts.id, id));
    if (Number(usage?.hours ?? 0) > 0 || Number(usage?.inv ?? 0) > 0) throw new BusinessRuleError("contracts.cannot_delete_used");
    await withUser({ userId: user.id }, async (tx) => {
      await tx.update(subContracts).set({ deletedAt: new Date() }).where(eq(subContracts.contractId, id));
      await tx.update(subContractAssignments).set({ isActive: false }).where(sql`${subContractAssignments.subContractId} in (select id from sub_contracts where contract_id = ${id})`);
      await tx.update(contracts).set({ deletedAt: new Date() }).where(eq(contracts.id, id));
    });
    revalidatePath(`/projects/${c.projectId}`);
    return undefined;
  });
}
