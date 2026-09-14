# מסמך אפיון – מערכת ניהול פרויקטים, דיווח שעות וחשבונות עבור PGL

| | |
|---|---|
| **גרסה** | 1.0 |
| **תאריך** | 13/09/2026 |
| **מיועד ל** | ביצוע ע"י Claude Code |
| **מחליף את** | מערכת "אדמירל" של חברת פרייסיס |
| **לקוח** | פי.ג'י.אל. הנדסה ותכנון תחבורה בע"מ (PGL) – חברה לתכנון כבישים ותכנון תחבורה בין-עירוני |

> עותק נאמן של מסמך האפיון שנמסר ע"י הלקוח. זהו מקור האמת; סטיות מתועדות ב-`DEVIATIONS.md`.

---

## 0. איך לקרוא את המסמך הזה

1. **מסמך זה הוא מקור האמת.** כל דבר שכתוב כאן הוא דרישה לביצוע. אין לנחש, לפרש בחופשיות או "לשפר" דרישה בלי לתעד סטייה בקובץ `DEVIATIONS.md` בשורש הריפו.
2. **"החלטה"** = החלטת אפיון סופית. **"הנחה"** = החלטה שהתקבלה בהיעדר מידע מהלקוח; יש לממש בדיוק כפי שכתוב, והיא מרוכזת גם בפרק 19 לאישור.
3. כל טקסט ממשק בעברית (ברירת מחדל) עם מפתחות תרגום לאנגלית. אין להשאיר מחרוזות קשיחות בקוד.
4. כל סכומי כסף: `numeric(12,2)`, ש"ח בלבד, עיגול half-up לשתי ספרות. אחוזים: `numeric(6,3)`. תאריכים: אזור זמן `Asia/Jerusalem`, תצוגה `dd/mm/yyyy`.
5. כל גישה לנתונים מתבצעת **בצד שרת בלבד** (Server Actions / Route Handlers). אין גישה ישירה מהדפדפן ל-Supabase.
6. **מנוע החישובים** (אבני דרך, הצמדה, מע"מ, יתרות, רווחיות) חייב להיות מודול טהור (`/lib/calc/*`) עם בדיקות יחידה מלאות. אין לפזר לוגיקת חישוב ברכיבי UI.
7. סדר הפיתוח המחייב מופיע בפרק 18. אין לדלג על שלב 0.

---

## 1. רקע ומטרה

PGL מנהלת כיום את החוזים, דיווחי השעות, החשבונות והדוחות במערכת "אדמירל". המערכת החדשה מחליפה אותה במלואה, כולל הגירה של היסטוריה מלאה.

### 1.1 ארבעת המודולים המרכזיים
| מודול | תמצית |
|---|---|
| **חוזים** | לקוחות, ספקים (נותני שירות), פרויקטים, חוזים, תתי-חוזים, שיטות תמחור, אבני דרך, מסמכים, בעלי תפקידים, הערות סטטוס |
| **דיווח שעות** | כרטיס שעות לעובד לפי תת-חוזה, תצוגות יומית/שבועית/חודשית, נעילת תקופות, תזכורות, דיווח ע"י מנהל |
| **חשבונות** | חשבונות עסקה לפי אבני דרך/שעות/ריטיינר/יחידות, הצמדה למדד, מע"מ, חתימה דיגיטלית, שליחת מייל, תקבולים, זיכויים, חשבוניות ספקים, ייצוא להנה"ח |
| **דוחות** | מחולל דוחות במסך אחד, דשבורד, ייצוא Excel/PDF/הדפסה, דוחות מתוזמנים במייל |

### 1.2 היררכיית הישויות (החלטה)

```
לקוח (client)
 └─ פרויקט (project) – מס' עבודה ייחודי, למשל 3489
     ├─ חוזה לקוח (contract, direction=income) – מס' חוזה בפרויקט: 1, 2, ...
     │    └─ תת-חוזה (sub_contract) – מס' תת-חוזה בחוזה: 1, 2, ...  [שיטת תמחור]
     │         └─ אבן דרך (milestone) – שלב + % מהתת-חוזה
     └─ חוזה ספק (contract, direction=expense) – נותן שירות במיקור חוץ
          └─ תת-חוזה → אבני דרך (מבנה זהה)

עובד ──דיווח שעות──▶ תת-חוזה (רק תתי-חוזים שהוקצו לו)
חשבון עסקה ──▶ חוזה לקוח (כולל תתי-חוזים נבחרים או כולם)
חשבונית ספק ──▶ חוזה ספק
```

**החלטה – חוזה ללא תתי-חוזים:** לכל חוזה יש לפחות תת-חוזה אחד. כאשר המשתמש יוצר חוזה ובוחר "ללא תתי-חוזים", המערכת יוצרת אוטומטית תת-חוזה יחיד עם `is_default = true`, ששמו כשם החוזה. במקרה זה מסך החוזה מציג את שיטת התמחור ואבני הדרך ישירות (ללא טאב תתי-חוזים), ודיווח השעות מוצג ברמת החוזה. אם המשתמש מוסיף אח"כ תת-חוזה נוסף, ה-default הופך לתת-חוזה רגיל מס' 1 והממשק עובר למצב תתי-חוזים. כך כל הלוגיקה (שעות, חשבונות, דוחות) עובדת תמיד מול `sub_contract_id`.

---

## 2. סטאק טכנולוגי וארכיטקטורה

### 2.1 טכנולוגיות (החלטה)
| שכבה | בחירה | הערות |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript strict** | RSC + Server Actions |
| UI | **Tailwind CSS + shadcn/ui** | תמיכת RTL מלאה (`dir="rtl"` ברמת `<html>`, שימוש ב-logical properties: `ms-`, `me-`, `ps-`, `pe-`, `start`, `end`) |
| טבלאות | **TanStack Table** | מיון, סינון, קיבוץ, הרחבה היררכית, virtualization לדוחות גדולים |
| גרפים | **Recharts** | עמודות, קווים, עוגות |
| טפסים/ולידציה | **react-hook-form + zod** | סכמות zod משותפות לקליינט ולשרת (`/lib/schemas/*`) |
| DB | **Supabase Postgres** | סכמה מנוהלת ב-**Drizzle ORM** + migrations בתיקיית `/drizzle` |
| Storage | **Supabase Storage** (buckets פרטיים) | ראה 2.4 |
| Auth | **Clerk** | אימייל+סיסמה, Google, MFA (TOTP + backup codes) |
| Email | **Resend** | דומיין מאומת, webhooks לאירועי delivered/opened/bounced |
| PDF | **Playwright (chromium) + @sparticuz/chromium** | HTML/CSS → PDF, RTL מלא, גופן עברי מוטמע (Assistant/Heebo, self-hosted ב-`/public/fonts`) |
| i18n | **next-intl** | `he` ברירת מחדל, `en` נתמך; locale נשמר בפרופיל המשתמש |
| Jobs | **Vercel Cron** → Route Handlers מאובטחים ב-`CRON_SECRET` | ראה 2.6 |
| Excel | **exceljs** | ייצוא דוחות + תבניות ייבוא |
| Deploy | **Vercel** (Production + Preview) | ענפים: `main` = production, `dev` = preview |
| Tests | **Vitest** (unit, חובה למנוע חישובים) + **Playwright** (e2e לתהליכים קריטיים) | |

### 2.2 עקרונות ארכיטקטורה (החלטה)
1. **Server-only data access.** כל קריאה ל-DB דרך `service_role` בצד שרת. RLS מופעל על כל הטבלאות עם מדיניות `deny all` ל-`anon` ו-`authenticated` – שכבת הגנה נוספת בלבד.
2. **שכבת הרשאות מרכזית:** `lib/auth/authorize.ts` – פונקציה `can(user, capability, context?)`. כל Server Action מתחיל ב-`requireCapability(...)`. אין בדיקות הרשאה מפוזרות ב-UI בלבד.
3. **Audit אוטומטי:** טריגרים ב-Postgres על כל טבלה עסקית כותבים ל-`audit_log` (ראה פרק 14). המשתמש המבצע מועבר דרך `SET LOCAL app.user_id` בתחילת כל טרנזקציה.
4. **מנוע חישוב טהור:** `lib/calc/milestones.ts`, `lib/calc/index-linkage.ts`, `lib/calc/vat.ts`, `lib/calc/balances.ts`, `lib/calc/profitability.ts` – פונקציות ללא תלות ב-DB, עם fixtures מבוססי הדוגמאות בפרק 11.9.
5. **מזהים:** `uuid` לכל טבלה. מספרים "אנושיים" (מס' עבודה, מס' חשבון) הם שדות נפרדים עם unique constraint.
6. **Soft delete** לישויות עסקיות (`deleted_at`) – מחיקה פיזית אסורה למעט טיוטות.

### 2.3 סנכרון משתמשים Clerk ↔ DB
- Webhook של Clerk (`user.created`, `user.updated`, `user.deleted`) מעדכן טבלת `users`.
- יצירת משתמש חדש **רק ע"י אדמין** מתוך המערכת (`/admin/users` → "הזמן משתמש") – יוצר Invitation ב-Clerk + רשומה ב-`users` עם התפקיד והמחלקה. הרשמה עצמית (public sign-up) **מבוטלת** ב-Clerk.
- MFA: הגדרה `security.mfa_required_roles` (ברירת מחדל: `["admin"]`). משתמש בתפקיד שדורש MFA ולא הפעיל – מופנה בכניסה למסך הפעלת MFA ולא יכול להמשיך.
- Google OAuth: מותר רק לכתובות שכבר קיימות ב-`users` (אין יצירת חשבון דרך Google).

### 2.4 ניהול קבצים (החלטה + המלצה)
נפח הקבצים צפוי להיות גדול מאוד (חוזים, הזמנות, תכתובות, PDF חשבונות, חשבוניות ספקים, ייבוא היסטורי).
1. **Buckets פרטיים ב-Supabase Storage:** `contracts`, `invoices`, `supplier-invoices`, `general-docs`, `signatures`, `company`, `imports`, `report-exports`.
2. **מבנה נתיב:** `{bucket}/{yyyy}/{entity_type}/{entity_id}/{document_id}__{original_name}`. שם מקורי נשמר ב-DB, לא בנתיב (הימנעות מבעיות תווים עבריים).
3. **גישה:** URL חתומים (signed URLs) שנוצרים בשרת לאחר בדיקת הרשאה, תוקף 10 דקות. אין URL ציבורי לאף קובץ.
4. **מגבלות:** גודל קובץ עד 50MB; סוגים מותרים: pdf, doc/docx, xls/xlsx, dwg, dxf, png, jpg, msg, eml, zip. רשימה ניתנת לעריכה ב-`settings.files.allowed_extensions`.
5. **גרסאות:** טבלת `documents` תומכת ב-`version` ו-`supersedes_document_id`. העלאת גרסה חדשה לא מוחקת את הקודמת.
6. **שמירה 10 שנים:** אין מחיקה פיזית של קבצים. מחיקה ע"י משתמש = `deleted_at` + הסתרה.
7. **גיבוי חיצוני (המלצה מחייבת):** job לילי מעתיק קבצים חדשים/שהשתנו ל-bucket חיצוני S3-compatible (**Cloudflare R2** – ללא עלויות egress) עם Object Lock/versioning. גיבוי DB: Supabase PITR מופעל + dump לוגי שבועי (`pg_dump`) ל-R2. מפתחות R2 במשתני סביבה.
8. **סריקת קבצים:** בדיקת MIME אמיתית (magic bytes) בשרת לפני שמירה; דחיית קבצי הרצה.

### 2.5 משתני סביבה (רשימה מחייבת)
```
DATABASE_URL, DIRECT_URL
NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET
RESEND_API_KEY, RESEND_WEBHOOK_SECRET
CRON_SECRET
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
CBS_API_BASE_URL (ברירת מחדל: https://api.cbs.gov.il)
APP_BASE_URL
```

### 2.6 משימות מתוזמנות (Vercel Cron)
| Job | תדירות | תיאור |
|---|---|---|
| `hours-reminders` | יומי 09:00 | תזכורות לעובדים שלא דיווחו (פרק 10.8) |
| `period-lock` | יומי 00:10 | נעילת חודשים שהסתיים חלון העריכה שלהם (פרק 10.7) |
| `retainer-invoices` | יומי 06:00 | יצירת טיוטות חשבון ריטיינר ביום החיוב (פרק 11.6.3) |
| `cbs-index-fetch` | יומי 08:00 בימים 15–20 בחודש | משיכת מדד המחירים לצרכן מהלמ"ס עד שמתקבל ערך לחודש הקודם (פרק 11.7) |
| `invoice-aging` | יומי 07:00 | התראות חשבונות באיחור (פרק 11.12) |
| `contract-alerts` | יומי 07:30 | התראות התקדמות חוזה, ספק חורג (פרק 13) |
| `scheduled-reports` | כל שעה | הרצת דוחות מתוזמנים שהגיע זמנם (פרק 12.6) |
| `files-backup` | לילי 02:00 | גיבוי קבצים ל-R2 (2.4) |
| `db-dump` | שבועי, ראשון 03:00 | dump לוגי ל-R2 |

### 2.7 מבנה תיקיות
```
/app
  /(auth)            – מסכי כניסה/MFA (Clerk)
  /(app)             – layout ראשי עם ניווט
    /dashboard
    /hours             – כרטיס שעות (שלי / עובד אחר)
    /projects, /projects/[id]
    /contracts/[id], /sub-contracts/[id]
    /clients, /clients/[id]
    /suppliers, /suppliers/[id]
    /invoices, /invoices/new, /invoices/[id]
    /receipts
    /supplier-invoices
    /reports
    /settings/*        – אשף והגדרות (אדמין)
    /admin/users, /admin/audit, /admin/import
  /api/webhooks/{clerk,resend}
  /api/cron/*
  /api/files/[documentId]   – הנפקת signed URL
/lib
  /calc      – מנוע חישובים טהור
  /auth      – authorize, capabilities
  /db        – drizzle schema, queries
  /pdf       – תבניות HTML + מנוע רינדור
  /email     – תבניות + שליחה
  /reports   – הגדרות דוחות (registry) + בוני שאילתות
  /i18n
/drizzle     – migrations
/messages/he.json, /messages/en.json
/tests/unit, /tests/e2e
```

---

## 3. משתמשים, תפקידים והרשאות

### 3.1 שלוש שכבות (החלטה)
| תפקיד | ברירת מחדל |
|---|---|
| **admin** | הכל. כולל הגדרות, משתמשים, פתיחת תקופות נעולות, חשבונות, יומן שינויים. |
| **manager** | דיווח שעות (לעצמו ולעובדים אחרים) + צפייה בדוחות שעות בלבד. ללא גישה לכספים/חוזים. |
| **employee** | דיווח שעות לעצמו בלבד, צפייה בדיווחים שלו בלבד. |

מנהלי פרויקט **אינם** תפקיד מערכת – זהו שדה בפרויקט (`project_manager_user_id`) לצורכי דיווח והתראות בלבד, ללא הרשאות מיוחדות.

### 3.2 מטריצת יכולות (Capabilities)
האדמין יכול להפעיל/לכבות כל יכולת לכל שכבה ב-`/settings/permissions`. יכולות המסומנות 🔒 הן אדמין-בלבד ואינן ניתנות להאצלה.

| יכולת (מפתח) | admin | manager | employee | הערות |
|---|---|---|---|---|
| `hours.report_own` | ✔ | ✔ | ✔ | |
| `hours.report_for_others` | ✔ | ✔ | ✖ | היקף: `hours.others_scope` = `department` / `all` (ברירת מחדל למנהל: `all`) |
| `hours.view_others` | ✔ | ✔ | ✖ | אותו היקף |
| `hours.edit_locked` 🔒 | ✔ | ✖ | ✖ | עריכה/פתיחה של תקופה נעולה |
| `reports.hours` | ✔ | ✔ | ✖ | קבוצת דוחות שעות (ללא עלויות/כספים) |
| `reports.financial` | ✔ | ✖ | ✖ | רווחיות, יתרות, גיול, שכר |
| `reports.schedule` | ✔ | ✖ | ✖ | |
| `clients.view` / `clients.edit` | ✔ | ✖ | ✖ | |
| `suppliers.view` / `suppliers.edit` | ✔ | ✖ | ✖ | |
| `projects.view` / `projects.edit` | ✔ | ✖ | ✖ | |
| `contracts.view` / `contracts.edit` | ✔ | ✖ | ✖ | |
| `contracts.unlock` 🔒 | ✔ | ✖ | ✖ | פתיחת תת-חוזה נעול |
| `assignments.manage` | ✔ | ✖ | ✖ | הקצאת עובדים לתתי-חוזים |
| `invoices.view` / `invoices.create` / `invoices.approve` / `invoices.sign` / `invoices.send` / `invoices.cancel` | ✔ | ✖ | ✖ | |
| `receipts.manage` | ✔ | ✖ | ✖ | |
| `supplier_invoices.manage` / `supplier_invoices.approve` | ✔ | ✖ | ✖ | מאשרים בפועל מוגדרים ב-settings |
| `dashboard.financial` | ✔ | ✖ | ✖ | |
| `settings.manage` 🔒, `users.manage` 🔒, `audit.view` 🔒, `import.run` 🔒 | ✔ | ✖ | ✖ | |

### 3.3 כללי יישום
- כל Server Action: `const user = await requireCapability('invoices.create')`.
- הניווט מציג רק פריטים שלמשתמש יש יכולת עבורם.
- שינוי במטריצה נכנס לתוקף מיידית (ללא cache מעבר ל-60 שניות).
- משתמש לא פעיל (`is_active=false` או `employment_end < today`) לא יכול להיכנס; הנתונים ההיסטוריים שלו נשמרים ומופיעים בדוחות.

---

## 4. מפת מסכים וניווט

| נתיב | תפקידים | תוכן |
|---|---|---|
| `/dashboard` | כולם | דשבורד לפי תפקיד (פרק 12.7) |
| `/hours` | כולם | כרטיס שעות – ברירת מחדל: המשתמש הנוכחי, שבוע נוכחי |
| `/hours?user=…` | manager/admin | כרטיס שעות של עובד אחר |
| `/projects` | admin | רשימת פרויקטים + חיפוש + סינון |
| `/projects/[id]` | admin | פרויקט: פרטים, חוזי לקוח, חוזי ספק, מסמכים, צוות, סיכומים |
| `/contracts/[id]` | admin | חוזה: כותרת פיננסית, טאבים: תתי-חוזים / הערות סטטוס / בעלי תפקידים / מסמכים / חשבונות / היסטוריה |
| `/sub-contracts/[id]` | admin | תת-חוזה: תמחור, אבני דרך, צוות, שעות, חשבונות, היסטוריית שינויים |
| `/clients`, `/clients/[id]` | admin | לקוחות, אנשי קשר, חוזים, חשבונות, תקבולים, גיול |
| `/suppliers`, `/suppliers/[id]` | admin | ספקים, אנשי קשר, חוזי ספק, חשבוניות ספק |
| `/invoices`, `/invoices/new`, `/invoices/[id]` | admin | חשבונות עסקה |
| `/receipts` | admin | תקבולים ושיוך לחשבונות |
| `/supplier-invoices` | admin | חשבוניות ספקים ואישורן |
| `/reports` | admin, manager | מחולל דוחות (פרק 12) |
| `/settings/*` | admin | אשף + הגדרות (פרק 6) |
| `/admin/users` | admin | ניהול משתמשים |
| `/admin/audit` | admin | יומן שינויים |
| `/admin/import` | admin | ייבוא מאדמירל |

**חיפוש גלובלי** (Ctrl+K / שדה בכותרת): לפי מס' עבודה, שם פרויקט, שם לקוח, מס' חשבון, שם ספק. תוצאות מסוננות לפי הרשאות.

---

## 5. מודל נתונים (סכמת DB)

הערות כלליות: לכל טבלה `id uuid PK default gen_random_uuid()`, `created_at timestamptz`, `updated_at timestamptz`, `created_by uuid → users`, ולישויות עסקיות גם `deleted_at timestamptz null`. אינדקסים על כל FK. שמות בסכמה באנגלית (snake_case).

### 5.1 משתמשים וארגון
```
users
  clerk_user_id text unique not null
  email text unique not null
  first_name text not null, last_name text not null
  role enum('admin','manager','employee') not null
  department_id uuid → departments (null מותר לאדמין)
  grade_id uuid → grades null                  -- דרגה לתעריף חיוב
  standard_hours_per_day numeric(4,2)          -- ברירת מחדל מ-settings.hours.default_standard_hours_per_day
  work_days int[] default '{0,1,2,3,4}'        -- 0=ראשון ... 6=שבת
  employment_start date, employment_end date null
  is_active bool default true
  locale enum('he','en') default 'he'
  phone text null
  signature_image_path text null               -- לאדמינים בלבד
  signature_title text null                    -- "כלכלן", "מנכ"ל" – מוטבע ליד החתימה
  external_payroll_id text null                -- מזהה עובד לחשבת שכר

employee_cost_rates                            -- עלות שעתית (כולל תקורה) עם היסטוריה
  user_id → users, hourly_cost numeric(10,2), effective_from date
  unique(user_id, effective_from)
  -- העלות בתוקף לתאריך X = הרשומה עם effective_from המאוחר ביותר ≤ X

departments                                    -- משמש גם כ"מרכז רווח" (ראה 19)
  name text, code text unique, is_active bool, sort_order int
  seed: מחלקה 1 … מחלקה 6 (קודים D1..D6)

grades                                         -- דרגות לתעריף חיוב שעתי
  name text, is_active bool, sort_order int

billing_rates                                  -- כרטיס תעריפים גלובלי
  grade_id → grades, hourly_rate numeric(10,2), effective_from date
  unique(grade_id, effective_from)
```

### 5.2 לקוחות וספקים
```
clients
  name text not null
  tax_id text null                             -- ח.פ / ע.מ
  client_kind enum('company','authority','private','other') default 'company'
  address_street, address_city, address_zip, phone, email, website  (text null)
  payment_terms_days int null                  -- null = ברירת מחדל מ-settings.invoices.default_payment_terms_days
  index_linked_default bool null               -- null = אין ברירת מחדל (יש לבחור בחוזה)
  vat_exempt bool default false
  withholding_tax_pct numeric(5,2) null        -- ניכוי מס במקור
  withholding_valid_until date null            -- תוקף אישור ניכוי במקור
  notes text, is_active bool default true

suppliers
  name, tax_id, field text null                -- תחום (ניקוז, חשמל, נוף…) – הזנה חופשית
  address_*, phone, email, payment_terms_days, notes, is_active

contacts
  client_id → clients null, supplier_id → suppliers null   -- check: בדיוק אחד מהם
  first_name, last_name, role_title, email, phone
  receives_invoices bool default false         -- נמען לחשבונות במייל
  is_primary bool default false
```

### 5.3 פרויקטים, חוזים, תתי-חוזים, אבני דרך
```
projects
  work_number text unique not null             -- מס' עבודה (ידני/אוטומטי לפי settings)
  name text not null
  client_id → clients not null
  paying_client_id → clients null              -- null = זהה ל-client_id
  project_manager_user_id → users null
  department_id → departments null
  status_id → contract_statuses               -- מחושב מהחוזים (ראה 8.1.5) עם אפשרות דריסה ידנית
  status_manual bool default false
  description text, start_date date, target_date date, actual_end_date date
  notes text

contract_statuses  (lookup)
  name text, code text unique, is_active, sort_order, is_terminal bool
  seed: draft/טיוטה, active/בעבודה, on_hold/מוקפא, completed/הסתיים, cancelled/מבוטל

contract_types     (lookup)
  name, code unique, is_active, sort_order
  seed: fixed_price/פיקס פרייס, hourly/לפי שעות, retainer/ריטיינר, pct_of_cost/אחוז מעלות פרויקט,
        per_unit/לפי יחידות, mixed/מעורב

contracts
  project_id → projects not null
  direction enum('income','expense') not null  -- income=חוזה לקוח, expense=חוזה ספק
  client_id → clients null                     -- חובה כאשר income
  paying_client_id → clients null
  supplier_id → suppliers null                 -- חובה כאשר expense
  number_in_project int not null               -- רץ אוטומטית לכל (project_id, direction)
  unique(project_id, direction, number_in_project)
  name text not null
  order_number text null                       -- מס' הזמנה/חוזה אצל הלקוח
  contract_type_id → contract_types
  status_id → contract_statuses
  status_manual bool default false
  signed_date date, opening_date date, target_date date, actual_end_date date
  description text
  currency char(3) default 'ILS'  (קבוע)
  index_linked bool default false
  index_base_month date null                   -- תמיד היום הראשון בחודש; חובה אם index_linked
  index_floor bool default false               -- "הגבל רצפת מדד"
  participates_in_hours bool default true
  retention_pct numeric(5,2) null              -- עכבון
  budget_amount numeric(12,2) null             -- לחוזי ספק: תקציב מאושר
  is_locked bool default false                 -- נעילה (רק admin פותח)
  notes text

sub_contracts
  contract_id → contracts not null
  number_in_contract int not null; unique(contract_id, number_in_contract)
  name text not null
  is_default bool default false                -- נוצר אוטומטית לחוזה "ללא תתי-חוזים"
  status_id → contract_statuses
  opening_date date
  department_id → departments null             -- מרכז רווח; null = יורש מהפרויקט
  pricing_method enum('fixed_price','hourly','retainer','pct_of_cost','per_unit') not null
  -- fixed_price:
  base_price numeric(12,2) null
  discount_pct numeric(5,2) default 0
  -- hourly:
  hourly_mode enum('rate_card','custom') null  -- rate_card = לפי דרגת העובד; custom = תעריף אחיד
  custom_hourly_rate numeric(10,2) null
  hours_cap numeric(10,2) null, amount_cap numeric(12,2) null
  -- retainer:
  monthly_amount numeric(12,2) null
  retainer_start date null, retainer_end date null
  retainer_billing_day int null                -- null = settings.invoices.retainer_billing_day
  -- pct_of_cost:
  fee_pct numeric(6,3) null                    -- אחוז שכ"ט מעלות הביצוע
  -- per_unit:
  unit_type_id → unit_types null
  unit_price numeric(12,2) null
  agreed_quantity numeric(12,3) null
  -- כללי:
  index_linked bool                            -- ברירת מחדל מהחוזה
  index_floor bool
  participates_in_hours bool default true
  is_locked bool default false                 -- "חוזה חתום" באדמירל → נעול לעריכה, רק admin פותח
  notes text
  -- מחושבים (לא נשמרים; ראה lib/calc/balances):
  --   total_amount, submitted, paid, open_balance, remaining, progress_pct

project_cost_estimates                         -- עבור pct_of_cost; ניתן גם לתעד שינויי אומדן
  sub_contract_id → sub_contracts
  estimate_type enum('initial','tender','execution','actual','other')
  amount numeric(14,2), effective_from date, note text
  -- האומדן הפעיל = effective_from המאוחר ביותר ≤ היום

unit_types (lookup)
  name, code unique, is_active
  seed: parking/חניה, km/ק"מ, junction/צומת, dunam/דונם

stage_names (lookup)
  name text unique, is_active, sort_order
  seed (מאדמירל): לימוד מצב קיים, הכנת חלופות, בחירה ועיבוד חלופה, עיבוד החלופה הנבחרת, הגשה לוועדות, הפקדה,
       התנגדויות, מתן תוקף, עיבוד אישור רשויות, הכנת תכנית עבודה, פיקוח עליון, תכנון מוקדם, תכנון סופי,
       נספח תנועה, השלמת תכנון מוקדם, השלמת תכנון סופי, אישור נספח תנועה להיתר, הכנת תכניות עבודה לביצוע

stage_templates                                -- תבניות אבני דרך לבחירה בפתיחת תת-חוזה
  name text unique, is_active
stage_template_items
  template_id, stage_name_id, default_pct numeric(6,3), sort_order
  seed:
    "תב"ע": לימוד מצב קיים 10 | הכנת חלופות 15 | בחירה ועיבוד חלופה 25 | הגשה לוועדות 15 | הפקדה 10 |
            התנגדויות 15 | מתן תוקף 10
    "תכנון מפורט": השלמת תכנון מוקדם 15 | השלמת תכנון סופי 20 | אישור נספח תנועה להיתר 25 |
            הכנת תכניות עבודה לביצוע 30 | פיקוח עליון 10

milestones
  sub_contract_id → sub_contracts not null
  sort_order int
  stage_name_id → stage_names null
  name text not null                           -- מועתק מהשלב, ניתן לעריכה
  pct_of_subcontract numeric(6,3) not null     -- % מהתת-חוזה (fixed_price: מה-base_price; pct_of_cost: משכה"ט)
  discount_pct numeric(5,2)                    -- ברירת מחדל = discount_pct של התת-חוזה, ניתן לדריסה
  opening_billed_pct numeric(6,3) default 0    -- יתרת פתיחה: % שכבר חויב לפני המערכת
  opening_paid_amount numeric(12,2) default 0  -- יתרת פתיחה: סכום ששולם לפני המערכת (במחירי בסיס)
  expected_date date null
  notes text
  -- מחושבים: amount = base × pct/100 ; total = amount × (1 − discount_pct/100)

contract_roles                                 -- בעלי תפקידים
  contract_id → contracts
  role_title text not null                     -- הזנה חופשית (בעתיד lookup)
  user_id → users null, contact_id → contacts null, free_name text null
  notes text

contract_notes                                 -- הערות סטטוס (יומן)
  contract_id → contracts, sub_contract_id → sub_contracts null
  user_id → users, body text not null, created_at

documents
  entity_type enum('project','contract','sub_contract','invoice','supplier_invoice','client','supplier','receipt')
  entity_id uuid
  document_type text                           -- חוזה חתום / הזמנת עבודה / תכתובת / חשבונית / אחר (lookup עריך)
  file_name text, storage_bucket text, storage_path text, mime_type text, size_bytes bigint
  version int default 1, supersedes_document_id → documents null
  uploaded_by → users
  index: (entity_type, entity_id)

sub_contract_assignments                       -- צוות: מי רשאי לדווח שעות על התת-חוזה
  sub_contract_id, user_id, assigned_by, assigned_at, is_active bool
  unique(sub_contract_id, user_id)
```

### 5.4 דיווח שעות
```
time_entries
  user_id → users not null
  sub_contract_id → sub_contracts not null
  work_date date not null
  minutes int not null check (minutes > 0 and minutes <= 1440)
  start_time time null, end_time time null    -- אופציונלי; אם שניהם מלאים minutes נגזר מהם
  description text not null check (length(trim(description)) >= 3)
  reported_by_user_id → users not null         -- ≠ user_id כשמנהל/אדמין מדווח בשם עובד
  invoice_id → invoices null                   -- מולא כאשר הדיווח חויב בחשבון שעות
  index: (user_id, work_date), (sub_contract_id, work_date)

period_unlocks                                 -- פתיחה ידנית של חודש נעול
  user_id → users, month date (1 בחודש), unlocked_by → users, unlocked_until timestamptz, reason text
```

### 5.5 חשבונות, תקבולים, מדדים
```
index_values                                   -- מדד המחירים לצרכן
  month date unique (1 בחודש), value numeric(10,4), source enum('cbs_api','manual'),
  fetched_at timestamptz, entered_by → users null

vat_rates
  rate numeric(5,2), effective_from date unique
  seed: 18.00 מתאריך 01/01/2025  (אדמין מתקן באשף)

invoices
  invoice_number text unique not null          -- לפי settings.invoices.numbering (ראה 11.2)
  sequence_no int, sequence_year int null
  invoice_kind enum('proforma','credit') not null default 'proforma'
  credit_of_invoice_id → invoices null         -- לזיכוי
  contract_id → contracts not null (direction=income)
  client_id → clients, paying_client_id → clients null
  partial_number int not null                  -- "חשבון חלקי מס' N" – רץ לכל חוזה
  status enum('draft','pending_approval','approved','signed','sent','partially_paid','paid','cancelled')
  invoice_date date not null
  due_date date                                -- invoice_date + תנאי תשלום
  period_from date null, period_to date null   -- לשעות/ריטיינר/יחידות
  subject text                                 -- "הנדון" – ברירת מחדל שם הפרויקט
  intro_text text                              -- פסקת פתיחה (מ-settings, עריך)
  notes text
  -- הצמדה:
  index_linked bool, index_floor bool
  index_base_month date null, index_base_value numeric(10,4) null
  index_month date null, index_current_value numeric(10,4) null
  index_ratio numeric(12,6) not null default 1
  -- סכומים (נשמרים בזמן האישור – snapshot):
  cumulative_base numeric(12,2)                -- סכום מצטבר (מחירי בסיס)
  receipts_base numeric(12,2)                  -- תקבולים בבסיס
  open_base numeric(12,2)                      -- חשבונות פתוחים במדד בסיס
  subtotal_base numeric(12,2)                  -- סה"כ חשבון נוכחי (בסיס)
  index_diff numeric(12,2)                     -- הפרשי הצמדה
  retention_pct numeric(5,2) null, retention_amount numeric(12,2) default 0
  before_vat numeric(12,2)
  vat_rate numeric(5,2), vat_exempt bool default false, vat_exempt_reason text null
  vat_amount numeric(12,2)
  total numeric(12,2)
  withholding_pct numeric(5,2) null, expected_receipt numeric(12,2) null   -- אינפורמטיבי
  -- זרימה:
  approved_by → users null, approved_at
  signed_by → users null, signed_at, signature_title_snapshot text
  sent_at timestamptz null, sent_to jsonb null  -- [{email, name}], cc
  pdf_document_id → documents null
  cancelled_at, cancelled_by, cancel_reason text
  accounting_exported_at timestamptz null, accounting_export_batch_id uuid null

invoice_lines
  invoice_id → invoices, sub_contract_id → sub_contracts, milestone_id → milestones null
  line_type enum('milestone','hours','retainer','unit','extra','adjustment')
  sort_order int
  description text
  -- milestone:
  stage_pct numeric(6,3), stage_amount numeric(12,2)       -- % שלב, סכום שלב (total אחרי הנחה)
  progress_pct_this numeric(6,3), cumulative_pct numeric(6,3)
  amount_this numeric(12,2), cumulative_amount numeric(12,2)
  -- hours:
  grade_id → grades null, user_id → users null, hours numeric(10,2), hourly_rate numeric(10,2)
  -- unit:
  quantity numeric(12,3), unit_price numeric(12,2), cumulative_quantity numeric(12,3)
  -- retainer/extra/adjustment: amount_this בלבד

receipts
  client_id → clients, receipt_date date, amount numeric(12,2)
  method enum('transfer','check','credit_card','cash','other'), reference text, notes text
receipt_allocations
  receipt_id → receipts, invoice_id → invoices, amount numeric(12,2)
  -- Σ allocations של קבלה ≤ amount הקבלה; Σ allocations לחשבון ≤ invoice.total

supplier_invoices
  contract_id → contracts (direction=expense) not null
  supplier_invoice_number text, invoice_date date, received_date date
  amount_before_vat numeric(12,2), vat_amount numeric(12,2), total numeric(12,2)
  description text
  progress_pct_claimed numeric(6,3) null       -- אחוז ביצוע שהספק טוען (להשוואה מול חיוב ללקוח)
  status enum('pending','partially_approved','approved','rejected','paid')
  paid_date date null, notes text
supplier_invoice_approvals
  supplier_invoice_id, user_id → users, decision enum('approved','rejected'), decided_at, comment text
  unique(supplier_invoice_id, user_id)
```

### 5.6 מערכת
```
settings                                       -- key/value
  key text PK, value jsonb, updated_by, updated_at
  (רשימת המפתחות המלאה בפרק 6.3)

notifications
  user_id → users, type text, title text, body text, link text null
  is_read bool default false, email_sent_at timestamptz null, created_at

email_log
  resend_message_id text, to_addresses jsonb, cc_addresses jsonb, subject text
  related_entity_type text, related_entity_id uuid
  status enum('queued','sent','delivered','opened','bounced','failed'), events jsonb, created_at

audit_log
  table_name text, record_id uuid, action enum('insert','update','delete')
  changed_by → users null, changed_at timestamptz, before jsonb null, after jsonb null, request_id text
  index: (table_name, record_id), (changed_by, changed_at)

report_templates                               -- דוחות שמורים
  name text, owner_user_id → users, report_type text, config jsonb, is_shared bool
report_schedules
  template_id → report_templates, frequency enum('daily','weekly','monthly'),
  day_of_week int null, day_of_month int null, hour int, recipients jsonb (מיילים),
  format enum('xlsx','pdf'), is_active bool, last_run_at, next_run_at

import_batches
  entity text, file_document_id → documents, status enum('validating','ready','importing','done','failed','rolled_back')
  rows_total int, rows_ok int, rows_failed int, log jsonb, run_by → users
```

---

## 6. אשף הגדרה ראשונית והגדרות מערכת

### 6.1 עיקרון (החלטה)
בכניסה הראשונה של האדמין הראשון (נוצר ידנית ב-Clerk Dashboard ומסומן `role=admin`), המערכת מפנה ל-`/settings/wizard` ואינה מאפשרת גישה למסכים אחרים עד סיום השלבים המסומנים **חובה**. כל שלב ניתן לעריכה בכל עת אח"כ דרך `/settings/*`. התקדמות האשף נשמרת ב-`settings.onboarding` (שלבים שהושלמו). כל שלב מציג ערכי ברירת מחדל (seed) הניתנים לשינוי.

### 6.2 שלבי האשף
| # | שלב | נתיב | חובה | תוכן |
|---|---|---|---|---|
| 1 | פרטי חברה | `/settings/company` | ✔ | שם, ח.פ (512066176), כתובת, טלפון, פקס, אתר, מייל, לוגו (PNG/SVG), תג ISO (אופציונלי), פרטי בנק, טקסט תחתית ל-PDF |
| 2 | דוא"ל | `/settings/email` | ✔ | כתובת שולח (דומיין מאומת ב-Resend), שם שולח, reply-to, CC קבוע לחשבונות (למשל עידו), תבניות: חשבון ללקוח, תזכורת שעות, התראת איחור, דוח מתוזמן. placeholders: `{{client_name}} {{contact_first_name}} {{invoice_number}} {{project_name}} {{work_number}} {{total}} {{due_date}} {{sender_name}} {{company_name}}` |
| 3 | מחלקות | `/settings/departments` | ✔ | seed מחלקה 1–6; עריכה/הוספה |
| 4 | דרגות ותעריפי חיוב | `/settings/rates` | ✔ | רשימת דרגות + תעריף שעתי לכל דרגה עם תאריך תחילה |
| 5 | מע"מ | `/settings/vat` | ✔ | שיעור נוכחי + היסטוריה (תאריך תחילה) |
| 6 | הצמדה למדד | `/settings/index` | ✔ | סוג מדד: **מדד המחירים לצרכן** (קבוע בשלב זה, מוצג לידיעה); משיכה אוטומטית מהלמ"ס: כן/לא; טבלת ערכי מדד עם הזנה ידנית/עריכה; ברירת מחדל "רצפת מדד" לחוזים חדשים; כלל בחירת חודש מדד לחשבון (ראה 11.7) |
| 7 | מספור | `/settings/numbering` | ✔ | מס' עבודה: `manual` / `auto` + מספר הבא; מס' חשבון: `global` / `yearly` + קידומת + מספר הבא (ברירת מחדל 16836 – אדמין מעדכן); |
| 8 | שלבים ותבניות | `/settings/stages` | ✔ | רשימת שמות שלבים + תבניות (תב"ע, תכנון מפורט) עם אחוזי ברירת מחדל |
| 9 | סטטוסים, סוגי חוזה, סוגי יחידות | `/settings/lookups` | ✖ | seed ניתן לעריכה |
| 10 | דיווח שעות | `/settings/hours` | ✔ | תקן שעות יומי ברירת מחדל (8.5), ימי עבודה, חלון עריכה (ברירת מחדל: עד סוף החודש העוקב), ימי תזכורת (10), תדירות חזרה על תזכורת (3 ימים), האם לשלוח עותק למנהל המחלקה, דיווח לתאריך עתידי: אסור |
| 11 | הרשאות | `/settings/permissions` | ✖ | מטריצת יכולות (פרק 3.2) |
| 12 | חתימות | `/settings/signatures` | ✔ | לכל אדמין: העלאת תמונת חתימה (PNG שקוף) + תפקיד לחתימה; מי חותם ברירת מחדל |
| 13 | חשבונות | `/settings/invoices` | ✔ | תנאי תשלום ברירת מחדל (ימים), יום חיוב ריטיינר, פסקת פתיחה ברירת מחדל, טקסט הערות קבוע, אישור כפול (`require_second_approval`: כן/לא – ברירת מחדל לא), ספי גיול (30/60/90), כללי ניכוי במקור/עכבון בתצוגה |
| 14 | ספקים | `/settings/suppliers` | ✔ | רשימת מאשרי חשבוניות ספק (משתמשים) ומספר אישורים נדרש (ברירת מחדל 2 – עידו והמנכ"ל) |
| 15 | הנהלת חשבונות | `/settings/accounting` | ✖ | תוכנת הנה"ח (טקסט), פורמט ייצוא (xlsx/csv), מיפוי שדות, מייל יעד לייצוא אוטומטי, תדירות |
| 16 | אבטחה וגיבוי | `/settings/security` | ✖ | תפקידים שחייבים MFA, timeout סשן (ברירת מחדל 12 שעות), סטטוס גיבוי אחרון (קריאה בלבד) |

### 6.3 מפתחות `settings` (מחייב)
```
onboarding                 { completed_steps: string[], completed: bool }
company                    { name, tax_id, address, phone, fax, website, email, logo_document_id, iso_badge_document_id, bank: {bank, branch, account, beneficiary}, pdf_footer_text }
email                      { from_name, from_address, reply_to, invoice_cc: string[], templates: { invoice: {subject, body}, hours_reminder: {...}, overdue: {...}, scheduled_report: {...} } }
rates                      { default_hourly_mode: 'rate_card' }
index                      { type: 'cpi', cbs_auto_fetch: bool, default_floor: bool, invoice_month_rule: 'latest_known'|'previous_month' }
numbering                  { work_number: {mode:'manual'|'auto', next:int, prefix:''}, invoice: {mode:'global'|'yearly', next:int, prefix:'', year:int} }
hours                      { default_standard_hours_per_day: 8.5, default_work_days:[0,1,2,3,4], lock_rule:'end_of_next_month', reminder_days:10, reminder_repeat_days:3, notify_department_manager:bool, allow_future_dates:false, max_minutes_per_day:1440 }
invoices                   { default_payment_terms_days:30, retainer_billing_day:1, default_intro_text, default_notes, require_second_approval:false, aging_thresholds:[30,60,90], default_signer_user_id, hours_line_grouping:'grade'|'employee', attach_hours_appendix:true }
suppliers                  { approver_user_ids: string[], required_approvals: 2, over_budget_alert: true, progress_vs_client_alert: true }
accounting                 { software_name, export_format:'xlsx', field_mapping: {...}, auto_export_email, frequency:'manual'|'daily'|'monthly' }
alerts                     { contract_progress_thresholds:[80,100] }
files                      { allowed_extensions: string[], max_size_mb: 50 }
security                   { mfa_required_roles:['admin'], session_hours:12 }
permissions                { manager: {capability:bool,...}, employee: {...} }
```

---

## 7. מודול לקוחות וספקים

### 7.1 לקוחות (`/clients`)
- רשימה: שם, ח.פ, חוזים פעילים, יתרת חשבונות פתוחה, חשבונות באיחור; חיפוש; סינון פעיל/לא פעיל.
- כרטיס לקוח: טאבים **פרטים** | **אנשי קשר** | **פרויקטים וחוזים** | **חשבונות** | **תקבולים** | **גיול חובות** | **מסמכים**.
- אנשי קשר: הוספה ללא הגבלה; סימון `receives_invoices` קובע את נמעני ברירת המחדל לשליחת חשבון; לפחות איש קשר אחד עם מייל נדרש לפני שליחת חשבון.
- ולידציה: ח.פ – 9 ספרות (אזהרה בלבד, לא חסימה); מייל תקין; שם ייחודי (אזהרה על כפילות).
- "לקוח משלם": שדה אופציונלי בפרויקט/חוזה; אם מוגדר – פרטי "לכבוד" ב-PDF ותנאי תשלום נלקחים מהלקוח המשלם, ואילו שם הפרויקט וההנדון מהלקוח.
- אין ברירות מחדל שיורשות אוטומטית מהלקוח לחוזה, למעט הצעה (pre-fill) בטופס פתיחת חוזה מהשדות `payment_terms_days`, `index_linked_default`, `vat_exempt` – המשתמש רואה ומאשר.

### 7.2 ספקים – נותני שירות (`/suppliers`)
- זהה ללקוח במבנה: פרטים, אנשי קשר, חוזי ספק, חשבוניות ספק, מסמכים.
- שדה `field` (תחום) – הזנה חופשית עם autocomplete מערכים קיימים.
- כרטיס ספק מציג: סה"כ תקציב בחוזים פעילים, סה"כ אושר, סה"כ שולם, יתרה.

---

## 8. מודול פרויקטים וחוזים

### 8.1 פרויקט (`/projects/[id]`)
1. **יצירה:** מס' עבודה (לפי `settings.numbering.work_number` – ידני עם בדיקת ייחודיות בזמן הקלדה, או אוטומטי), שם, לקוח, לקוח משלם (אופ'), מנהל פרויקט, מחלקה, תאריכים, תיאור.
2. **כותרת:** מס' עבודה, שם, לקוח, מנהל, סטטוס, ותיבות סיכום: סכום חוזים, הוגש, שולם, פתוח, יתרה, % התקדמות, סה"כ שעות, עלות שעות, עלות ספקים, רווח (הכל מ-`lib/calc/balances`).
3. **טאבים:** חוזי לקוח | חוזי ספק | מסמכים | צוות (איחוד הקצאות מכל תתי-החוזים) | שעות (סיכום לפי עובד/חודש) | חשבונות.
4. **פעולות:** חוזה לקוח חדש, חוזה ספק חדש, שכפול פרויקט (פרק 8.6), העלאת מסמך.
5. **סטטוס פרויקט (אוטומטי, אלא אם `status_manual`):** `completed` אם כל חוזי הלקוח בסטטוס terminal; `on_hold` אם כל הפעילים מוקפאים; `cancelled` אם כולם מבוטלים; אחרת `active`; ללא חוזים = `draft`.

### 8.2 חוזה (`/contracts/[id]`)
**כותרת (כמו באדמירל):** לקוח, לקוח משלם, פרויקט (מס'+שם), מס' חוזה בפרויקט, מס' הזמנה, סוג חוזה, סטטוס, תאריך חתימה, תאריך יעד, מרכז רווח/מחלקה, הצמדה למדד + חודש בסיס + רצפת מדד, "משתתף בדיווח שעות", "חובת דיווח על תתי-חוזים" (תצוגה בלבד – true אוטומטית כאשר יש יותר מתת-חוזה אחד או שאין default), תיאור, שורת יצירה ("חוזה מס' X נפתח ב-dd/mm/yyyy ע"י …").
**סיכום כספי:** סכום כולל | הוגש | שולם | חייב (פתוח) | יתרה להגשה | % התקדמות.
**טאבים:** תתי-חוזים | הערות סטטוס | בעלי תפקידים | מסמכים | חשבונות | היסטוריה (audit מסונן).

**טבלת תתי-חוזים:** מס' | שם | שיטת תמחור | סכום | הוגש | יתרה להגשה | שולם | יתרה לתשלום | משתתף בדיווח | נעול | פעולות (עריכה, שכפול, מחיקה – מחיקה רק אם אין שעות/חשבונות). שורת סה"כ.

**כללי סטטוס חוזה (אוטומטי, אלא אם `status_manual`):** `draft` כשאין תאריך חתימה; `active` כשיש תאריך חתימה; `completed` כשהוגש 100% מהסכום **וגם** שולם 100%; אדמין יכול לקבוע ידנית `on_hold`/`cancelled`/`completed` (מסמן `status_manual=true`; כפתור "חזור לחישוב אוטומטי").

**נעילה:** `is_locked` – חוזה נעול: שדות כותרת, תתי-חוזים ואבני דרך לקריאה בלבד; מותר: הערות, מסמכים, חשבונות, שעות. פתיחה דורשת `contracts.unlock` + סיבה (נרשמת ב-audit).

### 8.3 תת-חוזה (`/sub-contracts/[id]`)
**כותרת:** פרויקט, חוזה, מס' תת-חוזה, שם, סטטוס, תאריך פתיחה, מרכז רווח, שיטת תמחור, הצמדה, "משתתף בדיווח שעות", נעול.
**בלוק תמחור – משתנה לפי שיטה:**

| שיטה | שדות | חישוב סכום תת-חוזה (`total_amount`) |
|---|---|---|
| **פיקס פרייס** | מחיר בסיס, % הנחה | `base_price × (1 − discount/100)` |
| **לפי שעות** | מצב: כרטיס תעריפים (לפי דרגת העובד) / תעריף אחיד; תקרת שעות; תקרת סכום | `amount_cap` אם מוגדר; אחרת `hours_cap × תעריף` אם מוגדר; אחרת Σ מה שחויב בפועל (סכום "פתוח" – מוצג "ללא תקרה") |
| **ריטיינר** | סכום חודשי, תאריך התחלה, תאריך סיום (אופ'), יום חיוב | `monthly_amount × מספר החודשים בין התחלה לסיום`; ללא סיום – Σ חודשים עד היום + מוצג "פתוח" |
| **% מעלות פרויקט** | % שכ"ט, טבלת אומדני עלות (סוג, סכום, תאריך) | `fee = current_estimate × fee_pct/100`; הנחה כמו פיקס |
| **לפי יחידות** | סוג יחידה, מחיר ליחידה, כמות מוסכמת (אופ') | `agreed_quantity × unit_price` אם מוגדר; אחרת Σ מה שחויב |

**אבני דרך** (רלוונטי ל-פיקס פרייס ו-% מעלות בלבד; לשיטות האחרות הבלוק מוסתר):
- בפתיחת תת-חוזה: בחירת תבנית (תב"ע / תכנון מפורט / ריק) → שורות נוצרות עם אחוזי ברירת מחדל; ניתן להוסיף/למחוק/לסדר (drag).
- עמודות: # | שלב (dropdown מ-`stage_names` + אפשרות "אחר" לטקסט חופשי) | % מתת-חוזה | סכום | % הנחה | סה"כ | יתרת פתיחה % | הוגש % | הוגש ₪ | שולם ₪ | יתרה ₪ | תאריך צפוי | פעולות.
- סכום = `base × pct/100`; סה"כ = `סכום × (1 − הנחה/100)`; % הנחה ברירת מחדל = הנחת תת-החוזה, ניתן לדריסה בשורה.
- **סך האחוזים אינו חייב להיות 100** – מוצג בשורת סה"כ עם צבע: ירוק = 100, כתום ≠ 100 (אזהרה, לא חסימה).
- **שינוי אבן דרך שכבר חויבה** (יש `invoice_lines` לא-מבוטלות): מותר לאדמין בלבד, דורש סיבה, נרשם ב-audit; המערכת מציגה את ההשפעה על היתרה. `cumulative_amount` שכבר חויב אינו משתנה רטרואקטיבית; היתרה מחושבת מחדש.
- **% מעלות:** כאשר מתווסף אומדן חדש, `total` של כל אבן דרך מחושב מחדש; מה שחויב נשאר; יתרה = total חדש − cumulative_amount.

**טאבים בתת-חוזה:** אבני דרך | צוות (הקצאת עובדים – multi-select מעובדים פעילים; רק מוקצים יכולים לדווח) | שעות (סיכום לפי עובד/חודש + קישור לדוח) | חשבונות (שורות חשבון של התת-חוזה) | הערות | היסטוריית שינויים.

**נעילת תת-חוזה ("חוזה חתום"):** צ'קבוקס `is_locked`. כשנעול – תמחור ואבני דרך לקריאה בלבד, כולל למי שיש `contracts.edit`. פתיחה – רק `contracts.unlock` + סיבה.

### 8.4 חוזה ספק (direction=expense)
- זהה במבנה לחוזה לקוח (תתי-חוזים, שיטות תמחור, אבני דרך), חובה `project_id` ו-`supplier_id`.
- שדה נוסף: `budget_amount` (תקציב מאושר; ברירת מחדל = Σ תתי-חוזים).
- טאב **חשבוניות ספק** במקום "חשבונות".
- אין דיווח שעות על חוזה ספק (`participates_in_hours` תמיד false ומוסתר).
- **התראות (cron `contract-alerts`):**
  1. Σ חשבוניות ספק מאושרות > `budget_amount` → התראה "ספק חרג מתקציב" לאדמינים ולמנהל הפרויקט.
  2. `progress_pct_claimed` המצטבר של הספק (Σ מחשבוניות מאושרות/ממתינות) > % ההתקדמות המחויב ללקוח באותו פרויקט (הוגש/סכום של חוזי הלקוח) → התראה "ביצוע ספק גבוה מחיוב ללקוח".
  ההתראה נשלחת פעם אחת לכל חצייה (ולא כל יום) – נשמר ב-`notifications.type` + מזהה.

### 8.5 הערות סטטוס, בעלי תפקידים, מסמכים
- **הערות סטטוס:** יומן כרונולוגי (תאריך, משתמש, טקסט), ללא עריכה אחרי 24 שעות (מחיקה – אדמין בלבד). תומך @אזכור משתמש → התראה.
- **בעלי תפקידים:** טבלה: תפקיד (טקסט חופשי עם autocomplete) | שם (בחירת משתמש / איש קשר לקוח / טקסט חופשי) | הערות.
- **מסמכים:** drag&drop, ריבוי קבצים, סוג מסמך, גרסאות, תצוגה מקדימה ל-PDF/תמונות, הורדה ב-signed URL. בפתיחת חוזה יש אזור "העלה חוזה חתום (PDF)" ייעודי.

### 8.6 שכפול
- **שכפול תת-חוזה:** מעתיק תמחור ואבני דרך (ללא יתרות פתיחה, ללא שעות/חשבונות/צוות). מספר תת-חוזה חדש.
- **שכפול חוזה:** מעתיק כותרת + כל תתי-החוזים (כנ"ל), בעלי תפקידים; ללא הערות/מסמכים. סטטוס `draft`, ללא תאריך חתימה.
- **שכפול פרויקט:** מעתיק פרויקט + כל חוזי הלקוח (כנ"ל); דורש מס' עבודה חדש.

---

## 9. מנוע יתרות (`lib/calc/balances.ts`)

כל הסכומים ב"מחירי בסיס" (לפני הצמדה, לפני מע"מ). חשבונות בסטטוס `draft`/`pending_approval`/`cancelled` **אינם** נספרים. חשבון `credit` נספר בסימן שלילי.

| מדד | חישוב |
|---|---|
| `total_amount` (סכום תת-חוזה) | לפי טבלת 8.3 |
| `opening_billed` | Σ אבני דרך: `total × opening_billed_pct/100` |
| `submitted` (הוגש) | `opening_billed` + Σ `invoice_lines.amount_this` של חשבונות בסטטוס ≥ `approved` |
| `paid` (שולם) | Σ `opening_paid_amount` + Σ (סכום מוקצה מתקבלים לחשבון × `subtotal_base/total` של אותו חשבון) – כלומר המרת התקבול חזרה למחירי בסיס |
| `open_balance` (חייב / ח-ן פתוח) | `submitted − paid` |
| `remaining` (יתרה להגשה) | `total_amount − submitted` (לשיטות "פתוחות" ללא תקרה – null, מוצג "—") |
| `progress_pct` | `submitted / total_amount × 100` (null אם `total_amount` = 0/פתוח) |
| חוזה / פרויקט / לקוח | Σ של תתי-החוזים המתאימים |

**שעות:** `hours_total` = Σ `minutes/60` של `time_entries` בתת-חוזה; `hours_this_year`; `hours_by_month`.
**עלות שעות:** Σ (`minutes/60` × עלות שעתית של העובד בתוקף ל-`work_date`).
**עלות ספקים:** Σ `supplier_invoices.amount_before_vat` בסטטוס `approved`/`paid` של חוזי הספק בפרויקט.
**רווחיות** (`lib/calc/profitability.ts`, הנחה – ראה 19):
- הכנסה = `submitted` (מה שהוגש בפועל, מחירי בסיס). פרמטר אופציונלי בדוח: "לפי ערך אבני דרך שהושלמו" = Σ `total` של אבני דרך עם `cumulative_pct = 100`.
- עלות = עלות שעות + עלות ספקים.
- רווח = הכנסה − עלות; שיעור רווח = רווח / הכנסה.
- "ח-ן פתוח נטו" (עמודה באדמירל) = `open_balance` × (1 + מע"מ) – הסכום כולל מע"מ שהלקוח חייב.

---

## 10. מודול דיווח שעות

### 10.1 עקרונות
- דיווח **רק** על תתי-חוזים: פעילים (סטטוס לא terminal), `participates_in_hours = true`, שהחוזה שלהם `participates_in_hours = true`, ושהעובד **מוקצה** אליהם (`sub_contract_assignments.is_active`).
- **אין** שעות לא-פרויקטליות (חופשה/מחלה/כללי) ואין שעון נוכחות.
- רזולוציית דיווח: **דקות** (שדה HH:MM). אפשרות אופציונלית להזין שעת התחלה/סיום – המערכת מחשבת משך.
- תיאור חובה (≥ 3 תווים).
- דיווח לתאריך עתידי אסור (`settings.hours.allow_future_dates=false`). היום מותר.
- סה"כ דקות ליום לעובד ≤ 1440 (חסימה); מעל תקן יומי – אזהרה ויזואלית בלבד.

### 10.2 תצוגות (`/hours`)
בורר תצוגה: **יומי | שבועי | חודשי**. בורר עובד (למי שיש `hours.view_others`). ניווט תאריכים (קודם/הבא/היום/בחירת תאריך).

**שבועי (ברירת מחדל):** גריד – שורות = תתי-חוזים המוקצים לעובד (מס' עבודה – שם פרויקט – שם תת-חוזה), עמודות = ראשון…שבת (ימי עבודה מודגשים), תא = סה"כ HH:MM לאותו יום/תת-חוזה. לחיצה על תא פותחת popover עם רשימת הדיווחים באותו תא (כל דיווח: משך, תיאור, התחלה/סיום) + "הוסף דיווח". שורת סה"כ יומי מול תקן (צבע: אדום < תקן, ירוק = תקן, כתום > תקן). עמודת סה"כ שבועי. כפתור "העתק משבוע קודם" (מעתיק תתי-חוזים ומשכים, ללא תיאורים – התיאור נדרש מחדש). כפתור "הוסף תת-חוזה לשבוע" (מתוך המוקצים, למקרה שאין לו עדיין שורה).

**יומי:** רשימת דיווחים לתאריך: תת-חוזה | התחלה | סיום | משך | תיאור | פעולות. טופס הוספה מהיר בראש הרשימה. סה"כ יומי.

**חודשי:** לוח שנה – בכל יום סה"כ שעות + סימון חסר (יום עבודה ללא דיווח = אדום, חלקי = כתום). לחיצה על יום → תצוגה יומית. סיכום חודשי: סה"כ שעות, תקן, פער, פילוח לפי פרויקט (טבלה + עוגה).

### 10.3 טופס דיווח
שדות: תאריך (ברירת מחדל היום) | תת-חוזה (combobox עם חיפוש: מס' עבודה / שם פרויקט / שם תת-חוזה; מציג את תתי-החוזים המוקצים בלבד; האחרונים בשימוש בראש) | התחלה | סיום | משך HH:MM | תיאור. שמירה + "שמור והוסף עוד". ולידציית zod בקליינט ובשרת.

### 10.4 דיווח בשם עובד אחר
מי שיש לו `hours.report_for_others` בוחר עובד (בהיקף המותר). הדיווח נשמר עם `reported_by_user_id` = המדווח. בתצוגה של העובד מסומן "דווח ע"י …". העובד מקבל התראה במערכת.

### 10.5 עריכה ומחיקה
עובד עורך/מוחק רק את הדיווחים שלו ורק בתקופה פתוחה. מנהל/אדמין – לפי היקף. כל שינוי ב-audit.

### 10.6 הקצאת עובדים
ב-`/sub-contracts/[id]` טאב צוות, וגם מסך מרוכז `/projects/[id]` טאב צוות (הקצאה לכל תתי-החוזים בפרויקט בבת אחת). הסרת עובד מצוות אינה מוחקת דיווחים קיימים.

### 10.7 נעילת תקופות
- כלל (`settings.hours.lock_rule = 'end_of_next_month'`): דיווחים של חודש M ניתנים ליצירה/עריכה ע"י עובד/מנהל עד 23:59 ביום האחרון של חודש M+1. לאחר מכן החודש נעול.
- Cron `period-lock` לא משנה נתונים – הנעילה מחושבת (`isLocked(work_date, now, unlocks)`), אך ה-cron שולח סיכום לאדמינים "חודש X ננעל, Y עובדים עם דיווח חסר".
- **פתיחה:** אדמין ב-`/hours?user=…` → "פתח חודש" → בוחר חודש, עד מתי פתוח (ברירת מחדל 7 ימים), סיבה → רשומה ב-`period_unlocks`, התראה לעובד. אדמין עצמו עורך תקופות נעולות תמיד (`hours.edit_locked`).

### 10.8 תזכורות
Cron יומי: לכל עובד פעיל, אם `today − max(work_date)` > `reminder_days` (10) **או** אין דיווח כלל – שליחת מייל (תבנית `hours_reminder`) + התראה במערכת. חזרה כל `reminder_repeat_days`. עותק למנהל המחלקה אם `notify_department_manager`. לא נשלח למי שאין לו אף הקצאה פעילה.

### 10.9 ייצוא לחשבת שכר
דוח ייעודי (פרק 12.4 – "ייצוא שכר"): לכל עובד לחודש: מזהה שכר, שם, סה"כ שעות בחודש, פירוט לפי יום (עמודה לכל יום), מספר ימי דיווח. פורמט xlsx; עמודות ניתנות לבחירה; ניתן לתזמן.

---

## 11. מודול חשבונות

### 11.1 סוגי חשבון
- **חשבון עסקה (proforma)** – המסמך שהמערכת מפיקה ושולחת ללקוח. **אינו חשבונית מס.** חשבונית המס מופקת בתוכנת הנהלת החשבונות של החברה על בסיס ייצוא מהמערכת (11.14).
- **חשבון זיכוי (credit)** – חשבון שלילי המפנה לחשבון מקורי; מקטין מצטבר ויתרות.

### 11.2 מספור
- לפי `settings.numbering.invoice`: `global` – רצף אחד לכל החברה (המשך ל-16835 → 16836); `yearly` – איפוס בכל שנה, מספר מוצג `{prefix}{year}-{seq}`.
- המספר מוקצה **בזמן יצירת הטיוטה** (טרנזקציה עם נעילת שורה ב-settings). חשבון שבוטל שומר את מספרו וסטטוס `cancelled` – אין שימוש חוזר במספר, אין חורים.
- `partial_number` – "חשבון חלקי מס' N" – רץ לכל חוזה (כולל חשבונות מבוטלים אינם נספרים; זיכויים נספרים).

### 11.3 סטטוסים וזרימה
```
draft ──▶ [pending_approval] ──▶ approved ──▶ signed ──▶ sent ──▶ partially_paid ──▶ paid
  │              │                   │           │
  └──────────────┴───────────────────┴───────────┴──▶ cancelled (עם סיבה)
```
| מעבר | מי | תנאים |
|---|---|---|
| יצירת draft | `invoices.create` (עידו/אדמין) | חוזה לקוח, לא מבוטל; לפחות שורה אחת עם סכום ≠ 0 |
| draft → pending_approval | יוצר | רק אם `require_second_approval=true`; אחרת draft → approved ישירות |
| pending_approval → approved | `invoices.approve`, משתמש **שונה** מהיוצר | |
| draft/pending → approved | `invoices.approve` | **snapshot** של כל הסכומים, המדד, המע"מ; שורות ננעלות |
| approved → signed | `invoices.sign` | בחירת חותם (אדמין עם חתימה מוגדרת; ברירת מחדל `default_signer_user_id`); המערכת מרנדרת PDF סופי עם חתימה + שם + תפקיד + תאריך, שומרת ב-`documents` |
| signed → sent | `invoices.send` | בחירת נמענים (ברירת מחדל: אנשי קשר `receives_invoices` של הלקוח המשלם/הלקוח), CC (מ-settings + חופשי), עריכת נושא/גוף מהתבנית; שליחה דרך Resend עם PDF מצורף (+ נספח שעות אם רלוונטי) |
| sent → partially_paid / paid | אוטומטי מהקצאת תקבולים | `paid` כאשר Σ הקצאות ≥ `total` |
| → cancelled | `invoices.cancel` | לא ניתן לבטל חשבון עם תקבולים; ביטול חשבון שנשלח דורש סיבה ומייצר התראה; שורות ה-`time_entries` המשויכות משוחררות (`invoice_id=null`) |
| חזרה ל-draft | אדמין | רק מ-approved/signed שלא נשלח; מוחק snapshot ו-PDF |

### 11.4 יצירת חשבון (`/invoices/new`)
**שלב 1 – בחירה:** חיפוש חוזה לפי מס' עבודה / שם פרויקט / לקוח; סינון לפי לקוח, שנה, סטטוס. מוצגים רק חוזי לקוח פעילים עם יתרה להגשה או שיטה פתוחה.
**שלב 2 – היקף:** בחירת תתי-חוזים לכלול (ברירת מחדל: כולם שאינם terminal). תאריך חשבון (ברירת מחדל היום). תקופה (לשעות/ריטיינר/יחידות – ברירת מחדל: החודש הקודם).
**שלב 3 – שורות:** נבנות אוטומטית לפי שיטת התמחור של כל תת-חוזה (11.6). המשתמש מזין % התקדמות / כמויות / מאשר שעות.
**שלב 4 – סיכום:** הצמדה (11.7), עכבון, מע"מ, ניכוי במקור (אינפורמטיבי), נושא, פסקת פתיחה, הערות. תצוגה מקדימה של ה-PDF (רינדור draft עם סימן מים "טיוטה").
**שמירה** → `draft`.

### 11.5 שורות אבני דרך (fixed_price / pct_of_cost) – `lib/calc/milestones.ts`
לכל אבן דרך בתתי-החוזים שנבחרו:
```
prev_cum_pct   = opening_billed_pct + Σ progress_pct_this (חשבונות קודמים בסטטוס ≥ approved, זיכויים בשלילי)
max_this       = 100 − prev_cum_pct
progress_pct_this ∈ [0, max_this]        -- קלט; ניתן להזין לחלופין "מצטבר חדש" והמערכת גוזרת
stage_amount   = milestone.total          -- אחרי הנחה
amount_this    = round(stage_amount × progress_pct_this / 100, 2)
cumulative_pct = prev_cum_pct + progress_pct_this
cumulative_amount = round(stage_amount × cumulative_pct / 100, 2)
```
- חסימה: `cumulative_pct > 100` אסור. תיקון כלפי מטה – רק דרך חשבון זיכוי (progress שלילי, `cumulative_pct ≥ 0`).
- שורת סה"כ לתת-חוזה: Σ stage_pct | Σ stage_amount | % התקדמות בחשבון זה = Σ amount_this / Σ stage_amount | % מצטבר = Σ cumulative_amount / Σ stage_amount | Σ amount_this | Σ cumulative_amount.
- אבני דרך עם `progress_pct_this = 0` **מוצגות** ב-PDF (כמו בדוגמה) עם 0.00.

### 11.6 שורות לשיטות אחרות
**11.6.1 לפי שעות:** המערכת שולפת `time_entries` של התת-חוזה בתקופה, שטרם חויבו (`invoice_id is null`), ומקבצת לפי `settings.invoices.hours_line_grouping` (`grade` = שורה לכל דרגה: שעות × תעריף הדרגה בתוקף לתאריך החשבון; `employee` = שורה לכל עובד). במצב `custom` – תעריף אחיד. המשתמש יכול להסיר דיווחים בודדים מהחשבון (יישארו לחיוב בחשבון הבא). באישור – הדיווחים מסומנים `invoice_id`. אם קיימת תקרה – אזהרה בחריגה, לא חסימה. נספח שעות (תאריך, עובד, תיאור, שעות) מצורף ל-PDF כעמוד נפרד אם `attach_hours_appendix`.
**11.6.2 ריטיינר:** שורה אחת: "ריטיינר חודש MM/YYYY" × `monthly_amount`. ניתן לכלול כמה חודשים בחשבון אחד (שורה לכל חודש).
**11.6.3 ריטיינר אוטומטי:** Cron `retainer-invoices`: ביום החיוב, לכל תת-חוזה ריטיינר פעיל שאין לו חשבון לחודש הנוכחי – יוצר **טיוטה** (חשבון לחוזה, כולל רק אותו תת-חוזה) והתראה ליוצרי חשבונות. הטיוטה עוברת את הזרימה הרגילה.
**11.6.4 לפי יחידות:** שורה: כמות בחשבון זה × מחיר ליחידה; מוצג מצטבר ומול כמות מוסכמת (אזהרה בחריגה).
**11.6.5 שורות נוספות:** `extra` (תוספת חופשית: תיאור + סכום) ו-`adjustment` (התאמה ±) – דורשות הרשאת `invoices.approve` ומופיעות ב-PDF בטבלה נפרדת "תוספות/התאמות".

### 11.7 הצמדה למדד – `lib/calc/index-linkage.ts`
- **מדד:** מדד המחירים לצרכן (למ"ס). ערכים ב-`index_values` לפי חודש; מקור: משיכה אוטומטית מ-API הלמ"ס (`cbs-index-fetch`; אם ה-API נכשל/משתנה – התראה לאדמין והזנה ידנית) או הזנה ידנית ב-`/settings/index`. ערך ידני דורס אוטומטי ומסומן.
- **חודש בסיס:** `contract.index_base_month` (ברירת מחדל בפתיחת חוזה: חודש תאריך החתימה; ניתן לשינוי). תת-חוזה יורש, ניתן לדריסה.
- **חודש מדד לחשבון:** לפי `settings.index.invoice_month_rule`: `latest_known` = החודש האחרון שקיים ב-`index_values` נכון לתאריך החשבון (ברירת מחדל); `previous_month` = החודש שקדם לחודש תאריך החשבון. ניתן לדריסה ידנית בחשבון (dropdown של חודשים קיימים).
- **יחס:** `ratio = current_value / base_value`; אם `index_floor` ו-`ratio < 1` → `ratio = 1`; אם לא מוצמד → `ratio = 1`. 6 ספרות אחרי הנקודה.
- אם חסר ערך מדד לחודש הנדרש – לא ניתן לאשר את החשבון; הודעה מפורשת + קישור להזנה.
- **סיכום החשבון (מבנה כמו בדוגמה, "חשבון עסקה 16835"):**
```
cumulative_base = Σ cumulative_amount (כל השורות, כל השיטות; לשיטות ללא אבני דרך = Σ amount_this של כל החשבונות עד כה כולל זה)
receipts_base   = Σ על חשבונות קודמים של אותו חוזה: (סכום תקבולים שהוקצו לחשבון × subtotal_base / total של אותו חשבון)
                  + Σ opening_paid_amount של אבני הדרך בחשבון
open_base       = Σ subtotal_base של חשבונות קודמים (סטטוס ≥ approved, לא cancelled) − receipts_base (החלק ששולם מהם)
subtotal_base   = cumulative_base − receipts_base − open_base     -- "סה"כ חשבון נוכחי"
   ✔ בדיקת עקביות: subtotal_base חייב להיות שווה ל-Σ amount_this (סטייה > 0.01 → אזהרה למאשר, לא חסימה; הסטייה מוצגת)
index_diff      = round(subtotal_base × (ratio − 1), 2)
gross           = subtotal_base + index_diff
retention_amount= round(gross × retention_pct/100, 2)   (אם מוגדר עכבון בחוזה)
before_vat      = gross − retention_amount
vat_amount      = vat_exempt ? 0 : round(before_vat × vat_rate/100, 2)
total           = before_vat + vat_amount
expected_receipt= total − round(before_vat × withholding_pct/100, 2)   (אינפורמטיבי, אם ללקוח יש ניכוי במקור בתוקף)
```
- **מע"מ:** שיעור לפי `vat_rates` בתוקף ל-`invoice_date`; ניתן לדריסה בחשבון (עם סיבה); `vat_exempt` נלקח מהלקוח, ניתן לשינוי בחשבון עם סיבה (מודפסת ב-PDF: "פטור ממע"מ – …").
- כל הערכים נשמרים כ-snapshot באישור. שינוי מאוחר של מדד/מע"מ **אינו** משפיע על חשבונות מאושרים.

### 11.8 תבנית PDF (`lib/pdf/invoice.html.tsx`)
מבנה עמוד A4, RTL, גופן עברי מוטמע, לפי הדוגמה "חשבון עסקה 16835":
1. **כותרת:** לוגו (מ-settings), תאריך (מימין למעלה), "חשבון עסקה {מס'}" ממורכז, בלוק "לכבוד:" (שם לקוח משלם, ח.פ, אנשי קשר `receives_invoices`, מייל), בלוק "מס' עבודה: {work_number}", "עוסק מורשה (ח.פ): {company.tax_id}".
2. "**הנדון:** {subject}" ; "**חשבון חלקי מס' {partial_number}**" (לזיכוי: "חשבון זיכוי לחשבון {מס'}").
3. פסקת פתיחה (`intro_text`).
4. שם הפרויקט, ואז **טבלה לכל תת-חוזה** בכותרת שמו: שלב | % שלב | סכום שלב | % התקדמות בחשבון זה | % ביצוע מצטבר | סכום בחשבון זה | סכום מצטבר (ש"ח) + שורת "סכום כולל". לשעות: עובד/דרגה | שעות | תעריף | סכום. לריטיינר/יחידות – בהתאם.
5. טבלת תוספות/התאמות (אם יש).
6. **סיכום** (עמוד אחרון, כמו בדוגמה): סכום מצטבר | תקבולים בבסיס | חשבונות פתוחים במדד בסיס | סה"כ חשבון נוכחי | (מדד בסיס MM/YYYY = X, מדד נוכחי MM/YYYY = Y, הפרשי הצמדה) | עכבון (אם יש) | לפני מע"מ | מע"מ {rate}% | **סה"כ (כולל מע"מ) לתשלום** | (ניכוי במקור צפוי – אם רלוונטי) | תנאי תשלום ותאריך יעד | פרטי בנק.
7. **חתימה:** תמונת חתימה + "{שם פרטי} {שם משפחה}, {תפקיד}" + תאריך חתימה. במצב טיוטה – סימן מים "טיוטה – לא לתשלום".
8. **תחתית קבועה:** שם חברה, כתובת, טלפון, פקס, אתר, מייל, תג ISO; "עמוד X מתוך Y".
9. **נספח שעות** (עמוד נפרד) – כאשר רלוונטי.
- כל טקסטי הכותרות ב-PDF ממפתחות i18n (PDF תמיד בעברית; אנגלית בעתיד).
- שם קובץ: `PGL_חשבון_{invoice_number}_{work_number}.pdf` (מאוחסן כ-`invoices/{yyyy}/{invoice_id}.pdf`).

### 11.9 דוגמת אימות (fixture חובה לבדיקות)
נתוני "אדרת ברעננה" 3489: תת-חוזה תב"ע – בסיס 84,000, הנחה 10% → 75,600; אבני דרך 10/15/25/15/10/15/10; חשבון חלקי 1: "לימוד מצב קיים" 100% → `amount_this = 7,560`, `cumulative_base = 7,560`, `receipts_base = 0`, `open_base = 0`, `subtotal_base = 7,560`, `ratio = 1`, `before_vat = 7,560`, `vat 18% = 1,360.80`, `total = 8,920.80`. תת-חוזה מפורט – 126,000 (בסיס 140,000, הנחה 10%), כל השלבים 0. יתרות חוזה: סכום 189,000 | הוגש 7,560+... (שים לב: באדמירל "הוגש 18,900" כולל חשבון נוסף; בדיקה עם סט נתונים זה בלבד: הוגש 7,560, יתרה 181,440). הבדיקות חייבות לכסות גם: הצמדה עם ratio 1.03, רצפת מדד עם ratio 0.98, זיכוי, תקבול חלקי, עכבון 5%, ניכוי במקור.

### 11.10 תקבולים (`/receipts`)
- יצירת תקבול: לקוח, תאריך, סכום, אמצעי, אסמכתא, הערות, קובץ (אופ').
- הקצאה: רשימת חשבונות פתוחים של הלקוח (ובלקוח המשלם) עם יתרה; הקצאה ידנית או "הקצה אוטומטית מהישן לחדש". תקבול חלקי מותר. יתרת תקבול לא מוקצית מוצגת כ"זכות לקוח".
- עדכון סטטוס חשבון אוטומטי. ביטול הקצאה – אדמין, עם סיבה.

### 11.11 חשבון זיכוי
נוצר מתוך חשבון קיים ("צור זיכוי"): בוחרים אבני דרך/שורות ואחוז/סכום לזיכוי (שלילי). עובר את אותה זרימה (אישור, חתימה, שליחה). מספר חשבון חדש מהרצף. מקטין `submitted` ו-`cumulative`.

### 11.12 גיול חובות והתראות איחור
- `due_date = invoice_date + payment_terms_days` (של הלקוח המשלם; אחרת ברירת מחדל).
- Cron `invoice-aging`: לכל חשבון בסטטוס `sent`/`partially_paid` שעבר סף מ-`aging_thresholds` – התראה לאדמינים (פעם אחת לכל סף) + אפשרות ידנית "שלח תזכורת ללקוח" (מייל מתבנית `overdue`).
- דוח גיול: לקוח | חשבון | תאריך | יעד | סכום | שולם | יתרה | ימים באיחור | דלי (0–30/31–60/61–90/90+).

### 11.13 חשבוניות ספקים (`/supplier-invoices`)
- קליטה: ספק, חוזה ספק, מס' חשבונית, תאריך, סכום לפני מע"מ, מע"מ, סה"כ, % ביצוע נטען, תיאור, קובץ (חובה).
- **אישור:** דורש `settings.suppliers.required_approvals` (2) אישורים ממשתמשים ברשימת `approver_user_ids` (עידו + המנכ"ל). כל מאשר מקבל התראה; אחרי האישור הראשון – `partially_approved`; אחרי כולם – `approved`. דחייה ע"י אחד → `rejected` (עם נימוק). סימון `paid` + תאריך – ידני.
- מוצג בדוחות עלות/רווחיות רק בסטטוס `approved`/`paid`.

### 11.14 ייצוא להנהלת חשבונות
תוכנת הנה"ח **לא הוגדרה** (ראה 19). מימוש:
1. **ייצוא קובץ** (`/invoices` → "ייצוא להנה"ח"): בחירת טווח תאריכים/חשבונות שטרם יוצאו → xlsx/csv עם עמודות קבועות: `invoice_number, invoice_date, due_date, client_name, client_tax_id, work_number, project_name, subject, before_vat, vat_rate, vat_amount, total, index_diff, retention_amount, status, kind, credit_of` + שורות (sub_contract, description, amount). סימון `accounting_exported_at` + `batch_id`. אפשרות ייצוא חוזר.
2. **מיפוי שדות** ב-`settings.accounting.field_mapping` (שם עמודה במערכת → שם עמודה בקובץ היעד) כדי להתאים לתוכנה שתיבחר בלי שינוי קוד.
3. **שכבת אינטגרציה** – ממשק `AccountingAdapter { exportInvoices(batch), exportReceipts(batch) }` עם מימוש `FileAdapter` בלבד בשלב זה; מבנה מוכן ל-adapter API (חשבשבת/פריוריטי/ריווחית) בעתיד.
4. ייצוא תקבולים – אותו מנגנון.

---

## 12. מודול דוחות ודשבורד

### 12.1 מחולל דוחות – מסך אחד (`/reports`)
פריסה: **עמודת צד (ימין)** – בחירת דוח (מקובץ: שעות | רווחיות ועלויות | חוזים וחשבונות | ספקים | שכר | מערכת). **אזור מרכזי** – פאנל סינון עליון + תוצאה. **סרגל פעולות** – הפק | Excel | PDF | הדפס | שמור כתבנית | תזמן.
**סינונים (מוצגים לפי רלוונטיות לדוח):** טווח תאריכים (קיצורים: החודש, חודש קודם, רבעון, שנה, שנה קודמת, מותאם) | לקוח(ות) | פרויקט(ים) / מס' עבודה | חוזה | תת-חוזה | מחלקה | עובד(ים) | מנהל פרויקט | סטטוס חוזה | שיטת תמחור | ספק | סטטוס חשבון.
**טאגלים (Toggles):** בחירת עמודות (checkbox לכל עמודה זמינה) | קיבוץ לפי (עד 2 רמות) | הצג שורות סיכום | הצג גרף: ללא / עמודות / קווים / עוגה (+ בחירת מדד לגרף) | השווה לתקופה קודמת | כלול לא פעילים.
**תוצאה:** טבלה (TanStack, virtualized, מיון בלחיצה, הרחבה היררכית לדוחות מקוננים, שורות סיכום דביקות) + גרף (Recharts) מעל/לצד.
**ייצוא:** xlsx (exceljs – כותרות, הקפאת שורה, פורמט מספרים, שורות סיכום, RTL sheet), PDF (תבנית דוח RTL עם לוגו, שם דוח, סינונים שהוחלו, תאריך הפקה, גרף כתמונה), הדפסה (CSS print).
**תבניות:** `report_templates` – שמירה אישית או משותפת (אדמין). טעינה מחזירה את כל הסינונים והטאגלים.
**הרשאות:** `reports.hours` – רק קבוצת "שעות" ו"שכר" ללא עמודות כספיות; `reports.financial` – הכל.

### 12.2 רישום דוחות (`lib/reports/registry.ts`)
כל דוח מוגדר כאובייקט: `{ key, group, titleKey, requiredCapability, filters[], columns[], defaultGroupBy, chartOptions[], query(params) }`. הוספת דוח = הוספת רשומה, ללא שינוי במסך.

### 12.3 קבוצת שעות
| מפתח | שם | שורות/עמודות |
|---|---|---|
| `hours.monthly_by_employee` | חודשי לעובד | שורה: עובד; עמודות: ימים בחודש (1–31) + סה"כ + תקן + פער. סינון חודש. |
| `hours.employees_projects` | עובדים–פרויקטים | שורה: עובד → פרויקט → תת-חוזה; עמודות: שעות בתקופה, % מסה"כ העובד |
| `hours.by_project` | שעות לפי פרויקט | שורה: פרויקט → תת-חוזה → עובד; עמודות: שעות, % מהפרויקט |
| `hours.project_summary` | סיכום שעות לפי פרויקט | שורה: פרויקט; עמודות: שעות בתקופה, שעות מצטבר, מספר עובדים, שעות החודש הנוכחי |
| `hours.project_matrix` | מטריצת שעות לפרויקט | פרויקט נבחר; שורה: עובד; עמודות: חודשים בטווח; תאים: שעות; סה"כ שורה/עמודה |
| `hours.matrix_summary` | סיכום שעות מטריצוני | שורה: פרויקט; עמודות: חודשים; תאים: שעות; קיבוץ אופציונלי לפי לקוח/מחלקה |
| `hours.by_client` | שעות לפי לקוח | שורה: לקוח → פרויקט |
| `hours.detailed` | שעות מפורט | שורה לכל `time_entry`: תאריך, עובד, מחלקה, פרויקט, תת-חוזה, התחלה, סיום, שעות, תיאור, דווח ע"י, חויב בחשבון |
| `hours.by_department` | פילוח מחלקות | שורה: מחלקה → עובד; עוגה לפי מחלקה |
| `hours.missing` | דיווח חסר | שורה: עובד; ימים ללא דיווח בתקופה, ימים חלקיים, תאריך דיווח אחרון |

### 12.4 קבוצות כספיות (דורש `reports.financial`)
| מפתח | שם | תוכן |
|---|---|---|
| `fin.contract_balances` | **יתרות חוזים** | העתק של דוח אדמירל (צילום 1). היררכיה: לקוח → פרויקט → חוזה → תת-חוזה → אבן דרך. קבוצות עמודות: **כללי** (לקוח, פרויקט, מס' עבודה, מנהל פרויקט, סטטוס) | **פרויקט/חוזה** (סכום, שולם, ח-ן פתוח, יתרה, % התקדמות) | **שעות** (סה"כ השנה, סה"כ, עמודה לכל חודש בטווח – מוסתרות כברירת מחדל, טאגל "הצג חודשים") | **רווחיות** (ח-ן פתוח נטו, הכנסות, עלות, רווח, % רווח) | **הערות** (הערת סטטוס אחרונה; עריכה inline מהדוח). שורת סה"כ. אזהרות ⚠ בשורה: יתרה שלילית / % אבני דרך ≠ 100 / חוזה ללא חתימה. |
| `fin.hours_and_cost` | שעות ועלות | שורה: פרויקט → עובד; שעות × עלות שעתית היסטורית = עלות |
| `fin.cost_by_project` | עלות לפי פרויקט | עלות שעות + עלות ספקים + סה"כ; מול סכום חוזה |
| `fin.profit_by_client` | רווחיות לקוח | הכנסה, עלות, רווח, % |
| `fin.profit_by_project` | רווחיות פרויקט | כנ"ל + שעות + הוגש/שולם |
| `fin.profit_by_subcontract` | רווחיות לפי תת-חוזה | כנ"ל ברמת תת-חוזה |
| `fin.income_plan_vs_actual` | הכנסות – תכנון מול בפועל | לפי חודש: תכנון = Σ אבני דרך עם `expected_date` בחודש; בפועל = Σ הוגש בחודש; פער |
| `fin.invoices` | חשבונות | רשימת חשבונות עם כל השדות, סינון סטטוס/לקוח/טווח |
| `fin.aging` | גיול חובות | ראה 11.12 |
| `fin.receipts` | תקבולים | רשימה + הקצאות |
| `sup.budget_vs_actual` | ספקים – תקציב מול בפועל | ספק → חוזה ספק: תקציב, אושר, שולם, יתרה, % ביצוע נטען מול % חיוב ללקוח |
| `sup.invoices` | חשבוניות ספקים | רשימה עם סטטוס אישורים |
| `payroll.export` | ייצוא שכר | ראה 10.9 |
| `sys.audit` | יומן שינויים | ראה 14 (אדמין בלבד) |

### 12.5 ייצוא
כל דוח: xlsx / pdf / הדפסה. קבצי ייצוא נשמרים ב-bucket `report-exports` ל-30 יום ומוצעים להורדה ב-signed URL.

### 12.6 דוחות מתוזמנים
מתוך תבנית שמורה: תדירות (יומי/שבועי+יום/חודשי+יום), שעה, נמענים (מיילים), פורמט. Cron `scheduled-reports` מריץ, שולח דרך Resend עם הקובץ מצורף (תבנית `scheduled_report`), מעדכן `last_run_at/next_run_at`. כישלון → התראה ליוצר.

### 12.7 דשבורד (`/dashboard`)
**אדמין (`dashboard.financial`):**
- כרטיסי KPI: סה"כ יתרות להגשה בחוזים פעילים | חשבונות פתוחים (סכום, כמות) | חשבונות באיחור (סכום, כמות) | הוגש החודש / השנה | תקבולים החודש | שעות החודש (וכמה עובדים דיווחו) | עובדים בפיגור דיווח | חשבוניות ספק ממתינות לאישורי | טיוטות ריטיינר ממתינות.
- גרפים: הוגש מול תקבולים ב-12 החודשים האחרונים (עמודות) | שעות לפי מחלקה החודש (עוגה) | 10 הפרויקטים עם היתרה הגדולה (עמודות אופקיות) | גיול חובות לפי דלי (עמודות).
- רשימות: פעולות ממתינות (חשבונות לאישור/חתימה/שליחה, חשבוניות ספק לאישור) | התראות אחרונות.
**מנהל:** שעות המחלקה החודש מול תקן | עובדים בפיגור | פילוח שעות לפי פרויקט (עוגה) | קיצור לכרטיס השעות.
**עובד:** השעות שלי השבוע/החודש מול תקן | ימים חסרים | פילוח לפי פרויקט | כפתור "דווח עכשיו".

---

## 13. התראות

### 13.1 ערוצים
**במערכת** (פעמון בכותרת, ספירה, רשימה, סימון נקרא, קישור לישות) ו**מייל** (Resend). לכל סוג אירוע – ברירת מחדל של ערוצים, ניתנת לשינוי ב-`/settings/notifications` (טבלת אירוע × ערוץ × נמענים).

### 13.2 אירועים
| אירוע | נמענים | ערוץ |
|---|---|---|
| חשבון ממתין לאישור | מאשרים | מערכת + מייל |
| חשבון אושר / נחתם / נשלח | יוצר | מערכת |
| מייל חשבון נדחה (bounce) / נכשל | יוצר + אדמינים | מערכת + מייל |
| חשבון באיחור (סף 30/60/90) | אדמינים | מערכת + מייל |
| טיוטת ריטיינר נוצרה | בעלי `invoices.create` | מערכת |
| תזכורת דיווח שעות | עובד (+מנהל מחלקה) | מייל + מערכת |
| חודש ננעל – סיכום חסרים | אדמינים | מערכת |
| תקופה נפתחה לעובד | עובד | מערכת + מייל |
| דיווח הוזן בשמך | עובד | מערכת |
| חוזה הגיע ל-80% / 100% הגשה | אדמינים + מנהל פרויקט | מערכת |
| ספק חרג מתקציב / ביצוע ספק > חיוב ללקוח | אדמינים + מנהל פרויקט | מערכת + מייל |
| חשבונית ספק ממתינה לאישורך | מאשר | מערכת + מייל |
| חשבונית ספק אושרה/נדחתה | מקליט | מערכת |
| כשל משיכת מדד / חסר מדד לחודש | אדמינים | מערכת + מייל |
| @אזכור בהערת סטטוס | המוזכר | מערכת |
| דוח מתוזמן נכשל | יוצר | מערכת + מייל |
| כשל גיבוי | אדמינים | מייל |

---

## 14. יומן שינויים (Audit)
- טריגר Postgres גנרי על **כל** הטבלאות בפרק 5 (למעט `notifications`, `email_log`, `audit_log`, `report_schedules.last_run_at`).
- נרשם: טבלה, מזהה, פעולה, משתמש (`current_setting('app.user_id')`), זמן, `before`, `after` (jsonb מלא), `request_id`.
- `/admin/audit`: סינון לפי טבלה/ישות/משתמש/טווח/פעולה; תצוגת diff שדה-שדה; ייצוא xlsx.
- בכל מסך ישות – טאב "היסטוריה" מציג את רשומות ה-audit של הישות וילדיה (חוזה ← תתי-חוזים ← אבני דרך).
- פעולות הדורשות סיבה (פתיחת נעילה, ביטול חשבון, שינוי אבן דרך מחויבת, דריסת מע"מ) שומרות את הסיבה בשדה `after.__reason`.
- יומן ה-audit הוא append-only (אין UPDATE/DELETE, נאכף בהרשאות DB).

---

## 15. הגירה מאדמירל (`/admin/import`)

### 15.1 עיקרון
ייבוא **היסטוריה מלאה** מקבצי Excel שיוצאו מאדמירל. המערכת מספקת **תבניות xlsx להורדה** לכל ישות, עם עמודות מוגדרות; הלקוח ממלא/ממפה מהייצוא של אדמירל. כל ייבוא = `import_batch` עם ולידציה מלאה לפני כתיבה (dry-run), דוח שגיאות ברמת שורה, וביצוע בטרנזקציה; אפשרות rollback לכל batch (מחיקת הרשומות שנוצרו בו) כל עוד לא נוצרו עליהן נתונים חדשים.

### 15.2 סדר ייבוא מחייב ותבניות
1. `departments`, `grades`, `stage_names` (אם שונים מה-seed)
2. `users` (עובדים; ללא יצירת Clerk – רק רשומות `users` עם `clerk_user_id=null`, הזמנה נשלחת בנפרד) + `employee_cost_rates`
3. `clients` + `contacts`
4. `suppliers` + `contacts`
5. `projects` (מס' עבודה = מפתח)
6. `contracts` (מפתח: מס' עבודה + מס' חוזה + כיוון)
7. `sub_contracts` (מפתח: + מס' תת-חוזה) – כולל שיטת תמחור ושדותיה
8. `milestones` – כולל `opening_billed_pct`, `opening_paid_amount` **או** לחלופין ייבוא היסטוריית חשבונות מלאה (שלב 10) – לא שניהם לאותו תת-חוזה
9. `time_entries` (עובד לפי מייל, תת-חוזה לפי מפתח, תאריך, דקות, תיאור)
10. `invoices` + `invoice_lines` (חשבונות היסטוריים; סטטוס `sent`/`paid`; מספרים מקוריים נשמרים; PDF מקורי ניתן לצירוף בעמודת קובץ מ-zip)
11. `receipts` + `receipt_allocations`
12. `supplier_invoices`
13. `documents` – zip עם מבנה תיקיות `{work_number}/…` → משויך לפרויקט; אופציונלי מיפוי לחוזה.

### 15.3 ולידציות
ייחודיות מפתחות, קיום FK, אחוזים בטווח, תאריכים תקינים, סכומים ≥ 0 (למעט זיכוי), Σ הקצאות ≤ תקבול, מספרי חשבון לא כפולים. שורה שגויה = כל ה-batch לא נכתב (all-or-nothing), עם דוח שגיאות להורדה.

### 15.4 לאחר ייבוא
- הרצת חישוב יתרות לכל החוזים והשוואה לעמודות "הוגש/שולם/יתרה" בייצוא של אדמירל (עמודות אופציונליות בתבנית) → דוח פערים.
- `settings.numbering` מעודכן למספר הבא אחרי המקסימום שיובא.

---

## 16. ממשק משתמש, RTL ו-i18n

1. **RTL מלא:** `<html dir="rtl" lang="he">`; Tailwind עם logical properties; אייקוני חצים מתהפכים; טבלאות מיושרות ימין; מספרים תמיד LTR בתוך תא (`dir="ltr"` + `unicode-bidi: isolate`).
2. **אנגלית:** מעבר שפה מפרופיל המשתמש; `dir="ltr"` באנגלית; כל המחרוזות ב-`messages/he.json` ו-`messages/en.json` (הקובץ האנגלי חייב להיות מלא – אין fallback חסר). נתוני משתמש (שמות, תיאורים) לא מתורגמים.
3. **פורמטים:** תאריך `dd/mm/yyyy`; שעות `HH:MM`; סכומים `1,234.56 ₪`; אחוזים `12.5%`.
4. **רספונסיביות:** נקודות שבירה: מובייל (< 768) – ניווט תחתון, כרטיס שעות בתצוגה יומית כברירת מחדל, טפסים בעמודה אחת; טאבלט (768–1024); דסקטופ. דוחות וחשבונות – מיועדים לדסקטופ, במובייל מוצגת גלילה אופקית.
5. **נגישות:** ניגודיות AA, ניווט מקלדת, labels לכל שדה, הודעות שגיאה צמודות לשדה.
6. **עיצוב:** נקי, מקצועי; צבע ראשי כחול-סגול כהה מהלוגו של PGL (יוגדר ב-`tailwind.config` כ-`brand`), משני תכלת. אין להעתיק את מראה אדמירל.
7. **מצבי ריקות וטעינה:** skeletons; empty states עם קריאה לפעולה.
8. **אישור פעולות הרסניות:** דיאלוג אישור + הקלדת סיבה כשנדרש.

---

## 17. אבטחה, ביצועים ודרישות לא-פונקציונליות

- **אימות והרשאה:** Clerk; MFA חובה לאדמינים (הגדרה); כל Action עם `requireCapability`; RLS deny-by-default; signed URLs 10 דקות; Rate limiting על Actions רגישים (Upstash או middleware פשוט).
- **סודות:** משתני סביבה בלבד; אין מפתחות בקוד; webhooks מאומתים בחתימה.
- **CSP** ו-headers אבטחתיים (`next.config` → `headers()`).
- **ביצועים:** דפים < 2 שניות ב-P95; דוחות על עד 500K דיווחי שעות באמצעות אגרגציה ב-SQL (views/materialized views ל-`fin.contract_balances` עם רענון בכל אישור חשבון/תקבול, ו-cron לילי); pagination בשרת; ייצוא xlsx בסטרימינג.
- **שלמות נתונים:** constraints ב-DB (check, unique, FK), טרנזקציות לכל פעולה מרובת-טבלאות, נעילת שורות במספור.
- **שמירת נתונים:** 10 שנים; אין מחיקה פיזית; גיבויים לפי 2.4.
- **לוגים:** שגיאות שרת ל-Vercel logs + Sentry (מומלץ; `SENTRY_DSN` אופציונלי).
- **בדיקות (חובה לפני סיום כל שלב):** unit ל-`lib/calc/*` עם ה-fixtures בפרק 11.9 (כיסוי 100% למנוע החישוב); e2e: כניסה+MFA, דיווח שעות שבועי, יצירת חוזה עם תבנית אבני דרך, חשבון מלא (יצירה→אישור→חתימה→שליחה→תקבול), דוח יתרות חוזים, ייבוא batch.

---

## 18. סדר פיתוח מחייב ותנאי סיום

| שלב | תוכן | תנאי סיום (Definition of Done) |
|---|---|---|
| **0 – תשתית** | ריפו, Next.js, Drizzle + migrations לכל הסכמה (פרק 5), Clerk (הזמנות, MFA, webhook), layout RTL + i18n, שכבת הרשאות, audit triggers, settings + אשף (פרק 6), ניהול משתמשים, Storage + signed URLs, Resend בסיסי | אדמין ראשון עובר אשף מלא; משתמש מוזמן נכנס עם MFA; כל טבלה קיימת עם audit; `pnpm test` ירוק |
| **1 – חוזים** | לקוחות, ספקים, אנשי קשר, פרויקטים, חוזים, תתי-חוזים (5 שיטות), אבני דרך + תבניות, בעלי תפקידים, הערות, מסמכים, נעילה, שכפול, חוזי ספק, מנוע יתרות | הדוגמה "אדרת ברעננה" נבנית במלואה ומציגה 189,000 / יתרות נכונות; unit tests ל-balances |
| **2 – שעות** | כרטיס שעות (3 תצוגות), הקצאות, דיווח בשם, נעילה ופתיחה, תזכורות (cron), דשבורד עובד/מנהל | עובד מדווח שבוע מלא במובייל; מנהל רואה מחלקה; חודש ננעל ונפתח |
| **3 – חשבונות** | יצירת חשבון (4 שלבים), מנוע אבני דרך/הצמדה/מע"מ, מדדים (למ"ס + ידני), PDF, זרימת אישור/חתימה/שליחה, תקבולים, זיכוי, גיול, ריטיינר אוטומטי, חשבוניות ספק, ייצוא הנה"ח | ה-PDF זהה מבנית ל"חשבון עסקה 16835" עם הסכומים מפרק 11.9; כל fixtures עוברים; מייל נשלח עם PDF |
| **4 – דוחות ודשבורד** | מחולל דוחות, כל הדוחות בפרק 12, ייצוא, תבניות, תזמון, דשבורד אדמין | דוח יתרות חוזים תואם לצילום 1 בנתוני הדוגמה; ייצוא xlsx/pdf תקין ב-RTL |
| **5 – התראות והשלמות** | כל האירועים בפרק 13, הגדרות התראות, גיבויים ל-R2, Sentry | כל cron רץ ומתועד |
| **6 – הגירה** | תבניות ייבוא, ולידציה, ביצוע, rollback, דוח פערים | ייבוא מלא של קבצי הלקוח ללא שגיאות; יתרות תואמות לאדמירל |
| **7 – הקשחה** | e2e מלא, ביצועים, נגישות, תיעוד למשתמש (`/docs`), `DEVIATIONS.md` סופי | כל הבדיקות ירוקות; מדריך משתמש בעברית |

---

## 19. הנחות והחלטות שהתקבלו בהיעדר מידע – **לאישור הלקוח**

| # | נושא | ההנחה שיושמה במסמך |
|---|---|---|
| 1 | **מרכז רווח** (שאלה 14) | באדמירל "מרכז רווח" הוא יחידה ארגונית שאליה משויכים הכנסות והוצאות לצורך רווחיות (למשל "PGL – תנועה-כבישים"). בהיעדר הבחנה – **מרכז רווח = מחלקה** (טבלה אחת, `departments`). ניתן להפריד בעתיד. |
| 2 | לקוח משלם (שאלה 18) | שדה אופציונלי; אם ריק = הלקוח. פרטי "לכבוד" ותנאי תשלום מהמשלם. |
| 3 | סוגי יחידות (שאלה 35) | lookup עריך עם seed: חניה, ק"מ, צומת, דונם. |
| 4 | "פקטור יתרות פתיחה" | לא יושם כשדה נפרד; יתרות פתיחה מנוהלות ברמת אבן דרך (`opening_billed_pct`, `opening_paid_amount`). |
| 5 | חלון עריכת שעות | "אחרי חודש" = עד סוף החודש העוקב. ניתן לשינוי בהגדרות. |
| 6 | כלל חודש מדד לחשבון | ברירת מחדל: המדד האחרון הידוע בתאריך החשבון; ניתן לדריסה. |
| 7 | לוגיקת "תקבולים בבסיס" / "חשבונות פתוחים במדד בסיס" | לפי הנוסחה בפרק 11.7 – המרת תקבולים וחשבונות קודמים חזרה למחירי בסיס, כך שהפרשי הצמדה מחושבים רק על החלק החדש. **יש לאמת מול עידו.** |
| 8 | רווחיות | הכנסה = הוגש (מחירי בסיס); עלות = שעות × עלות שעתית היסטורית + חשבוניות ספק מאושרות. |
| 9 | אישור כפול לחשבון לקוח | כבוי כברירת מחדל (עידו יוצר ומאשר); ניתן להפעיל. |
| 10 | חתימה דיגיטלית | הטבעת תמונת חתימה + שם + תפקיד + תאריך ב-PDF (לא חתימה אלקטרונית מאושרת מסוג Comsign). ניתן להוסיף בעתיד. |
| 11 | תוכנת הנהלת חשבונות | לא צוינה. יושם ייצוא קובץ עם מיפוי שדות + ממשק adapter. |
| 12 | חוזה ללא תתי-חוזים | תת-חוזה default אוטומטי (פרק 1.2). |
| 13 | סטטוס אוטומטי | כללים בפרק 8.1.5 ו-8.2 עם דריסה ידנית. |
| 14 | הצמדה בתת-חוזה לפי שעות/ריטיינר/יחידות | חלה על סכום החשבון באותו אופן (ratio על `subtotal_base`). |
| 15 | מספר חשבון הבא | 16836 (seed) – לעדכון באשף. |
| 16 | מחלקות | מחלקה 1–6 כ-placeholder עד קבלת הרשימה. |
| 17 | ייבוא היסטוריה | דרך תבניות xlsx שהלקוח ממלא מייצוא אדמירל; לא ייבוא ישיר מה-DB של אדמירל. |
| 18 | חשבונות באנגלית | לא בשלב זה; PDF תמיד בעברית. |

---

## 20. קבצי עזר שיש ליצור בריפו
- `CLAUDE.md` – מפנה למסמך זה כמקור אמת, מזכיר את עקרונות פרק 0 ואת סדר הפיתוח בפרק 18.
- `DEVIATIONS.md` – כל סטייה מהאפיון + סיבה + תאריך.
- `docs/calc-examples.md` – הדוגמאות המספריות מפרק 11.9 בפירוט שלב-אחר-שלב.
- `docs/user-guide-he.md` – מדריך משתמש (שלב 7).
