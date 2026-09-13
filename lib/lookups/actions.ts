"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/auth/authorize";
import { BusinessRuleError } from "@/lib/auth/errors";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { db } from "@/lib/db";
import { billingRates, contractStatuses, contractTypes, departments, documentTypes, grades, indexValues, stageNames, stageTemplateItems, stageTemplates, unitTypes, vatRates } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { optionalUuid } from "@/lib/utils/zod";

export type LookupTable = "departments" | "grades" | "contract_statuses" | "contract_types" | "unit_types" | "stage_names" | "document_types";

const TABLES = {
  departments,
  grades,
  contract_statuses: contractStatuses,
  contract_types: contractTypes,
  unit_types: unitTypes,
  stage_names: stageNames,
  document_types: documentTypes,
} as const;

const lookupSchema = z.object({
  id: optionalUuid,
  name: z.string().trim().min(1).max(200),
  code: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(50).optional()),
  sortOrder: z.preprocess((v) => (v === "" || v == null ? 0 : Number(v)), z.number().int()),
  isActive: z.preprocess((v) => v === "on" || v === "true" || v === true || v === undefined, z.boolean()),
  isTerminal: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  managerUserId: optionalUuid,
});

function revalidate() {
  revalidatePath("/settings", "layout");
}

export async function upsertLookupAction(table: LookupTable, fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    const data = lookupSchema.parse(Object.fromEntries(fd.entries()));
    const t = TABLES[table];
    const id = await withUser({ userId: user.id }, async (tx) => {
      const values: Record<string, unknown> = { name: data.name, sortOrder: data.sortOrder, isActive: data.isActive };
      if ("code" in t) values.code = data.code ?? data.name.toLowerCase().replace(/\s+/g, "_");
      if ("isTerminal" in t) values.isTerminal = data.isTerminal;
      if ("managerUserId" in t) values.managerUserId = data.managerUserId ?? null;
      if (data.id) {
        await tx.update(t).set(values).where(eq(t.id, data.id));
        return data.id;
      }
      const [row] = await tx
        .insert(t)
        .values({ ...values, createdBy: user.id } as never)
        .returning({ id: t.id });
      return row!.id;
    });
    revalidate();
    return { id };
  });
}

export async function toggleLookupActiveAction(table: LookupTable, id: string, isActive: boolean): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    const t = TABLES[table];
    await withUser({ userId: user.id }, (tx) => tx.update(t).set({ isActive }).where(eq(t.id, id)));
    revalidate();
    return undefined;
  });
}

/* ---------------------------- billing rates ---------------------------- */

const rateSchema = z.object({ gradeId: z.uuid(), hourlyRate: z.coerce.number().min(0), effectiveFrom: z.iso.date() });

export async function upsertBillingRateAction(fd: FormData): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    const d = rateSchema.parse(Object.fromEntries(fd.entries()));
    await withUser({ userId: user.id }, (tx) =>
      tx
        .insert(billingRates)
        .values({ gradeId: d.gradeId, hourlyRate: d.hourlyRate.toFixed(2), effectiveFrom: d.effectiveFrom, createdBy: user.id })
        .onConflictDoUpdate({ target: [billingRates.gradeId, billingRates.effectiveFrom], set: { hourlyRate: d.hourlyRate.toFixed(2) } }),
    );
    revalidate();
    return undefined;
  });
}

export async function deleteBillingRateAction(id: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    await withUser({ userId: user.id }, (tx) => tx.delete(billingRates).where(eq(billingRates.id, id)));
    revalidate();
    return undefined;
  });
}

/* ------------------------------- VAT ----------------------------------- */

const vatSchema = z.object({ rate: z.coerce.number().min(0).max(100), effectiveFrom: z.iso.date() });

export async function upsertVatRateAction(fd: FormData): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    const d = vatSchema.parse(Object.fromEntries(fd.entries()));
    await withUser({ userId: user.id }, (tx) =>
      tx.insert(vatRates).values({ rate: d.rate.toFixed(2), effectiveFrom: d.effectiveFrom, createdBy: user.id }).onConflictDoUpdate({ target: vatRates.effectiveFrom, set: { rate: d.rate.toFixed(2) } }),
    );
    revalidate();
    return undefined;
  });
}

export async function deleteVatRateAction(id: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    const count = await db.select({ c: sql<number>`count(*)` }).from(vatRates);
    if (Number(count[0]?.c ?? 0) <= 1) throw new BusinessRuleError("settings.vat.last_rate");
    await withUser({ userId: user.id }, (tx) => tx.delete(vatRates).where(eq(vatRates.id, id)));
    revalidate();
    return undefined;
  });
}

/* --------------------------- index values ------------------------------ */

const indexSchema = z.object({ month: z.iso.date(), value: z.coerce.number().positive() });

export async function upsertIndexValueAction(fd: FormData): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    const d = indexSchema.parse(Object.fromEntries(fd.entries()));
    const month = `${d.month.slice(0, 7)}-01`;
    await withUser({ userId: user.id }, (tx) =>
      tx
        .insert(indexValues)
        .values({ month, value: d.value.toFixed(4), source: "manual", enteredBy: user.id, createdBy: user.id })
        .onConflictDoUpdate({ target: indexValues.month, set: { value: d.value.toFixed(4), source: "manual", enteredBy: user.id } }),
    );
    revalidate();
    return undefined;
  });
}

export async function fetchCbsIndexAction(): Promise<ActionResult<{ fetched: number }>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    const { fetchCpiFromCbs } = await import("@/lib/jobs/cbs-index");
    const fetched = await fetchCpiFromCbs({ actingUserId: user.id, months: 24 });
    revalidate();
    return { fetched };
  });
}

/* --------------------------- stage templates ---------------------------- */

const templateSchema = z.object({
  id: optionalUuid,
  name: z.string().trim().min(1).max(200),
  items: z.array(z.object({ stageNameId: z.uuid(), defaultPct: z.coerce.number().min(0).max(100) })).min(1),
});

export async function upsertStageTemplateAction(input: z.input<typeof templateSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    const d = templateSchema.parse(input);
    const id = await withUser({ userId: user.id }, async (tx) => {
      let id = d.id;
      if (id) {
        await tx.update(stageTemplates).set({ name: d.name }).where(eq(stageTemplates.id, id));
        await tx.delete(stageTemplateItems).where(eq(stageTemplateItems.templateId, id));
      } else {
        const [row] = await tx.insert(stageTemplates).values({ name: d.name, createdBy: user.id }).returning({ id: stageTemplates.id });
        id = row!.id;
      }
      await tx.insert(stageTemplateItems).values(d.items.map((it, i) => ({ templateId: id!, stageNameId: it.stageNameId, defaultPct: it.defaultPct.toFixed(3), sortOrder: i + 1, createdBy: user.id })));
      return id!;
    });
    revalidate();
    return { id };
  });
}

export async function toggleStageTemplateAction(id: string, isActive: boolean): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    await withUser({ userId: user.id }, (tx) => tx.update(stageTemplates).set({ isActive }).where(and(eq(stageTemplates.id, id))));
    revalidate();
    return undefined;
  });
}
