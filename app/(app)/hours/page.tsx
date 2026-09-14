import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { can, requireUser } from "@/lib/auth/authorize";
import { activeUnlocks, assignedSubContracts, entriesForRange, selectableUsers, userHoursProfile } from "@/lib/hours/queries";
import { daysBetweenInclusive, monthEndOf, monthStartOf, shiftDays, weekStartOf } from "@/lib/hours/dates";
import { isPeriodLocked } from "@/lib/calc/period-lock";
import { todayLocal } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { Timesheet } from "@/components/hours/timesheet";
import { UnlockMonthDialog } from "@/components/hours/unlock-month-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

type View = "daily" | "weekly" | "monthly";

export default async function HoursPage({ searchParams }: { searchParams: Promise<{ user?: string; view?: string; date?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const today = todayLocal();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const view: View = sp.view === "daily" || sp.view === "monthly" ? sp.view : "weekly";
  const targetId = sp.user && sp.user !== me.id ? sp.user : me.id;
  if (targetId !== me.id) {
    const profile = await userHoursProfile(targetId);
    if (!can(me, "hours.view_others", { targetUserId: targetId, targetDepartmentId: profile.departmentId })) redirect("/hours");
  }
  const [profile, subs, unlocks, t] = await Promise.all([userHoursProfile(targetId), assignedSubContracts(targetId), activeUnlocks(targetId), getTranslations("hours")]);
  const from = view === "monthly" ? monthStartOf(date) : view === "weekly" ? weekStartOf(date) : date;
  const to = view === "monthly" ? monthEndOf(date) : view === "weekly" ? shiftDays(from, 6) : date;
  const entries = await entriesForRange(targetId, from, to);
  const canReport = targetId === me.id ? can(me, "hours.report_own") : can(me, "hours.report_for_others", { targetUserId: targetId, targetDepartmentId: profile.departmentId });
  const canEditLocked = can(me, "hours.edit_locked");
  const lockedDays = Object.fromEntries(daysBetweenInclusive(from, to).map((d) => [d, isPeriodLocked(d, today, { rule: profile.settings.lock_rule, userId: targetId, unlocks, nowIso: new Date().toISOString() })]));
  const people = can(me, "hours.view_others") ? await selectableUsers(me.othersScope, me.departmentId) : [];
  return (
    <>
      <PageHeader
        title={t("title")}
        description={targetId !== me.id ? t("viewing_other", { name: profile.name }) : undefined}
        actions={canEditLocked && view !== "daily" ? <UnlockMonthDialog userId={targetId} month={monthStartOf(date)} /> : undefined}
      />
      {subs.length === 0 ? (
        <Alert variant="warning" className="mb-4">
          <AlertDescription>{t("no_assignments")}</AlertDescription>
        </Alert>
      ) : null}
      <Timesheet
        view={view}
        date={date}
        from={from}
        to={to}
        today={today}
        targetUserId={targetId}
        meId={me.id}
        people={people}
        subs={subs.map((s) => ({ id: s.id, label: s.label }))}
        entries={entries}
        stdMinutes={profile.stdMinutes}
        workDays={profile.workDays}
        employmentStart={profile.employmentStart}
        lockedDays={lockedDays}
        canReport={canReport}
        canEditLocked={canEditLocked}
        allowFuture={profile.settings.allow_future_dates}
      />
    </>
  );
}
