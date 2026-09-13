import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { indexValues } from "@/lib/db/schema";
import { adminUserIds } from "@/lib/notifications/service";
import { notifyEvent } from "@/lib/email/notify-email";
import { previousMonth, toMonthKey } from "@/lib/calc/index-linkage";
import { todayLocal } from "@/lib/i18n/format";

/**
 * Israel CBS (Central Bureau of Statistics) – Consumer Price Index, general index (series 120010).
 * API: https://api.cbs.gov.il/index/data/price?id=120010&format=json&download=false&startPeriod=...&endPeriod=...
 * The response shape changed in the past – we parse defensively and alert admins on failure (spec §11.7).
 */
const SERIES_ID = "120010";

interface CbsMonth {
  month: string; // yyyy-mm-01
  value: number;
}

function parseCbsResponse(json: unknown): CbsMonth[] {
  const out: CbsMonth[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const o = node as Record<string, unknown>;
    const year = o.year ?? o.Year ?? o.TimePeriodYear;
    const month = o.month ?? o.Month ?? o.TimePeriodMonth;
    const value = o.value ?? o.Value ?? o.currBase?.toString?.() ?? (o.currBase as { value?: unknown } | undefined)?.value;
    if (year && month && value !== undefined && value !== null && !Number.isNaN(Number(value))) {
      out.push({ month: `${year}-${String(month).padStart(2, "0")}-01`, value: Number(value) });
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") visit(v);
  };
  visit(json);
  const uniq = new Map<string, number>();
  for (const m of out) uniq.set(m.month, m.value);
  return [...uniq.entries()].map(([month, value]) => ({ month, value })).sort((a, b) => (a.month < b.month ? -1 : 1));
}

export async function fetchCpiFromCbs(opts: { actingUserId?: string | null; months?: number } = {}): Promise<number> {
  const base = process.env.CBS_API_BASE_URL ?? "https://api.cbs.gov.il";
  const today = todayLocal();
  const endMonth = toMonthKey(today);
  let startMonth = endMonth;
  for (let i = 0; i < (opts.months ?? 3); i++) startMonth = previousMonth(startMonth);
  const url = `${base}/index/data/price?id=${SERIES_ID}&format=json&download=false&startPeriod=${startMonth.slice(0, 7)}&endPeriod=${endMonth.slice(0, 7)}&lang=he`;
  let rows: CbsMonth[] = [];
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    if (!res.ok) throw new Error(`CBS HTTP ${res.status}`);
    rows = parseCbsResponse(await res.json());
    if (rows.length === 0) throw new Error("CBS response contained no index values");
  } catch (e) {
    const admins = await adminUserIds();
    await notifyEvent({ userIds: admins, type: "index.fetch_failed", title: "כשל במשיכת מדד המחירים לצרכן", body: e instanceof Error ? e.message : String(e), link: "/settings/index", dedupeKey: `index.fetch_failed:${today}` });
    throw e;
  }
  let count = 0;
  for (const r of rows) {
    // manual values override automatic ones (spec §11.7) – do not overwrite manual rows
    const inserted = await db
      .insert(indexValues)
      .values({ month: r.month, value: r.value.toFixed(4), source: "cbs_api", fetchedAt: new Date(), createdBy: opts.actingUserId ?? null })
      .onConflictDoNothing({ target: indexValues.month })
      .returning({ id: indexValues.id });
    count += inserted.length;
  }
  return count;
}

/** Cron: run daily on days 15–20 until the previous month's value exists. */
export async function cbsIndexFetchJob() {
  const today = todayLocal();
  const day = Number(today.slice(8, 10));
  if (day < 15 || day > 20) return { skipped: "outside_window" };
  const wanted = previousMonth(toMonthKey(today));
  const latest = await db.select({ month: indexValues.month }).from(indexValues).orderBy(desc(indexValues.month)).limit(1);
  if (latest[0] && latest[0].month >= wanted) return { skipped: "already_have", month: wanted };
  const fetched = await fetchCpiFromCbs({ months: 3 });
  const after = await db.select({ month: indexValues.month }).from(indexValues).orderBy(desc(indexValues.month)).limit(1);
  if (!after[0] || after[0].month < wanted) {
    const admins = await adminUserIds();
    await notifyEvent({ userIds: admins, type: "index.missing", title: `חסר ערך מדד לחודש ${wanted.slice(5, 7)}/${wanted.slice(0, 4)}`, link: "/settings/index", dedupeKey: `index.missing:${wanted}` });
  }
  return { fetched };
}
