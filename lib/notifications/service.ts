import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";

export type NotificationType =
  | "invoice.pending_approval"
  | "invoice.approved"
  | "invoice.rejected"
  | "invoice.signed"
  | "invoice.sent"
  | "invoice.email_failed"
  | "invoice.overdue"
  | "invoice.retainer_draft"
  | "invoice.cancelled"
  | "hours.reminder"
  | "hours.month_locked"
  | "hours.period_unlocked"
  | "hours.reported_for_you"
  | "contract.progress"
  | "supplier.over_budget"
  | "supplier.progress_vs_client"
  | "supplier_invoice.pending_approval"
  | "supplier_invoice.decided"
  | "index.fetch_failed"
  | "index.missing"
  | "note.mention"
  | "report.schedule_failed"
  | "backup.failed"
  | "system";

export interface NotifyInput {
  userIds: string[];
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  /** when set, a notification with the same dedupe key for the same user is not created twice */
  dedupeKey?: string;
}

/** Create in-app notifications (e-mail delivery is decided by the caller via lib/email). */
export async function notify(input: NotifyInput, tx: Tx | typeof db = db): Promise<string[]> {
  const targets = [...new Set(input.userIds)];
  if (targets.length === 0) return [];
  let toCreate = targets;
  if (input.dedupeKey) {
    const existing = await tx
      .select({ userId: notifications.userId })
      .from(notifications)
      .where(and(eq(notifications.dedupeKey, input.dedupeKey), inArray(notifications.userId, targets)));
    const done = new Set(existing.map((e) => e.userId));
    toCreate = targets.filter((u) => !done.has(u));
  }
  if (toCreate.length === 0) return [];
  const rows = await tx
    .insert(notifications)
    .values(toCreate.map((userId) => ({ userId, type: input.type, title: input.title, body: input.body, link: input.link, dedupeKey: input.dedupeKey })))
    .returning({ id: notifications.id });
  return rows.map((r) => r.id);
}

export async function unreadCount(userId: string): Promise<number> {
  const r = await db
    .select({ c: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return Number(r[0]?.c ?? 0);
}

export async function listRecent(userId: string, limit = 20) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function markRead(userId: string, ids: string[] | "all") {
  const where = ids === "all" ? eq(notifications.userId, userId) : and(eq(notifications.userId, userId), inArray(notifications.id, ids));
  await db.update(notifications).set({ isRead: true }).where(where);
}

export async function adminUserIds(): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users).where(and(eq(users.role, "admin"), eq(users.isActive, true)));
  return rows.map((r) => r.id);
}
