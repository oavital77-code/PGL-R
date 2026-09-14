"use server";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/auth/authorize";
import { ValidationError } from "@/lib/auth/errors";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { db } from "@/lib/db";
import { contractRoles, contracts, milestones, projects, subContracts } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { getSettingFresh } from "@/lib/settings/service";
import { boolFromForm, optionalDate, optionalString, optionalUuid } from "@/lib/utils/zod";
import { allocateWorkNumber, statusIdByCode, workNumberExists } from "./queries";
import { recomputeProjectStatus } from "@/lib/contracts/status";

const projectSchema = z.object({
  id: optionalUuid,
  workNumber: optionalString,
  name: z.string().trim().min(1).max(300),
  clientId: z.uuid(),
  payingClientId: optionalUuid,
  projectManagerUserId: optionalUuid,
  departmentId: optionalUuid,
  description: optionalString,
  startDate: optionalDate,
  targetDate: optionalDate,
  actualEndDate: optionalDate,
  notes: optionalString,
  statusManual: boolFromForm,
  statusCode: optionalString,
});

export async function upsertProjectAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("projects.edit");
    const raw: Record<string, unknown> = {};
    for (const [k, v] of fd.entries()) raw[k] = v;
    raw.statusManual = raw.statusManual ?? "off";
    const d = projectSchema.parse(raw);
    const numbering = await getSettingFresh("numbering");
    if (!d.id && numbering.work_number.mode === "manual" && !d.workNumber) throw new ValidationError("errors.validation", { workNumber: ["common.required"] });
    if (d.workNumber && (await workNumberExists(d.workNumber, d.id))) throw new ValidationError("projects.work_number_exists", { workNumber: ["projects.work_number_exists"] });
    const id = await withUser({ userId: user.id }, async (tx) => {
      const values = {
        name: d.name,
        clientId: d.clientId,
        payingClientId: d.payingClientId && d.payingClientId !== d.clientId ? d.payingClientId : null,
        projectManagerUserId: d.projectManagerUserId ?? null,
        departmentId: d.departmentId ?? null,
        description: d.description ?? null,
        startDate: d.startDate ?? null,
        targetDate: d.targetDate ?? null,
        actualEndDate: d.actualEndDate ?? null,
        notes: d.notes ?? null,
        statusManual: d.statusManual,
        statusId: d.statusManual && d.statusCode ? await statusIdByCode(tx, d.statusCode) : undefined,
      };
      if (d.id) {
        await tx.update(projects).set({ ...values, ...(d.workNumber ? { workNumber: d.workNumber } : {}) }).where(eq(projects.id, d.id));
        await recomputeProjectStatus(tx, d.id);
        return d.id;
      }
      const workNumber = d.workNumber ?? (await allocateWorkNumber(tx, user.id));
      const [row] = await tx
        .insert(projects)
        .values({ ...values, workNumber, statusId: values.statusId ?? (await statusIdByCode(tx, "draft")), createdBy: user.id })
        .returning({ id: projects.id });
      return row!.id;
    });
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return { id };
  });
}

/** Duplicate project + all client contracts (spec §8.6). */
export async function duplicateProjectAction(sourceId: string, newWorkNumber: string, newName: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("projects.edit");
    const wn = z.string().trim().min(1).parse(newWorkNumber);
    if (await workNumberExists(wn)) throw new ValidationError("projects.work_number_exists", { workNumber: ["projects.work_number_exists"] });
    const [src] = await db.select().from(projects).where(and(eq(projects.id, sourceId), isNull(projects.deletedAt)));
    if (!src) throw new ValidationError("errors.not_found");
    const id = await withUser({ userId: user.id }, async (tx) => {
      const draft = await statusIdByCode(tx, "draft");
      const [np] = await tx
        .insert(projects)
        .values({
          workNumber: wn,
          name: newName.trim() || src.name,
          clientId: src.clientId,
          payingClientId: src.payingClientId,
          projectManagerUserId: src.projectManagerUserId,
          departmentId: src.departmentId,
          description: src.description,
          statusId: draft,
          createdBy: user.id,
        })
        .returning({ id: projects.id });
      const cons = await tx.select().from(contracts).where(and(eq(contracts.projectId, sourceId), eq(contracts.direction, "income"), isNull(contracts.deletedAt)));
      for (const c of cons) {
        const [nc] = await tx
          .insert(contracts)
          .values({
            projectId: np!.id,
            direction: "income",
            clientId: c.clientId,
            payingClientId: c.payingClientId,
            numberInProject: c.numberInProject,
            name: c.name,
            orderNumber: null,
            contractTypeId: c.contractTypeId,
            statusId: draft,
            description: c.description,
            indexLinked: c.indexLinked,
            indexBaseMonth: c.indexBaseMonth,
            indexFloor: c.indexFloor,
            participatesInHours: c.participatesInHours,
            retentionPct: c.retentionPct,
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
          if (ms.length)
            await tx.insert(milestones).values(ms.map((m) => ({ subContractId: ns!.id, sortOrder: m.sortOrder, stageNameId: m.stageNameId, name: m.name, pctOfSubcontract: m.pctOfSubcontract, discountPct: m.discountPct, expectedDate: null, notes: m.notes, createdBy: user.id })));
        }
      }
      return np!.id;
    });
    revalidatePath("/projects");
    return { id };
  });
}
