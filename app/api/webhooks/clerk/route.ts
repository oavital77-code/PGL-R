import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

interface ClerkEmail {
  id: string;
  email_address: string;
}
interface ClerkUserPayload {
  id: string;
  email_addresses: ClerkEmail[];
  primary_email_address_id: string | null;
  first_name: string | null;
  last_name: string | null;
  two_factor_enabled?: boolean;
}

/** Clerk → users sync (spec §2.3). Users are created only by admins; the webhook links/updates rows. */
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) return new Response("webhook not configured", { status: 500 });
  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };
  let evt: { type: string; data: ClerkUserPayload };
  try {
    evt = new Webhook(secret).verify(payload, headers) as unknown as typeof evt;
  } catch {
    return new Response("invalid signature", { status: 400 });
  }
  const d = evt.data;
  const primary = d.email_addresses?.find((e) => e.id === d.primary_email_address_id)?.email_address ?? d.email_addresses?.[0]?.email_address;
  const email = primary?.toLowerCase();

  if (evt.type === "user.created" || evt.type === "user.updated") {
    if (!email) return Response.json({ ok: true, skipped: "no_email" });
    const byClerk = await db.select({ id: users.id }).from(users).where(eq(users.clerkUserId, d.id)).limit(1);
    if (byClerk[0]) {
      await db.update(users).set({ email, firstName: d.first_name ?? undefined, lastName: d.last_name ?? undefined }).where(eq(users.id, byClerk[0].id));
      return Response.json({ ok: true, linked: byClerk[0].id });
    }
    const byEmail = await db.select({ id: users.id, clerkUserId: users.clerkUserId }).from(users).where(eq(users.email, email)).limit(1);
    if (byEmail[0] && !byEmail[0].clerkUserId) {
      await db.update(users).set({ clerkUserId: d.id }).where(eq(users.id, byEmail[0].id));
      return Response.json({ ok: true, linked: byEmail[0].id });
    }
    // Unknown user (should not happen – public sign-up is disabled): ignore, the app shows /no-account.
    return Response.json({ ok: true, ignored: true });
  }
  if (evt.type === "user.deleted") {
    await db.update(users).set({ isActive: false, deletedAt: new Date() }).where(eq(users.clerkUserId, d.id));
    return Response.json({ ok: true });
  }
  return Response.json({ ok: true, unhandled: evt.type });
}
