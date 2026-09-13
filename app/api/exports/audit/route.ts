import ExcelJS from "exceljs";
import { getCurrentUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/authorize";
import { diffRecord, queryAudit } from "@/lib/audit/query";

export const dynamic = "force-dynamic";

/** xlsx export of the audit log with the same filters as the screen (spec §14). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "audit.view")) return new Response("forbidden", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const rows = await queryAudit({
    table: sp.get("table") || undefined,
    recordId: sp.get("recordId") || undefined,
    userId: sp.get("userId") || undefined,
    action: (sp.get("action") as "insert" | "update" | "delete") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    limit: 10_000,
  });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("audit", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "זמן", key: "time", width: 20 },
    { header: "משתמש", key: "user", width: 20 },
    { header: "טבלה", key: "table", width: 22 },
    { header: "מזהה", key: "record", width: 38 },
    { header: "פעולה", key: "action", width: 10 },
    { header: "שינויים", key: "diff", width: 80 },
  ];
  for (const { a, userName } of rows) {
    const diff = a.action === "update" ? diffRecord(a.before, a.after).map((d) => `${d.field}: ${JSON.stringify(d.before)} → ${JSON.stringify(d.after)}`).join("\n") : JSON.stringify(a.action === "delete" ? a.before : a.after);
    ws.addRow({ time: a.changedAt, user: userName ?? "system", table: a.tableName, record: a.recordId, action: a.action, diff });
  }
  ws.getRow(1).font = { bold: true };
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="audit.xlsx"` },
  });
}
