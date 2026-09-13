# PGL-R – מערכת ניהול פרויקטים, דיווח שעות וחשבונות (PGL)

## מקור האמת
מסמך האפיון (גרסה 1.0, 13/09/2026) שנמסר ע"י הלקוח הוא **מקור האמת היחיד** לדרישות.
עותק שלו שמור ב-`docs/spec.md`. אין לנחש, לפרש בחופשיות או "לשפר" דרישה בלי לתעד סטייה ב-`DEVIATIONS.md`.

## עקרונות מחייבים (פרק 0 באפיון)
1. כל טקסט ממשק בעברית (ברירת מחדל) עם מפתחות תרגום לאנגלית (`messages/he.json`, `messages/en.json`). אין מחרוזות קשיחות בקוד.
2. כסף: `numeric(12,2)`, ש"ח בלבד, עיגול half-up. אחוזים: `numeric(6,3)`. אזור זמן `Asia/Jerusalem`, תצוגה `dd/mm/yyyy`.
3. כל גישה לנתונים **בצד שרת בלבד** (Server Actions / Route Handlers) דרך `lib/db`. אין גישה ישירה מהדפדפן ל-Supabase.
4. **מנוע החישובים** (`lib/calc/*`) הוא מודול טהור ללא תלות ב-DB, עם כיסוי בדיקות 100% (`pnpm test`). אין לוגיקת חישוב ברכיבי UI.
5. כל Server Action מתחיל ב-`requireCapability(...)` מ-`lib/auth/authorize.ts`.
6. כל כתיבה ל-DB עוברת דרך `withUser(...)` (`lib/db/with-user.ts`) כדי שהטריגרים ירשמו את המשתמש ב-`audit_log`.
7. Soft delete בלבד לישויות עסקיות.

## סדר פיתוח מחייב (פרק 18 באפיון)
0 תשתית → 1 חוזים → 2 שעות → 3 חשבונות → 4 דוחות ודשבורד → 5 התראות → 6 הגירה → 7 הקשחה.
אין לדלג על שלב 0. מצב ההתקדמות מתועד ב-`docs/progress.md`.

## פקודות
```
pnpm dev            # פיתוח
pnpm typecheck      # tsc --noEmit
pnpm lint
pnpm test           # vitest (unit) – חובה ירוק לפני commit
pnpm db:generate    # drizzle-kit generate (אחרי שינוי סכמה ב-lib/db/schema)
pnpm db:migrate     # הרצת migrations (DIRECT_URL)
pnpm db:seed        # seed אידמפוטנטי
```

## מבנה
ראה פרק 2.7 באפיון. קבצים מרכזיים: `lib/db/schema/*` (Drizzle), `drizzle/*.sql` (migrations, כולל triggers/RLS ב-0001),
`lib/calc/*` (מנוע חישוב), `lib/auth/*` (הרשאות), `lib/settings/*` (הגדרות טיפוסיות), `lib/i18n/*`.
