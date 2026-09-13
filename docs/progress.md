# מצב התקדמות (לפי פרק 18 באפיון)

| שלב | סטטוס | הערות |
|---|---|---|
| 0 – תשתית | ✅ הושלם | Next.js 15 + TS strict, Drizzle schema מלא (פרק 5) + migrations (0000 סכמה, 0001 טריגרים/RLS), Clerk (הזמנות, MFA כפוי, webhook), layout RTL + next-intl (he/en), שכבת הרשאות (`lib/auth`), audit triggers, settings + אשף 16 שלבים, ניהול משתמשים + עלויות שעתיות, Storage + signed URLs + בדיקת magic bytes, Resend + email_log + webhook, cron routes + jobs (מדד למ"ס, נעילת תקופות, תזכורות שעות, גיבוי R2, dump), יומן שינויים + ייצוא xlsx, חיפוש גלובלי, התראות, דשבורדים. `pnpm test` ירוק (100% כיסוי למנוע החישוב). |
| 1 – חוזים | 🔄 בעבודה | מנוע היתרות על DB (`lib/reports/balances.ts`) קיים. מסכי לקוחות/ספקים/פרויקטים/חוזים/תתי-חוזים/אבני דרך – בפיתוח. |
| 2 – שעות | ⏳ | – |
| 3 – חשבונות | ⏳ | – |
| 4 – דוחות ודשבורד | ⏳ (דשבורד לפי תפקיד קיים) | – |
| 5 – התראות והשלמות | ⏳ (תשתית קיימת: `notifyEvent`, ערוצים לפי אירוע) | – |
| 6 – הגירה | ⏳ | – |
| 7 – הקשחה | ⏳ | – |

## הרצה מקומית
1. `cp .env.example .env.local` ומלא ערכים (ראה פרק 2.5 באפיון).
2. `pnpm install`
3. `pnpm db:migrate && pnpm db:seed`
4. ב-Clerk: כבה הרשמה עצמית, צור את האדמין הראשון, והוסף רשומה ב-`users` עם `role='admin'` ו-`email` זהה (או הרץ `pnpm tsx scripts/bootstrap-admin.ts <email> <first> <last>`).
5. `pnpm dev`
