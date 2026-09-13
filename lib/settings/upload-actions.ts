"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/auth/authorize";
import { ValidationError } from "@/lib/auth/errors";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { users } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { uploadDocument } from "@/lib/storage";
import { getSettingFresh, setSetting } from "./service";

import { COMPANY_ENTITY_ID } from "./constants";

export async function uploadCompanyAssetAction(kind: "logo" | "iso_badge", fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("errors.validation", { file: ["common.required"] });
    const id = await withUser({ userId: user.id }, async (tx) => {
      const r = await uploadDocument({ bucket: "company", entityType: "company", entityId: COMPANY_ENTITY_ID, file, documentType: kind, uploadedBy: user.id, allowedExtensions: ["png", "svg", "jpg", "jpeg"] }, tx);
      const company = await getSettingFresh("company", tx);
      await setSetting("company", { ...company, [kind === "logo" ? "logo_document_id" : "iso_badge_document_id"]: r.id }, user.id, tx);
      return r.id;
    });
    revalidatePath("/settings", "layout");
    return { id };
  });
}

const sigSchema = z.object({ userId: z.uuid(), signatureTitle: z.string().trim().max(100) });

export async function saveSignatureAction(fd: FormData): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    const d = sigSchema.parse({ userId: fd.get("userId"), signatureTitle: fd.get("signatureTitle") ?? "" });
    const file = fd.get("file");
    await withUser({ userId: user.id }, async (tx) => {
      const set: Partial<typeof users.$inferInsert> = { signatureTitle: d.signatureTitle || null };
      if (file instanceof File && file.size > 0) {
        const r = await uploadDocument({ bucket: "signatures", entityType: "user", entityId: d.userId, file, documentType: "signature", uploadedBy: user.id, allowedExtensions: ["png"] }, tx);
        set.signatureImagePath = r.storagePath;
      }
      await tx.update(users).set(set).where(eq(users.id, d.userId));
    });
    revalidatePath("/settings", "layout");
    return undefined;
  });
}

export async function setDefaultSignerAction(fd: FormData): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    const userId = z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable()).parse(fd.get("default_signer_user_id"));
    await withUser({ userId: user.id }, async (tx) => {
      const inv = await getSettingFresh("invoices", tx);
      await setSetting("invoices", { ...inv, default_signer_user_id: userId }, user.id, tx);
    });
    revalidatePath("/settings", "layout");
    return undefined;
  });
}
