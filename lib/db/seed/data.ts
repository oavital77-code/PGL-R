/** Seed data (spec §5). Idempotent – matched by `code` / `name`. */

export const DEPARTMENTS = [1, 2, 3, 4, 5, 6].map((n) => ({ name: `מחלקה ${n}`, code: `D${n}`, sortOrder: n }));

export const CONTRACT_STATUSES = [
  { code: "draft", name: "טיוטה", sortOrder: 1, isTerminal: false },
  { code: "active", name: "בעבודה", sortOrder: 2, isTerminal: false },
  { code: "on_hold", name: "מוקפא", sortOrder: 3, isTerminal: false },
  { code: "completed", name: "הסתיים", sortOrder: 4, isTerminal: true },
  { code: "cancelled", name: "מבוטל", sortOrder: 5, isTerminal: true },
];

export const CONTRACT_TYPES = [
  { code: "fixed_price", name: "פיקס פרייס", sortOrder: 1 },
  { code: "hourly", name: "לפי שעות", sortOrder: 2 },
  { code: "retainer", name: "ריטיינר", sortOrder: 3 },
  { code: "pct_of_cost", name: "אחוז מעלות פרויקט", sortOrder: 4 },
  { code: "per_unit", name: "לפי יחידות", sortOrder: 5 },
  { code: "mixed", name: "מעורב", sortOrder: 6 },
];

export const UNIT_TYPES = [
  { code: "parking", name: "חניה", sortOrder: 1 },
  { code: "km", name: "ק\"מ", sortOrder: 2 },
  { code: "junction", name: "צומת", sortOrder: 3 },
  { code: "dunam", name: "דונם", sortOrder: 4 },
];

export const DOCUMENT_TYPES = [
  { code: "signed_contract", name: "חוזה חתום", sortOrder: 1 },
  { code: "work_order", name: "הזמנת עבודה", sortOrder: 2 },
  { code: "correspondence", name: "תכתובת", sortOrder: 3 },
  { code: "invoice", name: "חשבונית", sortOrder: 4 },
  { code: "other", name: "אחר", sortOrder: 99 },
];

export const STAGE_NAMES = [
  "לימוד מצב קיים",
  "הכנת חלופות",
  "בחירה ועיבוד חלופה",
  "עיבוד החלופה הנבחרת",
  "הגשה לוועדות",
  "הפקדה",
  "התנגדויות",
  "מתן תוקף",
  "עיבוד אישור רשויות",
  "הכנת תכנית עבודה",
  "פיקוח עליון",
  "תכנון מוקדם",
  "תכנון סופי",
  "נספח תנועה",
  "השלמת תכנון מוקדם",
  "השלמת תכנון סופי",
  "אישור נספח תנועה להיתר",
  "הכנת תכניות עבודה לביצוע",
];

export const STAGE_TEMPLATES: { name: string; items: { stage: string; pct: number }[] }[] = [
  {
    name: "תב\"ע",
    items: [
      { stage: "לימוד מצב קיים", pct: 10 },
      { stage: "הכנת חלופות", pct: 15 },
      { stage: "בחירה ועיבוד חלופה", pct: 25 },
      { stage: "הגשה לוועדות", pct: 15 },
      { stage: "הפקדה", pct: 10 },
      { stage: "התנגדויות", pct: 15 },
      { stage: "מתן תוקף", pct: 10 },
    ],
  },
  {
    name: "תכנון מפורט",
    items: [
      { stage: "השלמת תכנון מוקדם", pct: 15 },
      { stage: "השלמת תכנון סופי", pct: 20 },
      { stage: "אישור נספח תנועה להיתר", pct: 25 },
      { stage: "הכנת תכניות עבודה לביצוע", pct: 30 },
      { stage: "פיקוח עליון", pct: 10 },
    ],
  },
];

export const VAT_RATES = [{ rate: "18.00", effectiveFrom: "2025-01-01" }];

export const GRADES = [
  { name: "מהנדס בכיר", sortOrder: 1 },
  { name: "מהנדס", sortOrder: 2 },
  { name: "הנדסאי", sortOrder: 3 },
  { name: "שרטט", sortOrder: 4 },
];
