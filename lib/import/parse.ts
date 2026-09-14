import "server-only";
import ExcelJS from "exceljs";
import type { ImportColumn, ImportEntity } from "./spec";

export interface ParsedRow {
  rowNumber: number;
  values: Record<string, unknown>;
  errors: string[];
}

const TRUE = new Set(["1", "true", "yes", "y", "כן", "on", "x", "✔"]);
const FALSE = new Set(["0", "false", "no", "n", "לא", "off", ""]);

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("hyperlink" in v) return String((v as { text?: string }).text ?? "");
    return String(v);
  }
  return String(v).trim();
}

export function coerce(col: ImportColumn, raw: string): { value: unknown; error?: string } {
  const s = raw.trim();
  if (s === "") return { value: null };
  switch (col.type) {
    case "text":
      return { value: s };
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? { value: s.toLowerCase() } : { value: null, error: "invalid_email" };
    case "number":
    case "money":
    case "pct": {
      const n = Number(s.replace(/[,₪\s%]/g, ""));
      if (Number.isNaN(n)) return { value: null, error: "invalid_number" };
      if (col.type === "pct" && (n < 0 || n > 100)) return { value: null, error: "pct_out_of_range" };
      return { value: n };
    }
    case "date": {
      let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
      if (m) return { value: `${m[1]}-${m[2]}-${m[3]}` };
      m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
      if (m) return { value: `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}` };
      return { value: null, error: "invalid_date" };
    }
    case "month": {
      let m = /^(\d{4})-(\d{2})/.exec(s);
      if (m) return { value: `${m[1]}-${m[2]}-01` };
      m = /^(\d{1,2})[./](\d{4})$/.exec(s);
      if (m) return { value: `${m[2]}-${m[1]!.padStart(2, "0")}-01` };
      return { value: null, error: "invalid_month" };
    }
    case "time":
      return /^([01]?\d|2[0-3]):[0-5]\d/.test(s) ? { value: s.slice(0, 5).padStart(5, "0") } : { value: null, error: "invalid_time" };
    case "bool": {
      const l = s.toLowerCase();
      if (TRUE.has(l)) return { value: true };
      if (FALSE.has(l)) return { value: false };
      return { value: null, error: "invalid_bool" };
    }
    case "enum":
      return col.enum!.includes(s) ? { value: s } : { value: null, error: `invalid_enum:${col.enum!.join("|")}` };
  }
}

/** Parse the first sheet: header row = column keys (or labels), then data rows. */
export async function parseWorkbook(entity: ImportEntity, bytes: Buffer): Promise<{ rows: ParsedRow[]; unknownColumns: string[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return { rows: [], unknownColumns: [] };
  const header = ws.getRow(1);
  const map = new Map<number, ImportColumn>();
  const unknown: string[] = [];
  header.eachCell((cell, i) => {
    const h = cellText(cell.value).replace(/\*$/, "").trim();
    const col = entity.columns.find((c) => c.key === h || c.label === h);
    if (col) map.set(i, col);
    else if (h) unknown.push(h);
  });
  const rows: ParsedRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, unknown> = {};
    const errors: string[] = [];
    let empty = true;
    for (const [i, col] of map) {
      const raw = cellText(row.getCell(i).value);
      if (raw !== "") empty = false;
      const { value, error } = coerce(col, raw);
      if (error) errors.push(`${col.key}: ${error}`);
      values[col.key] = value;
    }
    if (empty) return;
    if (rowNumber === 2 && Object.values(values).every((v) => v === null || typeof v === "string") && Object.entries(values).some(([k, v]) => entity.columns.find((c) => c.key === k)?.note && v === entity.columns.find((c) => c.key === k)?.note)) return;
    for (const c of entity.columns) if (c.required && (values[c.key] === null || values[c.key] === undefined)) errors.push(`${c.key}: required`);
    rows.push({ rowNumber, values, errors });
  });
  // duplicate natural keys inside the file
  if (entity.naturalKey.length) {
    const seen = new Map<string, number>();
    for (const r of rows) {
      const k = entity.naturalKey.map((c) => String(r.values[c] ?? "")).join("|");
      const prev = seen.get(k);
      if (prev) r.errors.push(`duplicate_in_file:row ${prev}`);
      else seen.set(k, r.rowNumber);
    }
  }
  return { rows, unknownColumns: unknown };
}
