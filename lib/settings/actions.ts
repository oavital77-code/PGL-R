"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCapability } from "@/lib/auth/authorize";
import { runAction, type ActionResult } from "@/lib/actions/result";
import { withUser } from "@/lib/db/with-user";
import { ValidationError } from "@/lib/auth/errors";
import { SETTINGS_SCHEMAS, WIZARD_STEPS, type SettingsKey, type SettingsValue, type WizardStepKey } from "./defaults";
import { getSettingFresh, setSetting } from "./service";

/* ------------------------------------------------------------------ */
/* Generic JSON settings save                                          */
/* ------------------------------------------------------------------ */

const list = (v: unknown) =>
  typeof v === "string"
    ? v
        .split(/[,\n;]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : Array.isArray(v)
      ? v
      : [];
const bool = (v: unknown) => v === "on" || v === "true" || v === true || v === "1";
const num = (v: unknown) => (v === "" || v === null || v === undefined ? undefined : Number(v));

/** FormData → partial setting object, per key (spec §6.3 shapes). */
function formToSetting(key: SettingsKey, fd: FormData): unknown {
  const g = (n: string) => fd.get(n);
  const s = (n: string) => String(g(n) ?? "");
  switch (key) {
    case "company":
      return {
        name: s("name"),
        tax_id: s("tax_id"),
        address: s("address"),
        phone: s("phone"),
        fax: s("fax"),
        website: s("website"),
        email: s("email"),
        bank: { bank: s("bank.bank"), branch: s("bank.branch"), account: s("bank.account"), beneficiary: s("bank.beneficiary") },
        pdf_footer_text: s("pdf_footer_text"),
      };
    case "email":
      return {
        from_name: s("from_name"),
        from_address: s("from_address"),
        reply_to: s("reply_to"),
        invoice_cc: list(s("invoice_cc")),
        templates: {
          invoice: { subject: s("templates.invoice.subject"), body: s("templates.invoice.body") },
          hours_reminder: { subject: s("templates.hours_reminder.subject"), body: s("templates.hours_reminder.body") },
          overdue: { subject: s("templates.overdue.subject"), body: s("templates.overdue.body") },
          scheduled_report: { subject: s("templates.scheduled_report.subject"), body: s("templates.scheduled_report.body") },
        },
      };
    case "index":
      return { type: "cpi", cbs_auto_fetch: bool(g("cbs_auto_fetch")), default_floor: bool(g("default_floor")), invoice_month_rule: s("invoice_month_rule") };
    case "numbering":
      return {
        work_number: { mode: s("work_number.mode"), next: num(g("work_number.next")), prefix: s("work_number.prefix") },
        invoice: { mode: s("invoice.mode"), next: num(g("invoice.next")), prefix: s("invoice.prefix"), year: num(g("invoice.year")) },
      };
    case "hours":
      return {
        default_standard_hours_per_day: num(g("default_standard_hours_per_day")),
        default_work_days: fd.getAll("default_work_days").map(Number),
        lock_rule: s("lock_rule"),
        reminder_days: num(g("reminder_days")),
        reminder_repeat_days: num(g("reminder_repeat_days")),
        notify_department_manager: bool(g("notify_department_manager")),
        allow_future_dates: bool(g("allow_future_dates")),
        max_minutes_per_day: num(g("max_minutes_per_day")),
      };
    case "invoices":
      return {
        default_payment_terms_days: num(g("default_payment_terms_days")),
        retainer_billing_day: num(g("retainer_billing_day")),
        default_intro_text: s("default_intro_text"),
        default_notes: s("default_notes"),
        require_second_approval: bool(g("require_second_approval")),
        aging_thresholds: list(s("aging_thresholds")).map(Number),
        default_signer_user_id: s("default_signer_user_id") || null,
        hours_line_grouping: s("hours_line_grouping"),
        attach_hours_appendix: bool(g("attach_hours_appendix")),
        show_withholding: bool(g("show_withholding")),
        show_retention: bool(g("show_retention")),
      };
    case "suppliers":
      return {
        approver_user_ids: fd.getAll("approver_user_ids").map(String),
        required_approvals: num(g("required_approvals")),
        over_budget_alert: bool(g("over_budget_alert")),
        progress_vs_client_alert: bool(g("progress_vs_client_alert")),
      };
    case "accounting": {
      const keys = fd.getAll("mapping_key").map(String);
      const vals = fd.getAll("mapping_value").map(String);
      const field_mapping: Record<string, string> = {};
      keys.forEach((k, i) => {
        if (k && vals[i]) field_mapping[k] = vals[i]!;
      });
      return { software_name: s("software_name"), export_format: s("export_format"), field_mapping, auto_export_email: s("auto_export_email"), frequency: s("frequency") };
    }
    case "security":
      return { mfa_required_roles: fd.getAll("mfa_required_roles").map(String), session_hours: num(g("session_hours")) };
    case "alerts":
      return { contract_progress_thresholds: list(s("contract_progress_thresholds")).map(Number) };
    case "files":
      return { allowed_extensions: list(s("allowed_extensions")).map((e) => e.toLowerCase().replace(/^\./, "")), max_size_mb: num(g("max_size_mb")) };
    case "rates":
      return { default_hourly_mode: s("default_hourly_mode") };
    case "permissions": {
      const manager: Record<string, boolean> = {};
      const employee: Record<string, boolean> = {};
      for (const [k, v] of fd.entries()) {
        if (k.startsWith("manager.")) manager[k.slice(8)] = v === "on";
        if (k.startsWith("employee.")) employee[k.slice(9)] = v === "on";
      }
      // unchecked boxes are absent → explicit false for every listed capability
      for (const c of fd.getAll("$caps").map(String)) {
        manager[c] ??= false;
        employee[c] ??= false;
      }
      return { manager, employee, others_scope: { manager: s("others_scope.manager"), employee: s("others_scope.employee") } };
    }
    case "notifications": {
      const channels: Record<string, { in_app: boolean; email: boolean }> = {};
      for (const ev of fd.getAll("$events").map(String)) channels[ev] = { in_app: fd.get(`${ev}.in_app`) === "on", email: fd.get(`${ev}.email`) === "on" };
      return { channels };
    }
    case "onboarding":
      throw new ValidationError("errors.forbidden");
  }
}

export async function saveSettingAction(key: SettingsKey, step: WizardStepKey | null, fd: FormData): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    const value = formToSetting(key, fd);
    const parsed = SETTINGS_SCHEMAS[key].parse(value);
    await withUser({ userId: user.id }, async (tx) => {
      await setSetting(key, parsed as SettingsValue<typeof key>, user.id, tx);
      if (step) await markStepDoneInternal(step, user.id, tx);
    });
    revalidatePath("/settings", "layout");
    return { saved: true as const };
  });
}

