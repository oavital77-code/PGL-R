import { test as setup } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

setup("sign in", async ({ page }) => {
  setup.skip(!email || !password, "E2E_EMAIL / E2E_PASSWORD not set");
  await page.goto("/sign-in");
  await page.getByLabel(/דוא"ל|Email/).fill(email!);
  await page.getByRole("button", { name: /המשך|Continue/ }).click();
  await page.getByLabel(/סיסמה|Password/).fill(password!);
  await page.getByRole("button", { name: /המשך|Continue/ }).click();
  await page.waitForURL(/dashboard|settings/);
  await page.context().storageState({ path: "tests/e2e/.auth/state.json" });
});
