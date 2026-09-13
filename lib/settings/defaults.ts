/**
 * Typed settings registry (spec §6.3). Every key has a zod schema and a default.
 * `settings` rows are key/value jsonb; missing keys fall back to defaults.
 */
import { z } from "zod";

export const onboardingSchema = z.object({
  completed_steps: z.array(z.string()).default([]),
  completed: z.boolean().default(false),
});

export const companySchema = z.object({
  name: z.string().default("פי.ג'י.אל. הנדסה ותכנון תחבורה בע\"מ"),
  tax_id: z.string().default("512066176"),
  address: z.string().default(""),
  phone: z.string().default(""),
  fax: z.string().default(""),
  website: z.string().default(""),
  email: z.string().default(""),
  logo_document_id: z.string().nullable().default(null),
  iso_badge_document_id: z.string().nullable().default(null),
  bank: z
    .object({ bank: z.string().default(""), branch: z.string().default(""), account: z.string().default(""), beneficiary: z.string().default("") })
    .default({ bank: "", branch: "", account: "", beneficiary: "" }),
  pdf_footer_text: z.string().default(""),
});

const emailTemplate = z.object({ subject: z.string(), body: z.string() });
export const emailSchema = z.object({
  from_name: z.string().default("PGL"),
  from_address: z.string().default(""),
  reply_to: z.string().default(""),
  invoice_cc: z.array(z.string()).default([]),
  templates: z
    .object({
      invoice: emailTemplate.default({
        subject: "חשבון עסקה {{invoice_number}} – {{project_name}} ({{work_number}})",
        body: "שלום {{contact_first_name}},\n\nמצורף חשבון עסקה מס' {{invoice_number}} עבור פרויקט {{project_name}} (מס' עבודה {{work_number}}) על סך {{total}} ₪.\nמועד התשלום: {{due_date}}.\n\nבברכה,\n{{sender_name}}\n{{company_name}}",
      }),
      hours_reminder: emailTemplate.default({
        subject: "תזכורת: דיווח שעות חסר",
        body: "שלום {{contact_first_name}},\n\nלא נמצא דיווח שעות מעודכן במערכת. נא להשלים את הדיווח בהקדם.\n\n{{company_name}}",
      }),
      overdue: emailTemplate.default({
        subject: "תזכורת תשלום – חשבון עסקה {{invoice_number}}",
        body: "שלום {{contact_first_name}},\n\nחשבון עסקה מס' {{invoice_number}} עבור {{project_name}} על סך {{total}} ₪ טרם שולם. מועד התשלום היה {{due_date}}.\nנודה לטיפולכם.\n\n{{sender_name}}\n{{company_name}}",
      }),
      scheduled_report: emailTemplate.default({
        subject: "דוח מתוזמן: {{report_name}}",
        body: "מצורף הדוח המתוזמן {{report_name}} שהופק בתאריך {{date}}.\n\n{{company_name}}",
      }),
    })
    .default({
      invoice: { subject: "", body: "" },
      hours_reminder: { subject: "", body: "" },
      overdue: { subject: "", body: "" },
      scheduled_report: { subject: "", body: "" },
    }),
});

export const ratesSchema = z.object({ default_hourly_mode: z.enum(["rate_card", "custom"]).default("rate_card") });

export const indexSchema = z.object({
  type: z.literal("cpi").default("cpi"),
  cbs_auto_fetch: z.boolean().default(true),
  default_floor: z.boolean().default(false),
  invoice_month_rule: z.enum(["latest_known", "previous_month"]).default("latest_known"),
});

export const numberingSchema = z.object({
  work_number: z.object({ mode: z.enum(["manual", "auto"]).default("manual"), next: z.number().int().default(1), prefix: z.string().default("") }).default({ mode: "manual", next: 1, prefix: "" }),
  invoice: z
    .object({ mode: z.enum(["global", "yearly"]).default("global"), next: z.number().int().default(16836), prefix: z.string().default(""), year: z.number().int().default(new Date().getFullYear()) })
    .default({ mode: "global", next: 16836, prefix: "", year: new Date().getFullYear() }),
});

export const hoursSchema = z.object({
  default_standard_hours_per_day: z.number().default(8.5),
  default_work_days: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4]),
  lock_rule: z.enum(["end_of_next_month", "end_of_month", "never"]).default("end_of_next_month"),
  reminder_days: z.number().int().default(10),
  reminder_repeat_days: z.number().int().default(3),
  notify_department_manager: z.boolean().default(true),
  allow_future_dates: z.boolean().default(false),
  max_minutes_per_day: z.number().int().default(1440),
});

