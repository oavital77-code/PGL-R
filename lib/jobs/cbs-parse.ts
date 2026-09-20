/** Pure parsing of the CBS price-index API response; no database access, unit-tested with the live shape. */
export interface CbsMonth {
  month: string; // yyyy-mm-01
  value: number;
}

/**
 * The live response (verified 19/09/2026) is
 *   { month: [ { code, name, date: [ { year, month, percent, currBase: { baseDesc, value }, prevBase } ] } ] }
 * so the index value of a month sits in currBase.value. Other shapes seen over the years put it
 * in value / Value; those are still accepted. The walk is defensive: any object that carries a
 * year, a numeric month and a value is taken as one month.
 */
export function parseCbsResponse(json: unknown): CbsMonth[] {
  const out: CbsMonth[] = [];
  const num = (v: unknown): number | null => (v === undefined || v === null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const o = node as Record<string, unknown>;
    const year = num(o.year ?? o.Year ?? o.TimePeriodYear);
    const month = num(o.month ?? o.Month ?? o.TimePeriodMonth);
    const base = o.currBase;
    const value = num(o.value ?? o.Value ?? (base && typeof base === "object" ? (base as { value?: unknown }).value : base));
    if (year && month && month >= 1 && month <= 12 && value !== null) {
      out.push({ month: `${year}-${String(month).padStart(2, "0")}-01`, value });
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") visit(v);
  };
  visit(json);
  const uniq = new Map<string, number>();
  for (const m of out) uniq.set(m.month, m.value);
  return [...uniq.entries()].map(([month, value]) => ({ month, value })).sort((a, b) => (a.month < b.month ? -1 : 1));
}
