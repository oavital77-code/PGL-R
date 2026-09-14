import "server-only";
import { and, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { daysBetween } from "@/lib/calc/invoice";
import { todayLocal } from "@/lib/i18n/format";
import { getSetting } from "@/lib/settings/service";
import { adminUserIds } from "@/lib/notifications/service";
import { notifyEvent } from "@/lib/email/notify-email";

/** Overdue alerts at each aging threshold, once per threshold (spec §11.12). */
export async function invoiceAgingJob() {
  const today = todayLocal();
  const settings = await getSetting("invoices");
  const rows = await db.select({ id: invoices.id, number: invoices.invoiceNumber, dueDate: invoices.dueDate, total: invoices.total }).from(invoices).where(and(inArray(invoices.status, ["sent", "partially_paid"]), isNull(invoices.deletedAt)));
  const admins = await adminUserIds();
  let sent = 0;
  for (const inv of rows) {
    if (!inv.dueDate) continue;
    const days = daysBetween(inv.dueDate, today);
    const crossed = [...settings.aging_thresholds].sort((a, b) => b - a).find((t) => days >= t);
    if (!crossed) continue;
    const ids = await notifyEvent({ userIds: admins, type: "invoice.overdue", title: `חשבון ${inv.number} באיחור של ${days} ימים`, body: `סף ${crossed} ימים · ${inv.total} ₪`, link: `/invoices/${inv.id}`, dedupeKey: `invoice.overdue:${inv.id}:${crossed}` });
    if (ids.length) sent++;
  }
  return { checked: rows.length, alerts: sent };
}
