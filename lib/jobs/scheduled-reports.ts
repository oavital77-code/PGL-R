import "server-only";
import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { reportSchedules, reportTemplates, users } from "@/lib/db/schema";
import { runReport } from "@/lib/reports/run";
import { reportToPdf, reportToXlsx } from "@/lib/reports/export";
import { computeNextRun } from "@/lib/reports/schedule";
import { sendEmail } from "@/lib/email/send";
import { renderTemplate } from "@/lib/email/templates";
import { notifyEvent } from "@/lib/email/notify-email";
import { getSetting } from "@/lib/settings/service";
import { getCurrentUserForJob } from "@/lib/auth/job-user";
import he from "@/messages/he.json";

/** Hourly: run due schedules, e-mail the file, advance next_run_at (spec §12.6). */
export async function scheduledReportsJob() {
  const due = await db
    .select({ s: reportSchedules, t: reportTemplates })
    .from(reportSchedules)
    .innerJoin(reportTemplates, eq(reportTemplates.id, reportSchedules.templateId))
    .where(and(eq(reportSchedules.isActive, true), lte(reportSchedules.nextRunAt, new Date())));
  const [email, company] = await Promise.all([getSetting("email"), getSetting("company")]);
  const msgs = he as unknown as { reports: { names: Record<string, string>; columns: Record<string, string>; generated_at: string; total: string } };
  let ok = 0;
  for (const { s, t } of due) {
    try {
      const [owner] = await db.select().from(users).where(eq(users.id, t.ownerUserId));
      if (!owner) throw new Error("owner missing");
      const user = await getCurrentUserForJob(owner.id);
      const cfg = t.config as { params?: Record<string, unknown>; visible?: string[] };
      const res = await runReport(t.reportType, cfg.params ?? {}, user);
      const labels = { title: t.name, columns: msgs.reports.columns, filters: "", generatedAt: `${msgs.reports.generated_at} ${new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`, total: msgs.reports.total };
      const visible = cfg.visible ?? res.columns.filter((c) => !c.hidden).map((c) => c.key);
      const bytes = s.format === "pdf" ? await reportToPdf(res, visible, labels) : await reportToXlsx(res, visible, labels);
      const vars = { report_name: t.name, date: new Date().toLocaleDateString("he-IL"), company_name: company.name, sender_name: email.from_name };
      const r = await sendEmail({ to: s.recipients.map((e) => ({ email: e })), subject: renderTemplate(email.templates.scheduled_report.subject, vars), text: renderTemplate(email.templates.scheduled_report.body, vars), attachments: [{ filename: `${t.name}.${s.format}`, content: bytes }], relatedEntityType: "report_schedule", relatedEntityId: s.id });
      if (r.status === "failed") throw new Error(r.error);
      await db.update(reportSchedules).set({ lastRunAt: new Date(), nextRunAt: computeNextRun(s), lastError: null }).where(eq(reportSchedules.id, s.id));
      ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.update(reportSchedules).set({ lastRunAt: new Date(), nextRunAt: computeNextRun(s), lastError: msg }).where(eq(reportSchedules.id, s.id));
      await notifyEvent({ userIds: [t.ownerUserId], type: "report.schedule_failed", title: `דוח מתוזמן "${t.name}" נכשל`, body: msg, link: "/reports" });
    }
  }
  return { due: due.length, ok };
}
