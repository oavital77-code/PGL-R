import "server-only";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { emailLog } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings/service";
import { textToHtml } from "./templates";

export interface SendEmailInput {
  to: { email: string; name?: string }[];
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer }[];
  relatedEntityType?: string;
  relatedEntityId?: string;
  replyTo?: string;
}

function resend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

/** Send through Resend and record in email_log (spec §2.1, §5.6). Never throws on provider failure – returns status. */
export async function sendEmail(input: SendEmailInput): Promise<{ id: string; status: "sent" | "failed"; messageId?: string; error?: string }> {
  const settings = await getSetting("email");
  const toAddresses = input.to.map((t) => t.email);
  const [log] = await db
    .insert(emailLog)
    .values({ toAddresses, ccAddresses: input.cc ?? [], subject: input.subject, relatedEntityType: input.relatedEntityType, relatedEntityId: input.relatedEntityId, status: "queued" })
    .returning({ id: emailLog.id });
  const logId = log!.id;
  const client = resend();
  if (!client || !settings.from_address) {
    const error = "email_not_configured";
    await db.update(emailLog).set({ status: "failed", error }).where(eq(emailLog.id, logId));
    return { id: logId, status: "failed", error };
  }
  try {
    const { data, error } = await client.emails.send({
      from: `${settings.from_name} <${settings.from_address}>`,
      to: input.to.map((t) => (t.name ? `${t.name} <${t.email}>` : t.email)),
      cc: input.cc?.length ? input.cc : undefined,
      replyTo: input.replyTo ?? settings.reply_to ?? undefined,
      subject: input.subject,
      text: input.text,
      html: input.html ?? textToHtml(input.text),
      attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
      headers: { "X-Entity-Ref-ID": logId },
    });
    if (error || !data) {
      await db.update(emailLog).set({ status: "failed", error: error?.message ?? "unknown" }).where(eq(emailLog.id, logId));
      return { id: logId, status: "failed", error: error?.message };
    }
    await db.update(emailLog).set({ status: "sent", resendMessageId: data.id }).where(eq(emailLog.id, logId));
    return { id: logId, status: "sent", messageId: data.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(emailLog).set({ status: "failed", error: msg }).where(eq(emailLog.id, logId));
    return { id: logId, status: "failed", error: msg };
  }
}
