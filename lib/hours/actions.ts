"use server";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can, requireUser } from "@/lib/auth/authorize";
import { AuthError, BusinessRuleError, NotFoundError, ValidationError } from "@/lib/auth/errors";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { db } from "@/lib/db";
import { periodUnlocks, subContractAssignments, timeEntries, users } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { isFutureDate } from "@/lib/calc/period-lock";
import { parseHHMM, todayLocal } from "@/lib/i18n/format";
import { getSetting } from "@/lib/settings/service";
import { notifyEvent } from "@/lib/email/notify-email";
import { optionalUuid } from "@/lib/utils/zod";
import { activeUnlocks, isLockedFor } from "./queries";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const entrySchema = z.object({
  id: optionalUuid,
  userId: z.uuid(),
  subContractId: z.uuid(),
  workDate: z.iso.date(),
  startTime: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().regex(timeRe).nullable()),
  endTime: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().regex(timeRe).nullable()),
  duration: z.preprocess((v) => (v === "" || v == null ? null : v), z.string().nullable()),
  description: z.string().trim().min(3, "hours.description_min").max(2000),
});

async function authorizeTarget(targetUserId: string, mode: "report" | "view") {
  const me = await requireUser();
  if (targetUserId === me.id) {
    if (!can(me, "hours.report_own")) throw new AuthError("FORBIDDEN");
    return me;
  }
  const [t] = await db.select({ departmentId: users.departmentId, isActive: users.isActive }).from(users).where(eq(users.id, targetUserId));
  if (!t) throw new NotFoundError("user");
  const cap = mode === "report" ? "hours.report_for_others" : "hours.view_others";
  if (!can(me, cap, { targetUserId, targetDepartmentId: t.departmentId })) throw new AuthError("FORBIDDEN");
  return me;
}

function minutesFrom(start: string | null, end: string | null, duration: string | null): number {
  if (start && end) {
    const s = parseHHMM(start)!;
    const e = parseHHMM(end)!;
    const m = e - s;
    if (m <= 0) throw new ValidationError("hours.end_before_start", { endTime: ["hours.end_before_start"] });
    return m;
  }
  if (!duration) throw new ValidationError("hours.duration_required", { duration: ["hours.duration_required"] });
  const m = parseHHMM(duration);
  if (m === null || m <= 0) throw new ValidationError("hours.duration_invalid", { duration: ["hours.duration_invalid"] });
  return m;
}

/** Create / update a time entry (spec §10.1, §10.3, §10.5). */
export async function saveTimeEntryAction(fd: FormData): Promise<ActionResult<{ id: string; dayMinutes: number; overStandard: boolean }>> {
  return runAction(async () => {
    const raw: Record<string, unknown> = {};
    for (const [k, v] of fd.entries()) raw[k] = v;
    const d = entrySchema.parse(raw);
    const me = await authorizeTarget(d.userId, "report");
    const settings = await getSetting("hours");
    const today = todayLocal();
    if (!settings.allow_future_dates && isFutureDate(d.workDate, today)) throw new ValidationError("hours.future_not_allowed", { workDate: ["hours.future_not_allowed"] });
    const minutes = minutesFrom(d.startTime, d.endTime, d.duration);
    if (minutes > 1440) throw new ValidationError("hours.over_day", { duration: ["hours.over_day"] });

    // assignment (spec §10.1)
    const [asg] = await db.select({ id: subContractAssignments.id }).from(subContractAssignments).where(and(eq(subContractAssignments.subContractId, d.subContractId), eq(subContractAssignments.userId, d.userId), eq(subContractAssignments.isActive, true)));
    if (!asg) throw new BusinessRuleError("hours.not_assigned");

    // lock (spec §10.7) – admins may always edit locked periods
    if (!can(me, "hours.edit_locked") && (await isLockedFor(d.userId, d.workDate))) throw new BusinessRuleError("hours.period_locked");

    let existing: typeof timeEntries.$inferSelect | undefined;
    if (d.id) {
      [existing] = await db.select().from(timeEntries).where(and(eq(timeEntries.id, d.id), isNull(timeEntries.deletedAt)));
      if (!existing) throw new NotFoundError("time_entry");
      if (existing.userId !== d.userId) throw new AuthError("FORBIDDEN");
      if (existing.invoiceId) throw new BusinessRuleError("hours.already_invoiced");
      if (!can(me, "hours.edit_locked") && (await isLockedFor(d.userId, existing.workDate))) throw new BusinessRuleError("hours.period_locked");
    }

    // day cap (spec §10.1): Σ minutes ≤ max_minutes_per_day
    const [sum] = await db
      .select({ m: sql<number>`coalesce(sum(${timeEntries.minutes}),0)` })
      .from(timeEntries)
      .where(and(eq(timeEntries.userId, d.userId), eq(timeEntries.workDate, d.workDate), isNull(timeEntries.deletedAt), d.id ? ne(timeEntries.id, d.id) : undefined));
    const dayMinutes = Number(sum?.m ?? 0) + minutes;
    if (dayMinutes > settings.max_minutes_per_day) throw new ValidationError("hours.day_cap", { duration: ["hours.day_cap"] });

    const [u] = await db.select({ std: users.standardHoursPerDay }).from(users).where(eq(users.id, d.userId));
    const stdMinutes = Math.round(Number(u?.std ?? settings.default_standard_hours_per_day) * 60);

    const id = await withUser({ userId: me.id }, async (tx) => {
      const values = { subContractId: d.subContractId, workDate: d.workDate, minutes, startTime: d.startTime, endTime: d.endTime, description: d.description };
      if (existing) {
        await tx.update(timeEntries).set(values).where(eq(timeEntries.id, existing.id));
        return existing.id;
      }
      const [row] = await tx.insert(timeEntries).values({ ...values, userId: d.userId, reportedByUserId: me.id, createdBy: me.id }).returning({ id: timeEntries.id });
      return row!.id;
    });
    if (d.userId !== me.id && !existing) {
      await notifyEvent({ userIds: [d.userId], type: "hours.reported_for_you", title: `${me.fullName} דיווח/ה שעות בשמך`, body: `${d.workDate} · ${d.description}`, link: `/hours?date=${d.workDate}` });
    }
    revalidatePath("/hours");
    return { id, dayMinutes, overStandard: dayMinutes > stdMinutes };
  });
}

