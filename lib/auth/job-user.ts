import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings/service";
import { roleCapabilities } from "./capabilities";
import type { SessionUser } from "./current-user";

/** Build a SessionUser for background jobs acting on behalf of a stored user (no Clerk session). */
export async function getCurrentUserForJob(userId: string): Promise<SessionUser> {
  const [row] = await db.select().from(users).where(eq(users.id, userId));
  if (!row) throw new Error("user not found");
  const permissions = await getSetting("permissions");
  return {
    id: row.id,
    clerkUserId: row.clerkUserId ?? "",
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: `${row.firstName} ${row.lastName}`,
    role: row.role,
    departmentId: row.departmentId,
    locale: row.locale,
    isActive: row.isActive,
    capabilities: roleCapabilities(row.role, permissions),
    othersScope: row.role === "admin" ? "all" : permissions.others_scope[row.role],
    mfaEnabled: true,
    mfaRequired: false,
    signatureTitle: row.signatureTitle,
    hasSignature: Boolean(row.signatureImagePath),
  };
}
