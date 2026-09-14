# E2E (Playwright)

- Public flows run without credentials: health endpoint, sign-in redirect, security headers, cron auth.
- Authenticated flows (timesheet week, contract with milestone template, invoice lifecycle, contract balances report, import batch) run only when `E2E_EMAIL` / `E2E_PASSWORD` (a Clerk admin with MFA disabled for the test tenant) and `APP_BASE_URL` are set, against a database that was migrated + seeded.

```bash
APP_BASE_URL=http://localhost:3000 E2E_EMAIL=... E2E_PASSWORD=... pnpm test:e2e
```
