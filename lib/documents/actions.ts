"use server";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability, requireUser } from "@/lib/auth/authorize";
import type { Capability } from "@/lib/auth/capabilities";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { uploadDocument, type Bucket, type DocumentEntity } from "@/lib/storage";

const ENTITY_CAP: Record<DocumentEntity, Capability | null> = {
  project: "projects.edit",
  contract: "contracts.edit",
  sub_contract: "contracts.edit",
  invoice: "invoices.create",
  supplier_invoice: "supplier_invoices.manage",
  client: "clients.edit",
  supplier: "suppliers.edit",
  receipt: "receipts.manage",
  company: "settings.manage",
  user: null,
  import: "import.run",
  report_export: null,
};

const ENTITY_BUCKET: Record<DocumentEntity, Bucket> = {
  project: "general-docs",
  contract: "contracts",
  sub_contract: "contracts",
  invoice: "invoices",
  supplier_invoice: "supplier-invoices",
  client: "general-docs",
  supplier: "general-docs",
  receipt: "general-docs",
  company: "company",
  user: "signatures",
  import: "imports",
  report_export: "report-exports",
};

const schema = z.object({
  entityType: z.enum(["project", "contract", "sub_contract", "invoice", "supplier_invoice", "client", "supplier", "receipt", "company"]),
  entityId: z.uuid(),
  documentType: z.string().optional(),
  supersedesDocumentId: z.uuid().optional(),
});

export async function uploadDocumentsAction(fd: FormData): Promise<ActionResult<{ ids: string[] }>> {
  return runAction(async () => {
    const d = schema.parse({
      entityType: fd.get("entityType"),
      entityId: fd.get("entityId"),
      documentType: fd.get("documentType") || undefined,
      supersedesDocumentId: fd.get("supersedesDocumentId") || undefined,
    });
    const cap = ENTITY_CAP[d.entityType];
    const user = cap ? await requireCapability(cap) : await requireUser();
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { ids: [] };
    const ids = await withUser({ userId: user.id }, async (tx) => {
      const out: string[] = [];
      for (const file of files) {
        const r = await uploadDocument({ bucket: ENTITY_BUCKET[d.entityType], entityType: d.entityType, entityId: d.entityId, file, documentType: d.documentType, uploadedBy: user.id, supersedesDocumentId: d.supersedesDocumentId }, tx);
        out.push(r.id);
      }
      return out;
    });
    revalidatePath("/", "layout");
    return { ids };
  });
}

export async function deleteDocumentAction(id: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    if (!doc) return undefined;
    const cap = ENTITY_CAP[doc.entityType];
    const user = cap ? await requireCapability(cap) : await requireUser();
    await withUser({ userId: user.id }, (tx) => tx.update(documents).set({ deletedAt: new Date() }).where(eq(documents.id, id)));
    revalidatePath("/", "layout");
    return undefined;
  });
}

export async function listDocuments(entityType: DocumentEntity, entityId: string) {
  return db
    .select()
    .from(documents)
    .where(and(eq(documents.entityType, entityType), eq(documents.entityId, entityId)))
    .orderBy(desc(documents.createdAt));
}
