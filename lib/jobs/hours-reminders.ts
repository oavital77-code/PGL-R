import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { departments, notifications, subContractAssignments, timeEntries, users } from "@/lib/db/schema";
import { todayLocal } from "@/lib/i18n/format";
import { getSetting } from "@/lib/settings/service";
import { sendEmail } from "@/lib/email/send";
import { renderTemplate } from "@/lib/email/templates";
import { notify } from "@/lib/notifications/service";
import { daysBetween } from "@/lib/calc/invoice";

/** Daily reminders to employees who have not reported (spec §10.8). */
export async function hoursRemindersJob() {
  const today = todayLocal();
  const [hours, email, company] = await Promise.all([getSetting("hours"), getSetting("email"), getSetting("company")]);
  const emps = await db
    .select({ id: users.id, email: users.email, first: users.firstName, last: users.lastName, departmentId: users.departmentId, start: users.employmentStart })
    .from(users)
    .where(and(eq(users.isActive, true), isNull(users.deletedAt)));
  const assigned = new Set((await db.select({ u: subContractAssignments.userId }).from(subContractAssignments).where(eq(subContractAssignments.isActive, true))).map((a) => a.u));
  const last = await db.select({ userId: timeEntries.userId, last: sql<string>`max(${timeEntries.workDate})` }).from(timeEntries).where(isNull(timeEntries.deletedAt)).groupBy(timeEntries.userId);
  const lastMap = new Map(last.map((l) => [l.userId, l.last]));
  const lastReminder = await db
    .select({ userId: notifications.userId, at: sql<string>`max(${notifications.createdAt})` })
    .from(notifications)
    .where(and(eq(notifications.type, "hours.reminder"), inArray(notifications.userId, emps.map((e) => e.id))))
    .groupBy(notifications.userId);
  const remMap = new Map(lastReminder.map((r) => [r.userId, r.at]));
  const mgrs = await db.select({ id: departments.id, managerId: departments.managerUserId }).from(departments);
  const mgrByDept = new Map(mgrs.map((m) => [m.id, m.managerId]));
  const mgrEmails = new Map(emps.map((e) => [e.id, e.email]));

  let sent = 0;
  for (const e of emps) {
    if (!assigned.has(e.id)) continue;
    const l = lastMap.get(e.id);
    const gap = l ? daysBetween(l, today) : daysBetween(e.start ?? today, today) + 1;
    if (gap <= hours.reminder_days) continue;
    const lastRem = remMap.get(e.id);
    if (lastRem && daysBetween(String(lastRem).slice(0, 10), today) < hours.reminder_repeat_days) continue;
    const vars = { contact_first_name: e.first, company_name: company.name, sender_name: email.from_name };
    const cc: string[] = [];
    if (hours.notify_department_manager && e.departmentId) {
      const m = mgrByDept.get(e.departmentId);
      const mEmail = m ? mgrEmails.get(m) : undefined;
      if (mEmail && mEmail !== e.email) cc.push(mEmail);
    }
    await sendEmail({ to: [{ email: e.email, name: `${e.first} ${e.last}` }], cc, subject: renderTemplate(email.templates.hours_reminder.subject, vars), text: renderTemplate(email.templates.hours_reminder.body, vars), relatedEntityType: "user", relatedEntityId: e.id });
    await notify({ userIds: [e.id], type: "hours.reminder", title: "תזכורת: דיווח שעות חסר", body: l ? `דיווח אחרון: ${l}` : "לא נמצא דיווח", link: "/hours" });
    sent++;
  }
  return { sent };
}
