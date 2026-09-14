import { expect, test } from "@playwright/test";

test("health endpoint", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  expect((await res.json()).ok).toBe(true);
});

test("unauthenticated user is redirected to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/sign-in/);
});

test("security headers are present", async ({ request }) => {
  const res = await request.get("/sign-in");
  expect(res.headers()["x-frame-options"]).toBe("DENY");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("cron endpoints reject requests without the secret", async ({ request }) => {
  const res = await request.get("/api/cron/period-lock");
  expect(res.status()).toBe(401);
});

test("root html is RTL Hebrew", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
});