export const invoicesSchema = z.object({
  default_payment_terms_days: z.number().int().default(30),
  retainer_billing_day: z.number().int().min(1).max(28).default(1),
  default_intro_text: z.string().default("להלן חשבון עסקה עבור שירותי תכנון בהתאם להסכם שבינינו."),
  default_notes: z.string().default(""),
  require_second_approval: z.boolean().default(false),
  aging_thresholds: z.array(z.number().int()).default([30, 60, 90]),
  default_signer_user_id: z.string().nullable().default(null),
  hours_line_grouping: z.enum(["grade", "employee"]).default("grade"),
  attach_hours_appendix: z.boolean().default(true),
  show_withholding: z.boolean().default(true),
  show_retention: z.boolean().default(true),
});

export const suppliersSchema = z.object({
  approver_user_ids: z.array(z.string()).default([]),
  required_approvals: z.number().int().min(1).default(2),
  over_budget_alert: z.boolean().default(true),
  progress_vs_client_alert: z.boolean().default(true),
});

export const accountingSchema = z.object({
  software_name: z.string().default(""),
  export_format: z.enum(["xlsx", "csv"]).default("xlsx"),
  field_mapping: z.record(z.string(), z.string()).default({}),
  auto_export_email: z.string().default(""),
  frequency: z.enum(["manual", "daily", "monthly"]).default("manual"),
});

export const alertsSchema = z.object({ contract_progress_thresholds: z.array(z.number()).default([80, 100]) });

export const filesSchema = z.object({
  allowed_extensions: z.array(z.string()).default(["pdf", "doc", "docx", "xls", "xlsx", "dwg", "dxf", "png", "jpg", "jpeg", "msg", "eml", "zip"]),
  max_size_mb: z.number().default(50),
});

export const securitySchema = z.object({
  mfa_required_roles: z.array(z.enum(["admin", "manager", "employee"])).default(["admin"]),
  session_hours: z.number().default(12),
});

export const permissionsSchema = z.object({
  manager: z.record(z.string(), z.boolean()).default({}),
  employee: z.record(z.string(), z.boolean()).default({}),
});

export const notificationsSchema = z.object({
  /** event → { in_app, email } */
  channels: z.record(z.string(), z.object({ in_app: z.boolean(), email: z.boolean() })).default({}),
});

export const SETTINGS_SCHEMAS = {
  onboarding: onboardingSchema,
  company: companySchema,
  email: emailSchema,
  rates: ratesSchema,
  index: indexSchema,
  numbering: numberingSchema,
  hours: hoursSchema,
  invoices: invoicesSchema,
  suppliers: suppliersSchema,
  accounting: accountingSchema,
  alerts: alertsSchema,
  files: filesSchema,
  security: securitySchema,
  permissions: permissionsSchema,
  notifications: notificationsSchema,
} as const;

export type SettingsKey = keyof typeof SETTINGS_SCHEMAS;
export type SettingsValue<K extends SettingsKey> = z.infer<(typeof SETTINGS_SCHEMAS)[K]>;

export function parseSetting<K extends SettingsKey>(key: K, raw: unknown): SettingsValue<K> {
  const schema = SETTINGS_SCHEMAS[key];
  return schema.parse(raw ?? {}) as SettingsValue<K>;
}

export function defaultSetting<K extends SettingsKey>(key: K): SettingsValue<K> {
  return parseSetting(key, {});
}

/** Wizard steps (spec §6.2) – key, path, required */
export const WIZARD_STEPS = [
  { key: "company", path: "/settings/company", required: true },
  { key: "email", path: "/settings/email", required: true },
  { key: "departments", path: "/settings/departments", required: true },
  { key: "rates", path: "/settings/rates", required: true },
  { key: "vat", path: "/settings/vat", required: true },
  { key: "index", path: "/settings/index", required: true },
  { key: "numbering", path: "/settings/numbering", required: true },
  { key: "stages", path: "/settings/stages", required: true },
  { key: "lookups", path: "/settings/lookups", required: false },
  { key: "hours", path: "/settings/hours", required: true },
  { key: "permissions", path: "/settings/permissions", required: false },
  { key: "signatures", path: "/settings/signatures", required: true },
  { key: "invoices", path: "/settings/invoices", required: true },
  { key: "suppliers", path: "/settings/suppliers", required: true },
  { key: "accounting", path: "/settings/accounting", required: false },
  { key: "security", path: "/settings/security", required: false },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]["key"];
