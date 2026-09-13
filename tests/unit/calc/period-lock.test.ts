import { describe, expect, it } from "vitest";
import { isFutureDate, isPeriodLocked, lockStartDate, monthOf } from "@/lib/calc/period-lock";

describe("period lock", () => {
  it("end_of_next_month rule", () => {
    expect(monthOf("2026-07-15")).toBe("2026-07-01");
    expect(lockStartDate("2026-07-01")).toBe("2026-09-01");
    expect(lockStartDate("2026-11-01")).toBe("2027-01-01");
    expect(lockStartDate("2026-07-01", "end_of_month")).toBe("2026-08-01");
    expect(lockStartDate("2026-07-01", "never")).toBeNull();
    expect(isPeriodLocked("2026-07-15", "2026-08-31")).toBe(false);
    expect(isPeriodLocked("2026-07-15", "2026-09-01")).toBe(true);
    expect(isPeriodLocked("2026-07-15", "2026-09-01", { rule: "never" })).toBe(false);
  });
  it("admin unlock window", () => {
    const unlocks = [{ userId: "u1", month: "2026-07-01", unlockedUntil: "2026-09-10T00:00:00.000Z" }];
    expect(isPeriodLocked("2026-07-15", "2026-09-05", { userId: "u1", unlocks, nowIso: "2026-09-05T10:00:00.000Z" })).toBe(false);
    expect(isPeriodLocked("2026-07-15", "2026-09-11", { userId: "u1", unlocks, nowIso: "2026-09-11T10:00:00.000Z" })).toBe(true);
    expect(isPeriodLocked("2026-07-15", "2026-09-05", { userId: "u2", unlocks, nowIso: "2026-09-05T10:00:00.000Z" })).toBe(true);
    expect(isPeriodLocked("2026-07-15", "2026-09-05", { userId: "u1", unlocks })).toBe(true);
  });
  it("future dates", () => {
    expect(isFutureDate("2026-09-14", "2026-09-13")).toBe(true);
    expect(isFutureDate("2026-09-13", "2026-09-13")).toBe(false);
  });
});
