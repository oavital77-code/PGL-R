"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAnyCapability, requireCapability, requireUser } from "@/lib/auth/authorize";
import { BusinessRuleError, NotFoundError } from "@/lib/auth/errors";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { db } from "@/lib/db";
import { contractNotes, reportSchedules, reportTemplates } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { optionalUuid } from "@/lib/utils/zod";
import { runReport } from "./run";
import { computeNextRun } from "./schedule";
import type { ReportParams, ReportResult } from "./types";

const paramsSchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  clientIds: z.array(z.uuid()).optional(),
  projectIds: z.array(z.uuid()).optional(),
  contractIds: z.array(z.uuid()).optional(),
  subContractIds: z.array(z.uuid()).optional(),
  departmentIds: z.array(z.uuid()).optional(),
  userIds: z.array(z.uuid()).optional(),
  pmIds: z.array(z.uuid()).optional(),
  statusCodes: z.array(z.string()).optional(),
  pricingMethods: z.array(z.string()).optional(),
  supplierIds: z.array(z.uuid()).optional(),
  invoiceStatuses: z.array(z.string()).optional(),
  includeInactive: z.boolean().optional(),
  groupBy: z.array(z.string()).optional(),
  showMonths: z.boolean().optional(),
  incomeMode: z.enum(["submitted", "completed_milestones"]).optional(),
  compare: z.boolean().optional(),
});

export async function runReportAction(key: string, params: ReportParams): Promise<ActionResult<ReportResult>> {
  return runAction(async () => {
    const user = await requireAnyCapability(["reports.hours", "reports.financial", "audit.view"]);
    return runReport(key, paramsSchema.parse(params), user);
  });
}

/** Compare to previous period (spec §12.1 toggle): same length window ending before `from`. */
export async function runReportCompareAction(key: string, params: ReportParams): Promise<ActionResult<ReportResult>> {
  return runAction(async () => {
    const user = await requireAnyCapability(["reports.hours", "reports.financial", "audit.view"]);
    const p = paramsSchema.parse(params);
    if (!p.from || !p.to) throw new BusinessRuleError("reports.compare_needs_range");
    const len = (Date.parse(p.to) - Date.parse(p.from)) / 86_400_000 + 1;
    const prevTo = new Date(Date.parse(p.from) - 86_400_000).toISOString().slice(0, 10);
    const prevFrom = new Date(Date.parse(prevTo) - (len - 1) * 86_400_000).toISOString().slice(0, 10);
    return runReport(key, { ...p, from: prevFrom, to: prevTo }, user);
  });
}

const templateSchema = z.object({ id: optionalUuid, name: z.string().trim().min(1).max(200), reportType: z.string(), config: z.record(z.string(), z.unknown()), isShared: z.boolean().default(false) });

export async function saveTemplateAction(input: z.input<typeof templateSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireAnyCapability(["reports.hours", "reports.financial"]);
    const d = templateSchema.parse(input);
    if (d.isShared && user.role !== "admin") d.isShared = false;
    const id = await withUser({ userId: user.id }, async (tx) => {
      if (d.id) {
        const [t] = await tx.select({ owner: reportTemplates.ownerUserId }).from(reportTemplates).where(eq(reportTemplates.id, d.id));
        if (!t || (t.owner !== user.id && user.role !== "admin")) throw new NotFoundError("template");
        await tx.update(reportTemplates).set({ name: d.name, config: d.config, isShared: d.isShared }).where(eq(reportTemplates.id, d.id));
        return d.id;
      }
      const [r] = await tx.insert(reportTemplates).values({ name: d.name, ownerUserId: user.id, reportType: d.reportType, config: d.config, isShared: d.isShared, createdBy: user.id }).returning({ id: reportTemplates.id });
      return r!.id;
    });
    revalidatePath("/reports");
    return { id };
  });
}

export async function deleteTemplateAction(id: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireUser();
    const [t] = await db.select({ owner: reportTemplates.ownerUserId }).from(reportTemplates).where(eq(reportTemplates.id, id));
    if (!t || (t.owner !== user.id && user.role !== "admin")) throw new NotFoundError("template");
    await withUser({ userId: user.id }, async (tx) => {
      await tx.delete(reportSchedules).where(eq(reportSchedules.templateId, id));
      await tx.delete(reportTemplates).where(eq(reportTemplates.id, id));
    });
    revalidatePath("/reports");
    return undefined;
  });
}

const scheduleSchema = z.object({ id: optionalUuid, templateId: z.uuid(), frequency: z.enum(["daily", "weekly", "monthly"]), dayOfWeek: z.coerce.number().int().min(0).max(6).optional(), dayOfMonth: z.coerce.number().int().min(1).max(28).optional(), hour: z.coerce.number().int().min(0).max(23).default(7), recipients: z.array(z.email()).min(1), format: z.enum(["xlsx", "pdf"]).default("xlsx"), isActive: z.boolean().default(true) });

export async function saveScheduleAction(input: z.input<typeof scheduleSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("reports.schedule");
    const d = scheduleSchema.parse(input);
    const next = computeNextRun(d);
    const id = await withUser({ userId: user.id }, async (tx) => {
      const values = { templateId: d.templateId, frequency: d.frequency, dayOfWeek: d.dayOfWeek ?? null, dayOfMonth: d.dayOfMonth ?? null, hour: d.hour, recipients: d.recipients, format: d.format, isActive: d.isActive, nextRunAt: next };
      if (d.id) {
        await tx.update(reportSchedules).set(values).where(eq(reportSchedules.id, d.id));
        return d.id;
      }
      const [r] = await tx.insert(reportSchedules).values({ ...values, createdBy: user.id }).returning({ id: reportSchedules.id });
      return r!.id;
    });
    revalidatePath("/reports");
    return { id };
  });
}

export async function deleteScheduleAction(id: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("reports.schedule");
    await withUser({ userId: user.id }, (tx) => tx.delete(reportSchedules).where(eq(reportSchedules.id, id)));
    revalidatePath("/reports");
    return undefined;
  });
}

/** Inline status-note edit from the contract balances report (spec §12.4). */
export async function addNoteFromReportAction(contractId: string, body: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("contracts.view");
    const text = z.string().trim().min(1).max(5000).parse(body);
    await withUser({ userId: user.id }, (tx) => tx.insert(contractNotes).values({ contractId, userId: user.id, body: text, createdBy: user.id }));
    return undefined;
  });
}

export async function listTemplatesAction() {
  const user = await requireUser();
  return db.select().from(reportTemplates).where(and(eq(reportTemplates.ownerUserId, user.id)));
}
