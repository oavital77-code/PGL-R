"use server";
import { clerkClient } from "@clerk/nextjs/server";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability, requireUser } from "@/lib/auth/authorize";
import { BusinessRuleError, ValidationError } from "@/lib/auth/errors";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { db } from "@/lib/db";
import { employeeCostRates, users } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { boolFromForm, optionalDate, optionalNumber, optionalString, optionalUuid } from "@/lib/utils/zod";
import { cookies } from "next/headers";

const userSchema = z.object({
  id: optionalUuid,
  email: z.email().transform((e) => e.toLowerCase()),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(["admin", "manager", "employee"]),
  departmentId: optionalUuid,
  gradeId: optionalUuid,
  standardHoursPerDay: optionalNumber,
  workDays: z.array(z.coerce.number().int().min(0).max(6)).default([]),
  employmentStart: optionalDate,
  employmentEnd: optionalDate,
  isActive: boolFromForm,
  locale: z.enum(["he", "en"]).default("he"),
  phone: optionalString,
  externalPayrollId: optionalString,
});

function parseUserForm(fd: FormData) {
  return userSchema.parse({
    id: fd.get("id") ?? undefined,
    email: fd.get("email"),
    firstName: fd.get("firstName"),
    lastName: fd.get("lastName"),
    role: fd.get("role"),
    departmentId: fd.get("departmentId"),
    gradeId: fd.get("gradeId"),
    standardHoursPerDay: fd.get("standardHoursPerDay"),
    workDays: fd.getAll("workDays"),
    employmentStart: fd.get("employmentStart"),
    employmentEnd: fd.get("employmentEnd"),
    isActive: fd.get("isActive") ?? (fd.get("id") ? "off" : "on"),
    locale: fd.get("locale") ?? "he",
    phone: fd.get("phone"),
    externalPayrollId: fd.get("externalPayrollId"),
  });
}

async function sendClerkInvitation(email: string, role: string) {
  const base = process.env.APP_BASE_URL ?? "";
  const client = await clerkClient();
  try {
    await client.invitations.createInvitation({ emailAddress: email, redirectUrl: base ? `${base}/sign-in` : undefined, publicMetadata: { role }, ignoreExisting: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new BusinessRuleError("users.clerk_error", msg);
  }
}

/** Invite a new user (spec §2.3): creates the users row + Clerk invitation. */
export async function inviteUserAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const admin = await requireCapability("users.manage");
    const d = parseUserForm(fd);
    const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
    if (exists[0]) throw new ValidationError("users.email_exists", { email: ["users.email_exists"] });
    const id = await withUser({ userId: admin.id }, async (tx) => {
      const [row] = await tx
        .insert(users)
        .values({
          email: d.email,
          firstName: d.firstName,
          lastName: d.lastName,
          role: d.role,
          departmentId: d.departmentId ?? null,
          gradeId: d.gradeId ?? null,
          standardHoursPerDay: d.standardHoursPerDay?.toFixed(2) ?? null,
          workDays: d.workDays.length ? d.workDays : [0, 1, 2, 3, 4],
          employmentStart: d.employmentStart ?? null,
          employmentEnd: d.employmentEnd ?? null,
          isActive: true,
          locale: d.locale,
          phone: d.phone ?? null,
          externalPayrollId: d.externalPayrollId ?? null,
          invitedAt: new Date(),
          createdBy: admin.id,
        })
        .returning({ id: users.id });
      return row!.id;
    });
    await sendClerkInvitation(d.email, d.role);
    revalidatePath("/admin/users");
    return { id };
  });
}

export async function updateUserAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const admin = await requireCapability("users.manage");
    const d = parseUserForm(fd);
    if (!d.id) throw new ValidationError("errors.validation");
    const dup = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, d.email), ne(users.id, d.id)))
      .limit(1);
    if (dup[0]) throw new ValidationError("users.email_exists", { email: ["users.email_exists"] });
    if (d.id === admin.id && (d.role !== "admin" || !d.isActive)) throw new BusinessRuleError("users.cannot_demote_self");
    await withUser({ userId: admin.id }, (tx) =>
      tx
        .update(users)
        .set({
          email: d.email,
          firstName: d.firstName,
          lastName: d.lastName,
          role: d.role,
          departmentId: d.departmentId ?? null,
          gradeId: d.gradeId ?? null,
          standardHoursPerDay: d.standardHoursPerDay?.toFixed(2) ?? null,
          workDays: d.workDays.length ? d.workDays : [0, 1, 2, 3, 4],
          employmentStart: d.employmentStart ?? null,
          employmentEnd: d.employmentEnd ?? null,
          isActive: d.isActive,
          locale: d.locale,
          phone: d.phone ?? null,
          externalPayrollId: d.externalPayrollId ?? null,
        })
        .where(eq(users.id, d.id!)),
    );
    revalidatePath("/admin/users");
    return { id: d.id };
  });
}

export async function resendInvitationAction(userId: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    await requireCapability("users.manage");
    const [u] = await db.select({ email: users.email, role: users.role, clerk: users.clerkUserId }).from(users).where(eq(users.id, userId));
    if (!u) throw new ValidationError("errors.not_found");
    if (u.clerk) throw new BusinessRuleError("users.already_linked");
    await sendClerkInvitation(u.email, u.role);
    await db.update(users).set({ invitedAt: new Date() }).where(eq(users.id, userId));
    return undefined;
  });
}

const costSchema = z.object({ userId: z.uuid(), hourlyCost: z.coerce.number().min(0), effectiveFrom: z.iso.date() });

export async function upsertCostRateAction(fd: FormData): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const admin = await requireCapability("users.manage");
    const d = costSchema.parse(Object.fromEntries(fd.entries()));
    await withUser({ userId: admin.id }, (tx) =>
      tx
        .insert(employeeCostRates)
        .values({ userId: d.userId, hourlyCost: d.hourlyCost.toFixed(2), effectiveFrom: d.effectiveFrom, createdBy: admin.id })
        .onConflictDoUpdate({ target: [employeeCostRates.userId, employeeCostRates.effectiveFrom], set: { hourlyCost: d.hourlyCost.toFixed(2) } }),
    );
    revalidatePath(`/admin/users/${d.userId}`);
    return undefined;
  });
}

export async function deleteCostRateAction(id: string, userId: string): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const admin = await requireCapability("users.manage");
    await withUser({ userId: admin.id }, (tx) => tx.delete(employeeCostRates).where(eq(employeeCostRates.id, id)));
    revalidatePath(`/admin/users/${userId}`);
    return undefined;
  });
}

/** Current user switches UI language (spec §16.2) – stored in the profile and mirrored to a cookie. */
export async function setMyLocaleAction(locale: "he" | "en"): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const me = await requireUser();
    await db.update(users).set({ locale }).where(eq(users.id, me.id));
    const store = await cookies();
    store.set("pgl_locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    revalidatePath("/", "layout");
    return undefined;
  });
}
