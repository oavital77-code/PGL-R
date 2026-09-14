import "server-only";
import ExcelJS from "exceljs";
import type { ImportEntity } from "./spec";

/** xlsx template: header (keys), label row, example row, data validation for enums (spec §15.1). */
export async function buildTemplate(entity: ImportEntity): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(entity.key, { views: [{ rightToLeft: true, state: "frozen", ySplit: 2 }] });
  ws.columns = entity.columns.map((c) => ({ header: c.key + (c.required ? "*" : ""), key: c.key, width: Math.max(14, Math.min(40, c.label.length + 4)) }));
  ws.addRow(Object.fromEntries(entity.columns.map((c) => [c.key, c.label + (c.note ? ` (${c.note})` : "")])));
  ws.addRow(Object.fromEntries(entity.columns.map((c) => [c.key, c.example ?? (c.type === "date" ? "31/12/2025" : c.type === "month" ? "01/2025" : c.type === "bool" ? "כן" : c.enum ? c.enum[0] : "")])));
  ws.getRow(1).font = { bold: true };
  ws.getRow(2).font = { italic: true, color: { argb: "FF6B7280" } };
  ws.getRow(3).font = { color: { argb: "FF9CA3AF" } };
  entity.columns.forEach((c, i) => {
    if (c.enum) {
      for (let r = 3; r <= 1000; r++) ws.getCell(r, i + 1).dataValidation = { type: "list", allowBlank: true, formulae: [`"${c.enum.join(",")}"`] };
    }
  });
  const notes = wb.addWorksheet("הוראות", { views: [{ rightToLeft: true }] });
  notes.addRow(["שורה 1 – מפתחות העמודות (אין לשנות). שורה 2 – תיאור. שורה 3 – דוגמה (למחוק לפני ייבוא)."]);
  notes.addRow(["עמודות עם * הן חובה. תאריכים: dd/mm/yyyy. חודשים: mm/yyyy. כן/לא: כן, לא, 1, 0."]);
  notes.addRow([`ישות: ${entity.label}. סדר ייבוא: ${entity.order}.`]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Error report xlsx for a failed batch. */
export async function buildErrorReport(rows: { rowNumber: number; errors: string[]; values: Record<string, unknown> }[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("errors", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ws.columns = [{ header: "שורה", key: "row", width: 8 }, { header: "שגיאות", key: "errors", width: 80 }, { header: "נתונים", key: "data", width: 100 }];
  for (const r of rows) ws.addRow({ row: r.rowNumber, errors: r.errors.join(" | "), data: JSON.stringify(r.values) });
  ws.getRow(1).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
