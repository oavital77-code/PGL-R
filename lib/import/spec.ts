/** Import templates in the mandatory order (spec §15.2). Column keys are the xlsx headers. */
export type ColType = "text" | "number" | "money" | "pct" | "date" | "month" | "email" | "bool" | "enum" | "time";

export interface ImportColumn {
  key: string;
  label: string;
  type: ColType;
  required?: boolean;
  enum?: string[];
  note?: string;
  example?: string;
}

export interface ImportEntity {
  key: string;
  label: string;
  order: number;
  columns: ImportColumn[];
  /** columns that together identify a row (used for duplicate detection inside the file) */
  naturalKey: string[];
}

const wn: ImportColumn = { key: "work_number", label: "מס' עבודה", type: "text", required: true, example: "3489" };
const dir: ImportColumn = { key: "direction", label: "כיוון (income=לקוח / expense=ספק)", type: "enum", enum: ["income", "expense"], required: true, example: "income" };
const cn: ImportColumn = { key: "contract_number", label: "מס' חוזה בפרויקט", type: "number", required: true, example: "1" };
const scn: ImportColumn = { key: "sub_contract_number", label: "מס' תת-חוזה", type: "number", required: true, example: "1" };

export const IMPORT_ENTITIES: ImportEntity[] = [
  { key: "departments", label: "מחלקות", order: 1, naturalKey: ["code"], columns: [{ key: "code", label: "קוד", type: "text", required: true, example: "D1" }, { key: "name", label: "שם", type: "text", required: true, example: "מחלקת תנועה" }, { key: "sort_order", label: "סדר", type: "number" }] },
  { key: "grades", label: "דרגות", order: 1, naturalKey: ["name"], columns: [{ key: "name", label: "שם דרגה", type: "text", required: true, example: "מהנדס בכיר" }, { key: "sort_order", label: "סדר", type: "number" }, { key: "hourly_rate", label: "תעריף חיוב שעתי", type: "money" }, { key: "rate_effective_from", label: "תעריף בתוקף מתאריך", type: "date" }] },
  { key: "stage_names", label: "שמות שלבים", order: 1, naturalKey: ["name"], columns: [{ key: "name", label: "שם שלב", type: "text", required: true }, { key: "sort_order", label: "סדר", type: "number" }] },
  {
    key: "users", label: "עובדים", order: 2, naturalKey: ["email"],
    columns: [
      { key: "email", label: "דוא\"ל", type: "email", required: true, example: "ido@pgl.co.il" }, { key: "first_name", label: "שם פרטי", type: "text", required: true }, { key: "last_name", label: "שם משפחה", type: "text", required: true },
      { key: "role", label: "תפקיד", type: "enum", enum: ["admin", "manager", "employee"], required: true, example: "employee" }, { key: "department_code", label: "קוד מחלקה", type: "text" }, { key: "grade_name", label: "דרגה", type: "text" },
      { key: "standard_hours_per_day", label: "תקן שעות יומי", type: "number", example: "8.5" }, { key: "work_days", label: "ימי עבודה (0=א' … 6=ש', מופרד בפסיקים)", type: "text", example: "0,1,2,3,4" },
      { key: "employment_start", label: "תחילת העסקה", type: "date" }, { key: "employment_end", label: "סיום העסקה", type: "date" }, { key: "external_payroll_id", label: "מזהה שכר", type: "text" }, { key: "is_active", label: "פעיל", type: "bool", example: "כן" },
    ],
  },
  { key: "employee_cost_rates", label: "עלויות שעתיות", order: 2, naturalKey: ["user_email", "effective_from"], columns: [{ key: "user_email", label: "דוא\"ל עובד", type: "email", required: true }, { key: "hourly_cost", label: "עלות שעתית (כולל תקורה)", type: "money", required: true }, { key: "effective_from", label: "בתוקף מתאריך", type: "date", required: true }] },
  {
    key: "clients", label: "לקוחות", order: 3, naturalKey: ["name"],
    columns: [
      { key: "name", label: "שם", type: "text", required: true }, { key: "tax_id", label: "ח.פ", type: "text" }, { key: "client_kind", label: "סוג", type: "enum", enum: ["company", "authority", "private", "other"], example: "authority" },
      { key: "address_street", label: "רחוב", type: "text" }, { key: "address_city", label: "עיר", type: "text" }, { key: "address_zip", label: "מיקוד", type: "text" }, { key: "phone", label: "טלפון", type: "text" }, { key: "email", label: "דוא\"ל", type: "email" }, { key: "website", label: "אתר", type: "text" },
      { key: "payment_terms_days", label: "תנאי תשלום (ימים)", type: "number" }, { key: "index_linked_default", label: "הצמדה כברירת מחדל", type: "bool" }, { key: "vat_exempt", label: "פטור ממע\"מ", type: "bool" }, { key: "withholding_tax_pct", label: "ניכוי במקור %", type: "pct" }, { key: "withholding_valid_until", label: "תוקף ניכוי", type: "date" }, { key: "notes", label: "הערות", type: "text" }, { key: "is_active", label: "פעיל", type: "bool" },
    ],
  },
  { key: "contacts", label: "אנשי קשר (לקוחות/ספקים)", order: 3, naturalKey: ["client_name", "supplier_name", "first_name", "last_name"], columns: [{ key: "client_name", label: "שם לקוח (או ריק)", type: "text" }, { key: "supplier_name", label: "שם ספק (או ריק)", type: "text" }, { key: "first_name", label: "שם פרטי", type: "text", required: true }, { key: "last_name", label: "שם משפחה", type: "text" }, { key: "role_title", label: "תפקיד", type: "text" }, { key: "email", label: "דוא\"ל", type: "email" }, { key: "phone", label: "טלפון", type: "text" }, { key: "receives_invoices", label: "נמען לחשבונות", type: "bool" }, { key: "is_primary", label: "ראשי", type: "bool" }] },
  { key: "suppliers", label: "ספקים", order: 4, naturalKey: ["name"], columns: [{ key: "name", label: "שם", type: "text", required: true }, { key: "tax_id", label: "ח.פ", type: "text" }, { key: "field", label: "תחום", type: "text" }, { key: "address_street", label: "כתובת", type: "text" }, { key: "address_city", label: "עיר", type: "text" }, { key: "phone", label: "טלפון", type: "text" }, { key: "email", label: "דוא\"ל", type: "email" }, { key: "payment_terms_days", label: "תנאי תשלום (ימים)", type: "number" }, { key: "notes", label: "הערות", type: "text" }, { key: "is_active", label: "פעיל", type: "bool" }] },
  { key: "projects", label: "פרויקטים", order: 5, naturalKey: ["work_number"], columns: [wn, { key: "name", label: "שם הפרויקט", type: "text", required: true }, { key: "client_name", label: "לקוח", type: "text", required: true }, { key: "paying_client_name", label: "לקוח משלם", type: "text" }, { key: "project_manager_email", label: "מנהל פרויקט (דוא\"ל)", type: "email" }, { key: "department_code", label: "קוד מחלקה", type: "text" }, { key: "status_code", label: "סטטוס", type: "enum", enum: ["draft", "active", "on_hold", "completed", "cancelled"] }, { key: "start_date", label: "תאריך התחלה", type: "date" }, { key: "target_date", label: "תאריך יעד", type: "date" }, { key: "actual_end_date", label: "תאריך סיום", type: "date" }, { key: "description", label: "תיאור", type: "text" }, { key: "notes", label: "הערות", type: "text" }] },
  {
    key: "contracts", label: "חוזים", order: 6, naturalKey: ["work_number", "direction", "contract_number"],
    columns: [
      wn, dir, cn, { key: "name", label: "שם החוזה", type: "text", required: true }, { key: "client_name", label: "לקוח (לחוזה לקוח)", type: "text" }, { key: "paying_client_name", label: "לקוח משלם", type: "text" }, { key: "supplier_name", label: "ספק (לחוזה ספק)", type: "text" },
      { key: "order_number", label: "מס' הזמנה", type: "text" }, { key: "contract_type_code", label: "סוג חוזה", type: "enum", enum: ["fixed_price", "hourly", "retainer", "pct_of_cost", "per_unit", "mixed"] }, { key: "status_code", label: "סטטוס", type: "enum", enum: ["draft", "active", "on_hold", "completed", "cancelled"] },
      { key: "signed_date", label: "תאריך חתימה", type: "date" }, { key: "opening_date", label: "תאריך פתיחה", type: "date" }, { key: "target_date", label: "תאריך יעד", type: "date" }, { key: "actual_end_date", label: "תאריך סיום", type: "date" },
      { key: "index_linked", label: "הצמדה למדד", type: "bool" }, { key: "index_base_month", label: "חודש בסיס (MM/YYYY)", type: "month" }, { key: "index_floor", label: "רצפת מדד", type: "bool" }, { key: "participates_in_hours", label: "משתתף בדיווח שעות", type: "bool" }, { key: "retention_pct", label: "עכבון %", type: "pct" }, { key: "budget_amount", label: "תקציב (ספק)", type: "money" }, { key: "is_locked", label: "נעול", type: "bool" }, { key: "description", label: "תיאור", type: "text" }, { key: "notes", label: "הערות", type: "text" },
    ],
  },
  {
    key: "sub_contracts", label: "תתי-חוזים", order: 7, naturalKey: ["work_number", "direction", "contract_number", "sub_contract_number"],
    columns: [
      wn, dir, cn, scn, { key: "name", label: "שם", type: "text", required: true }, { key: "is_default", label: "תת-חוזה יחיד (ללא תתי-חוזים)", type: "bool" }, { key: "pricing_method", label: "שיטת תמחור", type: "enum", enum: ["fixed_price", "hourly", "retainer", "pct_of_cost", "per_unit"], required: true },
      { key: "base_price", label: "מחיר בסיס", type: "money" }, { key: "discount_pct", label: "% הנחה", type: "pct" }, { key: "hourly_mode", label: "מצב שעתי", type: "enum", enum: ["rate_card", "custom"] }, { key: "custom_hourly_rate", label: "תעריף אחיד", type: "money" }, { key: "hours_cap", label: "תקרת שעות", type: "number" }, { key: "amount_cap", label: "תקרת סכום", type: "money" },
      { key: "monthly_amount", label: "סכום חודשי", type: "money" }, { key: "retainer_start", label: "ריטיינר מתאריך", type: "date" }, { key: "retainer_end", label: "ריטיינר עד", type: "date" }, { key: "fee_pct", label: "% שכ\"ט", type: "pct" }, { key: "cost_estimate", label: "אומדן עלות (ל-% מעלות)", type: "money" }, { key: "unit_type_code", label: "סוג יחידה", type: "enum", enum: ["parking", "km", "junction", "dunam"] }, { key: "unit_price", label: "מחיר ליחידה", type: "money" }, { key: "agreed_quantity", label: "כמות מוסכמת", type: "number" },
      { key: "status_code", label: "סטטוס", type: "enum", enum: ["draft", "active", "on_hold", "completed", "cancelled"] }, { key: "opening_date", label: "תאריך פתיחה", type: "date" }, { key: "department_code", label: "מרכז רווח (קוד מחלקה)", type: "text" }, { key: "index_linked", label: "הצמדה", type: "bool" }, { key: "index_floor", label: "רצפת מדד", type: "bool" }, { key: "participates_in_hours", label: "משתתף בדיווח", type: "bool" }, { key: "is_locked", label: "נעול", type: "bool" }, { key: "notes", label: "הערות", type: "text" },
      { key: "admiral_submitted", label: "הוגש באדמירל (לדוח פערים)", type: "money", note: "אופציונלי" }, { key: "admiral_paid", label: "שולם באדמירל (לדוח פערים)", type: "money", note: "אופציונלי" }, { key: "admiral_remaining", label: "יתרה באדמירל (לדוח פערים)", type: "money", note: "אופציונלי" },
    ],
  },
  { key: "milestones", label: "אבני דרך", order: 8, naturalKey: ["work_number", "direction", "contract_number", "sub_contract_number", "sort_order"], columns: [wn, dir, cn, scn, { key: "sort_order", label: "#", type: "number", required: true }, { key: "stage_name", label: "שלב", type: "text", required: true }, { key: "pct", label: "% מתת-חוזה", type: "pct", required: true }, { key: "discount_pct", label: "% הנחה (דריסה)", type: "pct" }, { key: "opening_billed_pct", label: "יתרת פתיחה – הוגש %", type: "pct", note: "לא יחד עם ייבוא חשבונות לאותו תת-חוזה" }, { key: "opening_paid_amount", label: "יתרת פתיחה – שולם ₪", type: "money" }, { key: "expected_date", label: "תאריך צפוי", type: "date" }, { key: "notes", label: "הערות", type: "text" }] },
  { key: "time_entries", label: "דיווחי שעות", order: 9, naturalKey: [], columns: [{ key: "user_email", label: "דוא\"ל עובד", type: "email", required: true }, wn, { ...cn, required: false, note: "ברירת מחדל 1" }, { ...scn, required: false, note: "ברירת מחדל 1" }, { key: "work_date", label: "תאריך", type: "date", required: true }, { key: "hours", label: "שעות (עשרוני, או HH:MM)", type: "text", required: true, example: "8.5" }, { key: "description", label: "תיאור", type: "text", required: true }, { key: "start_time", label: "התחלה", type: "time" }, { key: "end_time", label: "סיום", type: "time" }, { key: "reported_by_email", label: "דווח ע\"י (דוא\"ל)", type: "email" }] },
  {
    key: "invoices", label: "חשבונות היסטוריים", order: 10, naturalKey: ["invoice_number"],
    columns: [
      { key: "invoice_number", label: "מס' חשבון", type: "text", required: true, example: "16835" }, wn, { ...cn, required: false, note: "ברירת מחדל 1" }, { key: "partial_number", label: "חשבון חלקי מס'", type: "number", required: true }, { key: "kind", label: "סוג", type: "enum", enum: ["proforma", "credit"], example: "proforma" }, { key: "credit_of_invoice_number", label: "זיכוי לחשבון", type: "text" },
      { key: "invoice_date", label: "תאריך", type: "date", required: true }, { key: "due_date", label: "תאריך יעד", type: "date" }, { key: "status", label: "סטטוס", type: "enum", enum: ["sent", "partially_paid", "paid", "cancelled"], required: true }, { key: "subject", label: "הנדון", type: "text" },
      { key: "subtotal_base", label: "סה\"כ חשבון נוכחי (בסיס)", type: "money", required: true }, { key: "index_base_month", label: "חודש מדד בסיס", type: "month" }, { key: "index_month", label: "חודש מדד", type: "month" }, { key: "index_diff", label: "הפרשי הצמדה", type: "money" }, { key: "retention_amount", label: "עכבון", type: "money" }, { key: "before_vat", label: "לפני מע\"מ", type: "money", required: true }, { key: "vat_rate", label: "שיעור מע\"מ", type: "pct", required: true }, { key: "vat_amount", label: "מע\"מ", type: "money", required: true }, { key: "total", label: "סה\"כ", type: "money", required: true }, { key: "notes", label: "הערות", type: "text" }, { key: "pdf_file", label: "שם קובץ PDF ב-zip", type: "text" },
    ],
  },
  { key: "invoice_lines", label: "שורות חשבונות היסטוריים", order: 10, naturalKey: [], columns: [{ key: "invoice_number", label: "מס' חשבון", type: "text", required: true }, { ...scn, required: false, note: "ברירת מחדל 1" }, { key: "line_type", label: "סוג שורה", type: "enum", enum: ["milestone", "hours", "retainer", "unit", "extra", "adjustment"], required: true }, { key: "milestone_sort_order", label: "# אבן דרך", type: "number" }, { key: "description", label: "תיאור", type: "text" }, { key: "progress_pct_this", label: "% בחשבון זה", type: "pct" }, { key: "cumulative_pct", label: "% מצטבר", type: "pct" }, { key: "amount_this", label: "סכום בחשבון", type: "money", required: true }, { key: "cumulative_amount", label: "סכום מצטבר", type: "money" }, { key: "hours", label: "שעות", type: "number" }, { key: "hourly_rate", label: "תעריף", type: "money" }, { key: "quantity", label: "כמות", type: "number" }, { key: "unit_price", label: "מחיר יחידה", type: "money" }] },
  { key: "receipts", label: "תקבולים", order: 11, naturalKey: ["receipt_key"], columns: [{ key: "receipt_key", label: "מפתח תקבול (ייחודי, לשיוך)", type: "text", required: true, example: "R-1001" }, { key: "client_name", label: "לקוח", type: "text", required: true }, { key: "receipt_date", label: "תאריך", type: "date", required: true }, { key: "amount", label: "סכום", type: "money", required: true }, { key: "method", label: "אמצעי", type: "enum", enum: ["transfer", "check", "credit_card", "cash", "other"] }, { key: "reference", label: "אסמכתא", type: "text" }, { key: "notes", label: "הערות", type: "text" }] },
  { key: "receipt_allocations", label: "שיוך תקבולים לחשבונות", order: 11, naturalKey: ["receipt_key", "invoice_number"], columns: [{ key: "receipt_key", label: "מפתח תקבול", type: "text", required: true }, { key: "invoice_number", label: "מס' חשבון", type: "text", required: true }, { key: "amount", label: "סכום מוקצה", type: "money", required: true }] },
  { key: "supplier_invoices", label: "חשבוניות ספקים", order: 12, naturalKey: ["work_number", "contract_number", "supplier_invoice_number"], columns: [wn, cn, { key: "supplier_invoice_number", label: "מס' חשבונית", type: "text", required: true }, { key: "invoice_date", label: "תאריך", type: "date", required: true }, { key: "received_date", label: "תאריך קבלה", type: "date" }, { key: "amount_before_vat", label: "לפני מע\"מ", type: "money", required: true }, { key: "vat_amount", label: "מע\"מ", type: "money" }, { key: "total", label: "סה\"כ", type: "money" }, { key: "description", label: "תיאור", type: "text" }, { key: "progress_pct_claimed", label: "% ביצוע נטען", type: "pct" }, { key: "status", label: "סטטוס", type: "enum", enum: ["pending", "approved", "rejected", "paid"], required: true }, { key: "paid_date", label: "תאריך תשלום", type: "date" }, { key: "notes", label: "הערות", type: "text" }] },
];

export function getEntity(key: string): ImportEntity | undefined {
  return IMPORT_ENTITIES.find((e) => e.key === key);
}
