"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { inviteUserAction, updateUserAction } from "@/lib/users/actions";
import type { users } from "@/lib/db/schema";
import { ActionForm } from "@/components/shared/action-form";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type UserRow = typeof users.$inferSelect;

export function UserForm({ user, departments, grades, onDone }: { user: UserRow | null; departments: { id: string; name: string }[]; grades: { id: string; name: string }[]; onDone?: () => void }) {
  const t = useTranslations("users");
  const tr = useTranslations("roles");
  const router = useRouter();
  return (
    <ActionForm
      action={user ? updateUserAction : inviteUserAction}
      submitLabel={user ? undefined : t("invite")}
      successMessage={user ? undefined : t("invited")}
      onSuccess={(d) => {
        onDone?.();
        if (!user) router.push(`/admin/users/${d.id}`);
      }}
    >
      {user ? <input type="hidden" name="id" value={user.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("first_name")} htmlFor="firstName" required>
          <Input id="firstName" name="firstName" defaultValue={user?.firstName ?? ""} required />
        </Field>
        <Field label={t("last_name")} htmlFor="lastName" required>
          <Input id="lastName" name="lastName" defaultValue={user?.lastName ?? ""} required />
        </Field>
        <Field label={t("email")} htmlFor="email" required>
          <Input id="email" name="email" type="email" defaultValue={user?.email ?? ""} required />
        </Field>
        <Field label={t("phone")} htmlFor="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={user?.phone ?? ""} />
        </Field>
        <Field label={t("role")} htmlFor="role" required>
          <Select id="role" name="role" defaultValue={user?.role ?? "employee"}>
            <option value="employee">{tr("employee")}</option>
            <option value="manager">{tr("manager")}</option>
            <option value="admin">{tr("admin")}</option>
          </Select>
        </Field>
        <Field label={t("department")} htmlFor="departmentId">
          <Select id="departmentId" name="departmentId" defaultValue={user?.departmentId ?? ""}>
            <option value="">—</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("grade")} htmlFor="gradeId">
          <Select id="gradeId" name="gradeId" defaultValue={user?.gradeId ?? ""}>
            <option value="">—</option>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("standard_hours")} htmlFor="standardHoursPerDay">
          <Input id="standardHoursPerDay" name="standardHoursPerDay" type="number" step="0.25" min="1" max="24" defaultValue={user?.standardHoursPerDay ?? ""} />
        </Field>
        <Field label={t("work_days")}>
          <div className="flex flex-wrap gap-3 pt-1">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <label key={d} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="workDays" value={d} defaultChecked={(user?.workDays ?? [0, 1, 2, 3, 4]).includes(d)} /> {t(`days.${d}` as "days.0")}
              </label>
            ))}
          </div>
        </Field>
        <Field label={t("locale")} htmlFor="locale">
          <Select id="locale" name="locale" defaultValue={user?.locale ?? "he"}>
            <option value="he">עברית</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <Field label={t("employment_start")} htmlFor="employmentStart">
          <Input id="employmentStart" name="employmentStart" type="date" defaultValue={user?.employmentStart ?? ""} />
        </Field>
        <Field label={t("employment_end")} htmlFor="employmentEnd">
          <Input id="employmentEnd" name="employmentEnd" type="date" defaultValue={user?.employmentEnd ?? ""} />
        </Field>
        <Field label={t("external_payroll_id")} htmlFor="externalPayrollId">
          <Input id="externalPayrollId" name="externalPayrollId" defaultValue={user?.externalPayrollId ?? ""} className="num" />
        </Field>
        {user ? (
          <label className="flex items-center gap-2 text-sm pt-6">
            <input type="checkbox" name="isActive" defaultChecked={user.isActive} /> {t("is_active")}
          </label>
        ) : null}
      </div>
      {!user ? <p className="text-xs text-muted-foreground">{t("invite_hint")}</p> : null}
    </ActionForm>
  );
}
