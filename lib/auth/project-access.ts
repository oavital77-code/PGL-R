import type { Capability } from "./capabilities";

/**
 * Project-scoped access (customer decision 20/09/2026, DEVIATIONS.md): the project manager
 * named on a project may open it – with its contracts and sub-contracts – and assemble its
 * team, whatever their role. Everything else on those pages stays capability-based.
 */
export interface ProjectRef {
  projectManagerUserId: string | null;
}
interface UserRef {
  id: string;
  capabilities: Set<Capability>;
}

export function isProjectManager(user: { id: string }, project: ProjectRef): boolean {
  return !!project.projectManagerUserId && project.projectManagerUserId === user.id;
}

/** projects.view / contracts.view, or the project's own manager. */
export function canViewProject(user: UserRef, project: ProjectRef, capability: "projects.view" | "contracts.view" = "projects.view"): boolean {
  return user.capabilities.has(capability) || isProjectManager(user, project);
}

/** assignments.manage, or the project's own manager. */
export function canManageTeam(user: UserRef, project: ProjectRef): boolean {
  return user.capabilities.has("assignments.manage") || isProjectManager(user, project);
}
