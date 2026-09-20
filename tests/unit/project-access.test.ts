import { describe, expect, it } from "vitest";
import { canManageTeam, canViewProject, isProjectManager } from "@/lib/auth/project-access";
import type { Capability } from "@/lib/auth/capabilities";

const u = (id: string, ...caps: Capability[]) => ({ id, capabilities: new Set(caps) });

describe("project-scoped access", () => {
  const project = { projectManagerUserId: "pm" };
  it("the named project manager opens the project and assembles its team without any capability", () => {
    expect(isProjectManager(u("pm"), project)).toBe(true);
    expect(canViewProject(u("pm"), project)).toBe(true);
    expect(canViewProject(u("pm"), project, "contracts.view")).toBe(true);
    expect(canManageTeam(u("pm"), project)).toBe(true);
  });
  it("anyone else needs the capability", () => {
    expect(canViewProject(u("x"), project)).toBe(false);
    expect(canViewProject(u("x", "projects.view"), project)).toBe(true);
    expect(canManageTeam(u("x"), project)).toBe(false);
    expect(canManageTeam(u("x", "assignments.manage"), project)).toBe(true);
  });
  it("a project without a manager grants nothing by that route", () => {
    expect(isProjectManager(u("pm"), { projectManagerUserId: null })).toBe(false);
  });
});
