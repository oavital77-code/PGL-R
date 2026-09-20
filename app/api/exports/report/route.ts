import { getCurrentUser } from "@/lib/auth/current-user";
import { runReport } from "@/lib/reports/run";
import { flattenEnums, reportToPdf, reportToXlsx } from "@/lib/reports/export";
import { reportTitle } from "@/lib/reports/labels";
import { uploadGenerated } from "@/lib/storage";
import he from "@/messages/he.json";
import en from "@/messages/en.json";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST { key, params, visible, format, chartPng? } → file (also stored in report-exports for 30 days, spec §12.5). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthenticated", { status: 401 });
  const body = (await req.json()) as { key: string; params: Record<string, unknown>; visible: string[]; format: "xlsx" | "pdf"; chartPng?: string; filters?: string };
  const msgs = (user.locale === "en" ? en : he) as unknown as { reports: { names: Record<string, Record<string, string>>; columns: Record<string, string>; generated_at: string; total: string } };
  let res;
  try {
    res = await runReport(body.key, body.params, user);
  } catch {
    return new Response("forbidden", { status: 403 });
  }
  const enums = flattenEnums(msgs as unknown as Record<string, unknown>, res.columns);
  const labels = { title: reportTitle(msgs.reports.names, body.key), columns: msgs.reports.columns, enums, filters: body.filters ?? "", generatedAt: `${msgs.reports.generated_at} ${new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`, total: msgs.reports.total };
  const bytes = body.format === "pdf" ? await reportToPdf(res, body.visible, labels, body.chartPng) : await reportToXlsx(res, body.visible, labels);
  const mime = body.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const fileName = `${body.key.replace(/\./g, "_")}_${new Date().toISOString().slice(0, 10)}.${body.format}`;
  try {
    await uploadGenerated({ bucket: "report-exports", entityType: "report_export", entityId: user.id, fileName, mime, bytes, userId: user.id });
  } catch {
    /* storage not configured – still return the file */
  }
  return new Response(new Uint8Array(bytes), { headers: { "content-type": mime, "content-disposition": `attachment; filename="${encodeURIComponent(fileName)}"` } });
}
