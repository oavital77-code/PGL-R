# PGL-R

מערכת ניהול פרויקטים, דיווח שעות וחשבונות עבור פי.ג'י.אל. הנדסה ותכנון תחבורה בע"מ – מחליפה את "אדמירל".

- מקור האמת: `docs/spec.md` (מסמך האפיון). סטיות: `DEVIATIONS.md`. התקדמות: `docs/progress.md`. מדריך למשתמש: `docs/user-guide-he.md`. **עלייה לאוויר: `docs/deploy.md`**.
- סטאק: Next.js 15 (App Router, Server Actions), TypeScript strict, Tailwind 4, Drizzle + Supabase Postgres, Clerk, Resend, Playwright (PDF), next-intl (he/en), Vercel Cron.

## הרצה מקומית
```bash
cp .env.example .env.local        # מלא DATABASE_URL, Clerk, Resend, Supabase, CRON_SECRET
pnpm install
pnpm db:migrate && pnpm db:seed   # migrations + seed (סטטוסים, שלבים, תבניות, מע"מ, מחלקות)
pnpm tsx scripts/bootstrap-admin.ts admin@pgl.co.il "שם" "משפחה"   # האדמין הראשון (המשתמש חייב להתקיים ב-Clerk)
pnpm dev
```
בכניסה הראשונה האדמין מופנה לאשף ההגדרה (`/settings/wizard`).

## בדיקות
```bash
pnpm typecheck && pnpm lint
pnpm test                 # unit – מנוע החישוב (100% כיסוי)
DATABASE_URL=postgres://... pnpm test:integration   # מול DB מקומי (migrations + seed)
pnpm test:e2e             # Playwright (דורש APP_BASE_URL ו-E2E_* לפי tests/e2e/README)
```

## פריסה (Vercel + Supabase)
המדריך המלא, שלב אחרי שלב: **[`docs/deploy.md`](docs/deploy.md)**. בקצרה:
1. Supabase: פרויקט Postgres (fra1), הפעלת PITR, `DATABASE_URL` = pooler (6543), `DIRECT_URL` = ישיר (5432).
2. Clerk: כיבוי הרשמה עצמית, הפעלת Invitations, Google OAuth (רק למשתמשים קיימים), webhook ל-`/api/webhooks/clerk` (user.created/updated/deleted).
3. Resend: דומיין מאומת, webhook ל-`/api/webhooks/resend`.
4. Vercel: משתני הסביבה מ-`.env.example`; `vercel.json` מגדיר את ה-cron (זמני UTC). ענפים: `main` = production, `dev` = preview.
5. הכנת הנתונים: `pnpm db:migrate && pnpm db:seed && pnpm storage:init` (ה-buckets הפרטיים: `contracts, invoices, supplier-invoices, general-docs, signatures, company, imports, report-exports`).
