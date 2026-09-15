import "server-only";
import { auth, currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings/service";
import { roleCapabilities, type Capability, type OthersScope, type Role } from "./capabilities";
import { AuthError } from "./errors";

export interface SessionUser {
  id: string;
  clerkUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: Role;
  departmentId: string | null;
  locale: "he" | "en";
  isActive: boolean;
  capabilities: Set<Capability>;
  othersScope: OthersScope;
  mfaEnabled: boolean;
  mfaRequired: boolean;
  signatureTitle: string | null;
  hasSignature: boolean;
}

/**
 * Resolve the DB user for the current Clerk session. Cached per request.
 * Returns null when not signed in or when no matching `users` row exists.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;
  const rows = await db.select().from(users).where(eq(users.clerkUserId, clerkId)).limit(1);
  let row = rows[0];
  if (!row) {
    // First sign-in of an invited user: link by e-mail (invitation created the row without clerk id).
    const cu = await clerkCurrentUser();
    const email = cu?.primaryEmailAddress?.emailAddress?.toLowerCase();
    if (!email) return null;
    const byEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
    row = byEmail[0];
    if (!row) return null;
    if (!row.clerkUserId) {
      await db.update(users).set({ clerkUserId: clerkId, lastSeenAt: new Date() }).where(eq(users.id, row.id));
      row = { ...row, clerkUserId: clerkId };
    }
  }
  const [permissions, security] = await Promise.all([getSetting("permissions"), getSetting("security")]);
  const mfaRequired = security.mfa_required_roles.includes(row.role);
  // Clerk's Backend API is only consulted when MFA is actually enforced for this role:
  // every other render must not pay a network round-trip (and a dev-instance rate limit) for it.
  const mfaEnabled = mfaRequired ? Boolean((await clerkCurrentUser())?.twoFactorEnabled) : true;
  const today = new Date().toISOString().slice(0, 10);
  const isActive = row.isActive && !row.deletedAt && (!row.employmentEnd || row.employmentEnd >= today);
  const caps = roleCapabilities(row.role, permissions);
  return {
    id: row.id,
    clerkUserId: clerkId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: `${row.firstName} ${row.lastName}`.trim(),
    role: row.role,
    departmentId: row.departmentId,
    locale: row.locale,
    isActive,
    capabilities: caps,
    othersScope: row.role === "admin" ? "all" : (permissions.others_scope[row.role] as OthersScope),
    mfaEnabled,
    mfaRequired,
    signatureTitle: row.signatureTitle,
    hasSignature: Boolean(row.signatureImagePath),
  };
});

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new AuthError("UNAUTHENTICATED");
  if (!u.isActive) throw new AuthError("INACTIVE");
  if (u.mfaRequired && !u.mfaEnabled) throw new AuthError("MFA_REQUIRED");
  return u;
}
