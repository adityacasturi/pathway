import { expect, test } from "@playwright/test";

test("landing page renders for anonymous users", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("application", { name: "Pathway recruiting terminal" })).toBeVisible();
  await expect(page.getByText(/PATHWAY v2\.1/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/roles in the last 7 days:/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /pathway > login/i })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole("button", { name: /pathway > register/i })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/register");
});

test("login and signup are public", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();

  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});

test("protected app routes redirect to login", async ({ page }) => {
  for (const path of ["/home", "/applications", "/openings", "/companies", "/alerts", "/chat", "/settings"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
  }
});

test("static company logos and logo proxy auth gate", async ({ request }) => {
  const logo = await request.get("/company-logos/google.png");
  expect(logo.status()).toBe(200);
  expect(logo.headers()["content-type"]).toMatch(/image\/png/);

  const proxy = await request.get("/api/logo?company=Stripe", { maxRedirects: 0 });
  expect(proxy.status()).toBeGreaterThanOrEqual(300);
  expect(proxy.status()).toBeLessThan(400);
  expect(proxy.headers().location).toMatch(/\/login\?next=%2Fapi%2Flogo/);
});

test("security headers are present", async ({ request }) => {
  const response = await request.get("/login");

  expect(response.status()).toBe(200);
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});