/* ------------------------------------------------------------------ */
/* Wizard progress                                                     */
/* ------------------------------------------------------------------ */

async function markStepDoneInternal(step: WizardStepKey, userId: string, tx: Parameters<typeof setSetting>[3]) {
  const ob = await getSettingFresh("onboarding");
  if (!ob.completed_steps.includes(step)) ob.completed_steps.push(step);
  await setSetting("onboarding", ob, userId, tx);
}

export async function markStepDoneAction(step: WizardStepKey): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    z.enum(WIZARD_STEPS.map((s) => s.key) as [WizardStepKey, ...WizardStepKey[]]).parse(step);
    await withUser({ userId: user.id }, (tx) => markStepDoneInternal(step, user.id, tx));
    revalidatePath("/settings", "layout");
    return { saved: true as const };
  });
}

export async function finishWizardAction(): Promise<ActionResult<{ saved: true }>> {
  return runAction(async () => {
    const user = await requireCapability("settings.manage");
    const ob = await getSettingFresh("onboarding");
    const missing = WIZARD_STEPS.filter((s) => s.required && !ob.completed_steps.includes(s.key));
    if (missing.length > 0) throw new ValidationError("settings.wizard.finish_blocked");
    await withUser({ userId: user.id }, (tx) => setSetting("onboarding", { ...ob, completed: true }, user.id, tx));
    revalidatePath("/", "layout");
    return { saved: true as const };
  });
}
