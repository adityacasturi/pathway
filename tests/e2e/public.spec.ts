import { expect, test } from "@playwright/test";

const LANDING_HERO = /Beat the crowd to new internships/i;

test("login renders with public signup available", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Password", exact: true })).toBeVisible();
  await expect(page.getByLabel("Universities using Pathway")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Forgot password?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
  await expect(page.getByText(/Signups are paused/i)).toHaveCount(0);
});

test("signup accepts any valid email domain", async ({ page }) => {
  await page.goto("/register");

  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();

  await page.getByLabel("Email").fill("person@example.com");
  await expect(page.getByText("Use your school .edu email.")).toHaveCount(0);
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "false");

  await page.getByLabel("Email").fill("bad");
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
});

test("register is the dedicated signup route", async ({ page }) => {
  await page.goto("/register");

  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
});

test("landing page renders for anonymous users", async ({ page }) => {
  await page.goto("/");

  const publicNav = page.getByLabel("Public navigation");
  await expect(page.getByRole("heading", { name: LANDING_HERO })).toBeVisible();
  await expect(page.getByText(/real-time alerts/i)).toBeVisible();
  await expect(publicNav.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  await expect(publicNav.getByRole("link", { name: /Get started/i })).toHaveAttribute("href", "/register");
  await expect(page.getByRole("link", { name: "Pathway home" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Join the waitlist/i })).toHaveCount(0);
  await expect(page.getByLabel("Universities using Pathway")).toBeVisible();
  await expect(page.getByAltText("University of Washington logo")).toBeVisible();
  await expect(page.getByRole("link", { name: "View product" })).toHaveCount(0);
  await expect(page.getByText("Built for internship recruiting")).toHaveCount(0);
  await expect(page.getByAltText("University of Illinois Urbana-Champaign logo")).toHaveCount(0);
  await expect(page.getByAltText("Cornell University logo")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Social proof" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Land your dream internship as a/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Simple plans for your internship search/i })).toBeVisible();
  await expect(page.getByRole("table", { name: "Pathway pricing features" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Everything your search needs/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /New roles, the second they post/i })).toBeVisible();
  await expect(page.getByText("Notes and next steps together")).toHaveCount(0);
  await expect(page.getByText("Progress at a glance")).toHaveCount(0);
  await expect(page.getByText("Launchpad")).toHaveCount(0);
  await expect(page.getByText(/quiet operating system/i)).toHaveCount(0);
  await expect(page.getByText("manual spreadsheets required")).toHaveCount(0);
  await expect(page.getByAltText("Google logo")).toBeVisible();
  await expect(
    page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight),
  ).resolves.toBe(true);
});

test("landing company logos are public static assets", async ({ request }) => {
  const response = await request.get("/company-logos/google.png");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toMatch(/image\/png/);
});

test("logo proxy is not available to anonymous users", async ({ request }) => {
  const response = await request.get("/api/logo?company=Stripe", {
    maxRedirects: 0,
  });

  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);
  expect(response.headers().location).toMatch(/\/login\?next=%2Fapi%2Flogo%3Fcompany%3DStripe$/);
});

test("protected pages redirect anonymous users to landing", async ({ page }) => {
  for (const path of ["/applications", "/openings", "/home", "/companies", "/insights", "/settings"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  }
});

test("security headers are present on app responses", async ({ request }) => {
  const response = await request.get("/login");

  expect(response.status()).toBe(200);
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(response.headers()["permissions-policy"]).toContain("camera=()");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});
