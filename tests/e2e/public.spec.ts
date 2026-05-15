import { expect, test } from "@playwright/test";

test("login renders with public signup available", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Password", exact: true })).toBeVisible();
  await expect(page.getByLabel("Universities using Pathway")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
  await expect(page.getByText(/Signups are paused/i)).toHaveCount(0);
});

test("signup blocks non-edu emails before submit", async ({ page }) => {
  await page.goto("/register");

  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  await page.getByLabel("Email").fill("person@example.com");
  await expect(page.getByText("Use your school .edu email.")).toBeVisible();
  await expect(
    page.getByLabel("Email").evaluate((input) => (input as HTMLInputElement).validity.patternMismatch),
  ).resolves.toBe(true);

  await page.getByLabel("Email").fill("student@example.edu");
  await expect(
    page.getByLabel("Email").evaluate((input) => (input as HTMLInputElement).validity.patternMismatch),
  ).resolves.toBe(false);
});

test("landing page renders for anonymous users", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Find roles faster/i })).toBeVisible();
  await expect(page.getByText(/Now open for students with a/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: /Get started/i })).toHaveAttribute("href", "/register");
  await expect(page.getByRole("link", { name: "Pathway home" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Join the waitlist/i })).toHaveCount(0);
  await expect(page.getByLabel("Universities using Pathway")).toBeVisible();
  await expect(page.getByRole("link", { name: "View product" })).toHaveCount(0);
  await expect(page.getByText("Built for internship recruiting")).toHaveCount(0);
  await expect(page.getByAltText("University of Illinois Urbana-Champaign logo")).toHaveCount(0);
  await expect(page.getByAltText("Cornell University logo")).toHaveCount(0);
  await expect(page.getByAltText("Pathway applications table with filters, application counts, and internship rows")).toBeVisible();
  await expect(page.getByAltText("Pathway application detail panel with timeline, details, and event controls")).toBeVisible();
  await expect(page.getByAltText("Pathway stats page showing recruiting metrics and Sankey flow")).toBeVisible();
  await expect(page.getByText("Notes and next steps together")).toHaveCount(0);
  await expect(page.getByText("Progress at a glance")).toHaveCount(0);
  await expect(page.getByText("Launchpad")).toHaveCount(0);
  await expect(page.getByText(/quiet operating system/i)).toHaveCount(0);
  await expect(page.getByText("manual spreadsheets required")).toHaveCount(0);
  await expect(
    page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight),
  ).resolves.toBe(true);
});

test("protected pages redirect anonymous users to landing", async ({ page }) => {
  await page.goto("/applications");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /Find roles faster/i })).toBeVisible();
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
