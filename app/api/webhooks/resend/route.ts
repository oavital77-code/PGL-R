import { Webhook } from "svix";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailLog } from "@/lib/db/schema";
import { adminUserIds, notify } from "@/lib/notifications/service";

const STATUS: Record<string, "delivered" | "opened" | "bounced" | "failed" | "sent"> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.bounced": "bounced",
  "email.delivery_delayed": "sent",
  "email.complained": "bounced",
  "email.failed": "failed",
};

/** Resend webhooks (delivered / opened / bounced) → email_log + bounce notification (spec §13.2). */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("webhook not configured", { status: 500 });
  const payload = await req.text();
  let evt: { type: string; data: { email_id: string; [k: string]: unknown } };
  try {
    evt = new Webhook(secret).verify(payload, {
      "svix-id": req.headers.get("svix-id") ?? "",
      "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
      "svix-signature": req.headers.get("svix-signature") ?? "",
    }) as unknown as typeof evt;
  } catch {
    return new Response("invalid signature", { status: 400 });
  }
  const status = STATUS[evt.type];
  const [row] = await db.select({ id: emailLog.id, relatedEntityType: emailLog.relatedEntityType, relatedEntityId: emailLog.relatedEntityId, subject: emailLog.subject }).from(emailLog).where(eq(emailLog.resendMessageId, evt.data.email_id)).limit(1);
  if (!row) return Response.json({ ok: true, unknown: true });
  await db
    .update(emailLog)
    .set({ ...(status ? { status } : {}), events: sql`${emailLog.events} || ${JSON.stringify([{ type: evt.type, at: new Date().toISOString() }])}::jsonb` })
    .where(eq(emailLog.id, row.id));
  if ((status === "bounced" || status === "failed") && row.relatedEntityType === "invoice" && row.relatedEntityId) {
    const admins = await adminUserIds();
    await notify({ userIds: admins, type: "invoice.email_failed", title: row.subject, body: evt.type, link: `/invoices/${row.relatedEntityId}`, dedupeKey: `email_failed:${row.id}` });
  }
  return Response.json({ ok: true });
}
