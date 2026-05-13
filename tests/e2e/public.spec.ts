import { expect, test } from "@playwright/test";

test("login renders and signup password policy is visible", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Password", exact: true })).toBeVisible();
  await expect(page.getByLabel("Universities using Pathway")).toHaveCount(0);

  await page.getByRole("button", { name: "Create an account" }).click();

  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  await expect(page.getByText("Use your @uw.edu email for now.")).toBeVisible();
  await expect(page.getByText("Needs work")).toBeVisible();
  await expect(page.getByText("8+ chars with A/a/1/!")).toBeVisible();
  await expect(page.locator('input[name="password"]')).toHaveAttribute("minlength", "8");
  await expect(page.locator('input[name="password"]')).toHaveAttribute("pattern", /\?=.*\[A-Z\]/);
});

test("signup blocks invalid email and weak password before submit", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();

  const submit = page.getByRole("button", { name: "Create account" });
  await expect(submit).toBeEnabled();

  await page.getByLabel("Email").fill("person@example.com");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("password1");

  await expect(page.getByText("Use your @uw.edu email for now.")).toBeVisible();
  await expect(page.getByText("Getting stronger")).toBeVisible();

  await page.getByLabel("Email").fill("PERSON@example.com");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("Stronger1!");

  await expect(page.getByText("Use your @uw.edu email for now.")).toBeVisible();
  await expect(page.getByText("Use your @uw.edu email for now.")).toBeVisible();

  await page.getByLabel("Email").fill("student@uw.edu");

  await expect(submit).toBeEnabled();
});

test("landing page renders for anonymous users", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Find roles faster/i })).toBeVisible();
  await expect(page.getByText(/Exclusive beta access for/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Pathway home" })).toBeVisible();
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
