import "server-only";
import { can } from "@/lib/auth/authorize";
import type { SessionUser } from "@/lib/auth/current-user";
import { AuthError } from "@/lib/auth/errors";
import { getReport } from "./registry";
import type { ReportParams, ReportResult } from "./types";

/** Run a report with capability checks; financial columns are stripped for non-financial users (spec §12.1). */
export async function runReport(key: string, params: ReportParams, user: SessionUser): Promise<ReportResult> {
  const def = getReport(key);
  if (!def) throw new AuthError("FORBIDDEN", `unknown report ${key}`);
  if (!can(user, def.requiredCapability)) throw new AuthError("FORBIDDEN");
  const res = await def.query(params, user);
  if (!can(user, "reports.financial")) {
    const drop = new Set(res.columns.filter((c) => c.financial).map((c) => c.key));
    return { ...res, columns: res.columns.filter((c) => !drop.has(c.key)), rows: res.rows.map((r) => ({ ...r, cells: Object.fromEntries(Object.entries(r.cells).filter(([k]) => !drop.has(k))) })) };
  }
  return res;
}
