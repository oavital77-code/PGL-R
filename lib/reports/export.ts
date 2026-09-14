import "server-only";
import ExcelJS from "exceljs";
import type { ReportResult } from "./types";
import { htmlToPdf, fontDataUri } from "@/lib/pdf/render";
import { formatDate, formatMoney, formatPct } from "@/lib/i18n/format";
import { getSetting } from "@/lib/settings/service";

export interface ExportLabels {
  title: string;
  columns: Record<string, string>;
  filters: string;
  generatedAt: string;
  total: string;
}

function fmtCell(type: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  switch (type) {
    case "money":
      return formatMoney(Number(v), { symbol: false });
    case "pct":
      return formatPct(Number(v), 1);
    case "hours":
    case "number":
      return typeof v === "number" ? String(Math.round(v * 100) / 100) : String(v);
    case "date":
      return formatDate(String(v));
    default:
      return String(v);
  }
}

/** xlsx export (spec §12.1): headers, frozen row, number formats, totals row, RTL sheet. */
export async function reportToXlsx(res: ReportResult, visible: string[], labels: ExportLabels): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(labels.title.slice(0, 30), { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  const cols = res.columns.filter((c) => visible.includes(c.key));
  ws.columns = cols.map((c) => ({ header: labels.columns[c.label] ?? c.label, key: c.key, width: c.type === "text" ? 32 : 14 }));
  for (const r of res.rows) {
    const row = ws.addRow(Object.fromEntries(cols.map((c) => [c.key, c.type === "date" ? (r.cells[c.key] ? formatDate(String(r.cells[c.key])) : "") : (r.cells[c.key] ?? null)])));
    if (r.level > 0) row.getCell(1).alignment = { indent: r.level };
    if (r.level === 0 && res.rows.some((x) => x.parentId === r.id)) row.font = { bold: true };
  }
  for (const c of cols) {
    if (c.type === "money") ws.getColumn(c.key).numFmt = "#,##0.00";
    if (c.type === "pct") ws.getColumn(c.key).numFmt = '0.0"%"';
    if (c.type === "hours") ws.getColumn(c.key).numFmt = "0.00";
  }
  if (res.totals) {
    const total = ws.addRow(Object.fromEntries(cols.map((c, i) => [c.key, i === 0 ? labels.total : (res.totals![c.key] ?? null)])));
    total.font = { bold: true };
  }
  ws.getRow(1).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** PDF export – RTL report page with logo, title, applied filters, generation date and optional chart image. */
export async function reportToPdf(res: ReportResult, visible: string[], labels: ExportLabels, chartPng?: string): Promise<Buffer> {
  const company = await getSetting("company");
  const cols = res.columns.filter((c) => visible.includes(c.key));
  const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:"Assistant";src:url("${fontDataUri()}") format("truetype");font-weight:200 800}
@page{size:A4 landscape;margin:12mm}body{font-family:"Assistant",Arial,sans-serif;font-size:9pt;color:#111;margin:0}
h1{font-size:16pt;color:#2a3380;margin:0 0 4px}.meta{color:#555;font-size:8.5pt;margin-bottom:8px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:3px 5px;text-align:right}th{background:#eef0fb}td.n{direction:ltr;text-align:left;font-variant-numeric:tabular-nums}
tr.l0 td{font-weight:700;background:#f6f7fb}tr.total td{font-weight:800;background:#eef0fb}.warn{color:#b45309}
</style></head><body><h1>${esc(labels.title)}</h1><div class="meta">${esc(company.name)} · ${esc(labels.generatedAt)}${labels.filters ? ` · ${esc(labels.filters)}` : ""}</div>
${chartPng ? `<img src="${chartPng}" style="max-width:100%;max-height:220px;margin-bottom:8px">` : ""}
<table><thead><tr>${cols.map((c) => `<th>${esc(labels.columns[c.label] ?? c.label)}</th>`).join("")}</tr></thead><tbody>
${res.rows.map((r) => `<tr class="l${r.level}">${cols.map((c, i) => `<td class="${c.type === "text" ? "" : "n"}" ${i === 0 ? `style="padding-inline-start:${4 + r.level * 12}px"` : ""}>${esc(fmtCell(c.type, r.cells[c.key]))}${i === 0 && r.warnings?.length ? ` <span class="warn">⚠</span>` : ""}</td>`).join("")}</tr>`).join("")}
${res.totals ? `<tr class="total">${cols.map((c, i) => `<td class="${c.type === "text" ? "" : "n"}">${i === 0 ? esc(labels.total) : esc(fmtCell(c.type, res.totals![c.key]))}</td>`).join("")}</tr>` : ""}
</tbody></table></body></html>`;
  return htmlToPdf(html);
}
