/** Every registered report runs against the DB without throwing (spec §12). */
import "dotenv/config";
import { describe, expect, it } from "vitest";
import { REPORTS } from "@/lib/reports/registry";
import { runReport } from "@/lib/reports/run";
import { roleCapabilities } from "@/lib/auth/capabilities";
import type { SessionUser } from "@/lib/auth/current-user";

const admin: SessionUser = { id: "00000000-0000-0000-0000-000000000001", clerkUserId: "", email: "a@b", firstName: "a", lastName: "b", fullName: "a b", role: "admin", departmentId: null, locale: "he", isActive: true, capabilities: roleCapabilities("admin"), othersScope: "all", mfaEnabled: true, mfaRequired: false, signatureTitle: null, hasSignature: false };
const manager: SessionUser = { ...admin, role: "manager", capabilities: roleCapabilities("manager") };

describe.skipIf(!process.env.DATABASE_URL)("reports registry", () => {
  for (const def of REPORTS) {
    it(`${def.key} runs`, async () => {
      const res = await runReport(def.key, { from: "2026-01-01", to: "2026-12-31", month: "2026-09", showMonths: true, groupBy: def.groupByOptions?.slice(0, 1) }, admin);
      expect(Array.isArray(res.columns)).toBe(true);
      expect(Array.isArray(res.rows)).toBe(true);
      for (const r of res.rows) for (const c of res.columns) expect(c.key in r.cells || r.cells[c.key] === undefined).toBe(true);
    });
  }
  it("contract balances shows אדרת ברעננה with 189,000 and strips financial columns for managers", async () => {
    const res = await runReport("fin.contract_balances", {}, admin);
    const proj = res.rows.find((r) => String(r.cells.name).startsWith("3489"));
    expect(proj?.cells.total).toBe(189_000);
    expect(res.columns.some((c) => c.key === "profit")).toBe(true);
    await expect(runReport("fin.contract_balances", {}, manager)).rejects.toThrow();
    const hours = await runReport("hours.by_project", {}, manager);
    expect(hours.columns.some((c) => c.financial)).toBe(false);
  });
});