export async function deleteTimeEntryAction(id: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const [e] = await db.select().from(timeEntries).where(and(eq(timeEntries.id, id), isNull(timeEntries.deletedAt)));
    if (!e) throw new NotFoundError("time_entry");
    const me = await authorizeTarget(e.userId, "report");
    if (e.invoiceId) throw new BusinessRuleError("hours.already_invoiced");
    if (!can(me, "hours.edit_locked") && (await isLockedFor(e.userId, e.workDate))) throw new BusinessRuleError("hours.period_locked");
    await withUser({ userId: me.id }, (tx) => tx.update(timeEntries).set({ deletedAt: new Date() }).where(eq(timeEntries.id, id)));
    revalidatePath("/hours");
    return undefined;
  });
}

/** Returns the previous week's pattern (sub-contract + minutes per weekday) – descriptions must be re-entered (spec §10.2). */
export async function previousWeekPatternAction(userId: string, weekStart: string): Promise<ActionResult<{ subContractId: string; label: string; workDate: string; minutes: number }[]>> {
  return runAction(async () => {
    await authorizeTarget(userId, "view");
    const prevStart = shift(weekStart, -7);
    const prevEnd = shift(weekStart, -1);
    const { entriesForRange } = await import("./queries");
    const rows = await entriesForRange(userId, prevStart, prevEnd);
    const agg = new Map<string, { subContractId: string; label: string; workDate: string; minutes: number }>();
    for (const r of rows) {
      const target = shift(r.workDate, 7);
      const key = `${r.subContractId}|${target}`;
      const cur = agg.get(key);
      if (cur) cur.minutes += r.minutes;
      else agg.set(key, { subContractId: r.subContractId, label: r.label, workDate: target, minutes: r.minutes });
    }
    return [...agg.values()];
  });
}

const unlockSchema = z.object({ userId: z.uuid(), month: z.iso.date(), days: z.coerce.number().int().min(1).max(60).default(7), reason: z.string().trim().min(2).max(500) });

/** Admin opens a locked month for an employee (spec §10.7). */
export async function unlockPeriodAction(fd: FormData): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const me = await requireUser();
    if (!can(me, "hours.edit_locked")) throw new AuthError("FORBIDDEN");
    const d = unlockSchema.parse(Object.fromEntries(fd.entries()));
    const month = `${d.month.slice(0, 7)}-01`;
    const until = new Date(Date.now() + d.days * 86_400_000);
    await withUser({ userId: me.id, reason: d.reason }, (tx) => tx.insert(periodUnlocks).values({ userId: d.userId, month, unlockedBy: me.id, unlockedUntil: until, reason: d.reason, createdBy: me.id }));
    await notifyEvent({ userIds: [d.userId], type: "hours.period_unlocked", title: `חודש ${month.slice(5, 7)}/${month.slice(0, 4)} נפתח לעריכה`, body: `עד ${until.toLocaleDateString("he-IL")} · ${d.reason}`, link: `/hours?date=${month}&view=monthly` });
    revalidatePath("/hours");
    return undefined;
  });
}

export async function activeUnlocksAction(userId: string) {
  await authorizeTarget(userId, "view");
  return activeUnlocks(userId);
}

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

