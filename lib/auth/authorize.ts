import "server-only";
import type { Capability } from "./capabilities";
import { getCurrentUser, requireUser, type SessionUser } from "./current-user";
import { AuthError } from "./errors";

export interface AuthContext {
  /** target user for hours.* capabilities */
  targetUserId?: string;
  targetDepartmentId?: string | null;
}

/** Central authorization check (spec §2.2 #2). */
export function can(user: SessionUser, capability: Capability, ctx: AuthContext = {}): boolean {
  if (!user.capabilities.has(capability)) return false;
  if ((capability === "hours.report_for_others" || capability === "hours.view_others") && ctx.targetUserId && ctx.targetUserId !== user.id) {
    if (user.role === "admin" || user.othersScope === "all") return true;
    return ctx.targetDepartmentId !== undefined && ctx.targetDepartmentId !== null && ctx.targetDepartmentId === user.departmentId;
  }
  return true;
}

/** Every Server Action starts with this. */
export async function requireCapability(capability: Capability, ctx: AuthContext = {}): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, capability, ctx)) throw new AuthError("FORBIDDEN", `missing capability ${capability}`);
  return user;
}

export async function requireAnyCapability(caps: Capability[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!caps.some((c) => can(user, c))) throw new AuthError("FORBIDDEN");
  return user;
}

export { getCurrentUser, requireUser };
export type { SessionUser };
