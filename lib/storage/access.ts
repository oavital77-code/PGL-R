import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contracts, documents, invoices, projects, subContracts, supplierInvoices, users } from "@/lib/db/schema";
import { can } from "@/lib/auth/authorize";
import type { SessionUser } from "@/lib/auth/current-user";

/** Can `user` read this document? (spec §2.4 #3 – signed URL only after an authorisation check) */
export async function canReadDocument(user: SessionUser, doc: typeof documents.$inferSelect): Promise<boolean> {
  if (doc.deletedAt) return false;
  switch (doc.entityType) {
    case "company":
      return true;
    case "user":
      return user.role === "admin" || doc.entityId === user.id;
    case "project":
    case "contract":
    case "sub_contract":
      return can(user, "contracts.view") || can(user, "projects.view");
    case "client":
      return can(user, "clients.view");
    case "supplier":
      return can(user, "suppliers.view");
    case "invoice":
    case "receipt":
      return can(user, "invoices.view");
    case "supplier_invoice":
      return can(user, "supplier_invoices.manage") || can(user, "supplier_invoices.approve");
    case "import":
      return can(user, "import.run");
    case "report_export":
      return can(user, "reports.hours") || can(user, "reports.financial");
  }
  return false;
}

export async function getDocument(id: string) {
  const [d] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  return d ?? null;
}

export { contracts, invoices, projects, subContracts, supplierInvoices, users };
