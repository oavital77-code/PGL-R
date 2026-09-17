import type { ReportColumn } from "./types";

/** "invoices.status" → { "invoices.status.paid": "שולם", … } for every namespace the report uses. */
export function flattenEnums(messages: Record<string, unknown>, columns: ReportColumn[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const ns of new Set(columns.map((c) => c.enumKey).filter((k): k is string => Boolean(k)))) {
    let cur: unknown = messages;
    for (const part of ns.split(".")) {
      if (typeof cur !== "object" || cur === null) break;
      cur = (cur as Record<string, unknown>)[part];
    }
    if (typeof cur !== "object" || cur === null) continue;
    for (const [k, v] of Object.entries(cur as Record<string, unknown>)) if (typeof v === "string") out[`${ns}.${k}`] = v;
  }
  return out;
}
