"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/auth/authorize";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { suppliers } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { boolFromForm, optionalEmail, optionalInt, optionalString, optionalUuid } from "@/lib/utils/zod";

const supplierSchema = z.object({
  id: optionalUuid,
  name: z.string().trim().min(1).max(200),
  taxId: optionalString,
  field: optionalString,
  addressStreet: optionalString,
  addressCity: optionalString,
  addressZip: optionalString,
  phone: optionalString,
  email: optionalEmail,
  website: optionalString,
  paymentTermsDays: optionalInt,
  notes: optionalString,
  isActive: boolFromForm,
});

export async function upsertSupplierAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("suppliers.edit");
    const raw: Record<string, unknown> = {};
    for (const [k, v] of fd.entries()) raw[k] = v;
    raw.isActive = raw.isActive ?? (raw.id ? "off" : "on");
    const d = supplierSchema.parse(raw);
    const values = {
      name: d.name,
      taxId: d.taxId ?? null,
      field: d.field ?? null,
      addressStreet: d.addressStreet ?? null,
      addressCity: d.addressCity ?? null,
      addressZip: d.addressZip ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      website: d.website ?? null,
      paymentTermsDays: d.paymentTermsDays ?? null,
      notes: d.notes ?? null,
      isActive: d.isActive,
    };
    const id = await withUser({ userId: user.id }, async (tx) => {
      if (d.id) {
        await tx.update(suppliers).set(values).where(eq(suppliers.id, d.id));
        return d.id;
      }
      const [row] = await tx.insert(suppliers).values({ ...values, createdBy: user.id }).returning({ id: suppliers.id });
      return row!.id;
    });
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    return { id };
  });
}
