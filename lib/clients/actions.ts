"use server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/auth/authorize";
import { ValidationError } from "@/lib/auth/errors";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { db } from "@/lib/db";
import { clients, contacts } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { boolFromForm, optionalDate, optionalEmail, optionalInt, optionalNumber, optionalString, optionalUuid } from "@/lib/utils/zod";

const clientSchema = z.object({
  id: optionalUuid,
  name: z.string().trim().min(1).max(200),
  taxId: optionalString,
  clientKind: z.enum(["company", "authority", "private", "other"]).default("company"),
  addressStreet: optionalString,
  addressCity: optionalString,
  addressZip: optionalString,
  phone: optionalString,
  email: optionalEmail,
  website: optionalString,
  paymentTermsDays: optionalInt,
  indexLinkedDefault: z.preprocess((v) => (v === "" || v == null ? null : v === "true"), z.boolean().nullable()),
  vatExempt: boolFromForm,
  withholdingTaxPct: optionalNumber,
  withholdingValidUntil: optionalDate,
  notes: optionalString,
  isActive: boolFromForm,
});

export type ClientInput = z.input<typeof clientSchema>;

function fdToObj(fd: FormData) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) o[k] = v;
  return o;
}

export async function upsertClientAction(fd: FormData): Promise<ActionResult<{ id: string; warnings: string[] }>> {
  return runAction(async () => {
    const user = await requireCapability("clients.edit");
    const raw = fdToObj(fd);
    raw.isActive = raw.isActive ?? (raw.id ? "off" : "on");
    raw.vatExempt = raw.vatExempt ?? "off";
    const d = clientSchema.parse(raw);
    const warnings: string[] = [];
    if (d.taxId && !/^\d{9}$/.test(d.taxId)) warnings.push("clients.warn_tax_id");
    const dup = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.name, d.name), isNull(clients.deletedAt), d.id ? ne(clients.id, d.id) : undefined))
      .limit(1);
    if (dup[0]) warnings.push("clients.warn_duplicate_name");
    const values = {
      name: d.name,
      taxId: d.taxId ?? null,
      clientKind: d.clientKind,
      addressStreet: d.addressStreet ?? null,
      addressCity: d.addressCity ?? null,
      addressZip: d.addressZip ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      website: d.website ?? null,
      paymentTermsDays: d.paymentTermsDays ?? null,
      indexLinkedDefault: d.indexLinkedDefault,
      vatExempt: d.vatExempt,
      withholdingTaxPct: d.withholdingTaxPct?.toFixed(2) ?? null,
      withholdingValidUntil: d.withholdingValidUntil ?? null,
      notes: d.notes ?? null,
      isActive: d.isActive,
    };
    const id = await withUser({ userId: user.id }, async (tx) => {
      if (d.id) {
        await tx.update(clients).set(values).where(eq(clients.id, d.id));
        return d.id;
      }
      const [row] = await tx.insert(clients).values({ ...values, createdBy: user.id }).returning({ id: clients.id });
      return row!.id;
    });
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return { id, warnings };
  });
}

const contactSchema = z.object({
  id: optionalUuid,
  clientId: optionalUuid,
  supplierId: optionalUuid,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.preprocess((v) => (v === "" || v == null ? "" : v), z.string().trim().max(100)),
  roleTitle: optionalString,
  email: optionalEmail,
  phone: optionalString,
  receivesInvoices: boolFromForm,
  isPrimary: boolFromForm,
});

export async function upsertContactAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const raw = fdToObj(fd);
    raw.receivesInvoices = raw.receivesInvoices ?? "off";
    raw.isPrimary = raw.isPrimary ?? "off";
    const d = contactSchema.parse(raw);
    if (!d.clientId && !d.supplierId) throw new ValidationError("errors.validation");
    const user = await requireCapability(d.clientId ? "clients.edit" : "suppliers.edit");
    const values = {
      clientId: d.clientId ?? null,
      supplierId: d.supplierId ?? null,
      firstName: d.firstName,
      lastName: d.lastName,
      roleTitle: d.roleTitle ?? null,
      email: d.email ?? null,
      phone: d.phone ?? null,
      receivesInvoices: d.receivesInvoices,
      isPrimary: d.isPrimary,
    };
    const id = await withUser({ userId: user.id }, async (tx) => {
      if (d.isPrimary) {
        await tx
          .update(contacts)
          .set({ isPrimary: false })
          .where(d.clientId ? eq(contacts.clientId, d.clientId) : eq(contacts.supplierId, d.supplierId!));
      }
      if (d.id) {
        await tx.update(contacts).set(values).where(eq(contacts.id, d.id));
        return d.id;
      }
      const [row] = await tx.insert(contacts).values({ ...values, createdBy: user.id }).returning({ id: contacts.id });
      return row!.id;
    });
    revalidatePath(d.clientId ? `/clients/${d.clientId}` : `/suppliers/${d.supplierId}`);
    return { id };
  });
}

export async function deleteContactAction(id: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const [c] = await db.select({ clientId: contacts.clientId, supplierId: contacts.supplierId }).from(contacts).where(eq(contacts.id, id));
    if (!c) return undefined;
    const user = await requireCapability(c.clientId ? "clients.edit" : "suppliers.edit");
    await withUser({ userId: user.id }, (tx) => tx.update(contacts).set({ deletedAt: new Date() }).where(eq(contacts.id, id)));
    revalidatePath(c.clientId ? `/clients/${c.clientId}` : `/suppliers/${c.supplierId}`);
    return undefined;
  });
}
