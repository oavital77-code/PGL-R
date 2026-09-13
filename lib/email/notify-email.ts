import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { notify, type NotifyInput } from "@/lib/notifications/service";
import { getSetting } from "@/lib/settings/service";
import { sendEmail } from "./send";

/**
 * Notify through the channels configured for the event (spec §13.1):
 * in-app rows + e-mail to the users' addresses when enabled.
 */
export async function notifyEvent(input: NotifyInput & { emailSubject?: string; emailText?: string }) {
  const settings = await getSetting("notifications");
  const def = NOTIFICATION_EVENTS.find((e) => e.type === input.type) ?? { in_app: true, email: false };
  const ch = settings.channels[input.type] ?? def;
  const ids = ch.in_app ? await notify(input) : [];
  if (ch.email && input.userIds.length > 0) {
    const rows = await db.select({ id: users.id, email: users.email, name: users.firstName }).from(users).where(inArray(users.id, [...new Set(input.userIds)]));
    if (rows.length > 0) {
      const base = process.env.APP_BASE_URL ?? "";
      const text = `${input.emailText ?? input.body ?? input.title}${input.link ? `\n\n${base}${input.link}` : ""}`;
      await sendEmail({ to: rows.map((r) => ({ email: r.email, name: r.name })), subject: input.emailSubject ?? input.title, text, relatedEntityType: "notification", relatedEntityId: ids[0] });
    }
  }
  return ids;
}
