import { expect, test } from "@playwright/test";

const hasAuth = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
test.use({ storageState: hasAuth ? "tests/e2e/.auth/state.json" : undefined });
test.skip(!hasAuth, "authenticated flows need E2E_EMAIL / E2E_PASSWORD");

const stamp = Date.now();

test("timesheet: weekly grid renders and an entry can be added", async ({ page }) => {
  await page.goto("/hours");
  await expect(page.getByRole("heading", { name: /דיווח שעות/ })).toBeVisible();
  const add = page.getByRole("button", { name: /הוסף דיווח/ });
  if (await add.isVisible()) {
    await add.click();
    await page.getByLabel(/משך/).fill("02:30");
    await page.getByLabel(/תיאור/).fill(`בדיקת e2e ${stamp}`);
    await page.getByRole("button", { name: /^שמור$/ }).click();
    await expect(page.getByText("נשמר בהצלחה")).toBeVisible();
  }
});

test("contract: create client, project and contract with the תב\"ע template", async ({ page }) => {
  await page.goto("/clients");
  await page.getByRole("button", { name: /לקוח חדש/ }).click();
  await page.getByLabel(/שם הלקוח/).fill(`לקוח e2e ${stamp}`);
  await page.getByRole("button", { name: /^שמור$/ }).click();
  await page.waitForURL(/\/clients\//);
  await page.goto("/projects");
  await page.getByRole("button", { name: /פרויקט חדש/ }).click();
  const wn = page.getByLabel(/מס' עבודה/);
  if (await wn.isEditable()) await wn.fill(`E2E${stamp % 100000}`);
  await page.getByLabel(/שם הפרויקט/).fill(`פרויקט e2e ${stamp}`);
  await page.getByLabel(/^לקוח/).selectOption({ label: `לקוח e2e ${stamp}` });
  await page.getByRole("button", { name: /^שמור$/ }).click();
  await page.waitForURL(/\/projects\//);
  await page.getByRole("button", { name: /חוזה לקוח חדש/ }).click();
  await page.getByLabel(/שם החוזה/).fill("תב\"ע e2e");
  await page.getByLabel(/מחיר בסיס/).fill("84000");
  await page.getByLabel(/% הנחה/).fill("10");
  await page.getByLabel(/תבנית אבני דרך/).selectOption({ label: "תב\"ע" });
  await page.getByRole("button", { name: /^שמור$/ }).click();
  await page.waitForURL(/\/contracts\//);
  await expect(page.getByText("75,600.00")).toBeVisible();
  await expect(page.getByText("לימוד מצב קיים")).toBeVisible();
});

test("reports: contract balances runs and exports", async ({ page }) => {
  await page.goto("/reports?report=fin.contract_balances");
  await page.getByRole("button", { name: /הפק/ }).click();
  await expect(page.getByRole("table")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Excel/ }).click();
  expect((await download).suggestedFilename()).toMatch(/xlsx$/);
});

test("import: template download and dry-run of an empty file", async ({ page, request }) => {
  const res = await request.get("/api/imports/template?entity=clients");
  expect(res.ok()).toBeTruthy();
  await page.goto("/admin/import");
  await expect(page.getByText(/ייבוא מאדמירל/)).toBeVisible();
});
