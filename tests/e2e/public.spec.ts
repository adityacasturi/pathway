import { expect, test } from "@playwright/test";

test("login renders and signup password policy is visible", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();

  await page.getByRole("button", { name: "Create an account" }).click();

  await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
  await expect(page.getByText("Use a real, permanent email address.")).toBeVisible();
  await expect(page.getByText("Needs work")).toBeVisible();
  await expect(page.getByText("8+ chars with A/a/1/!")).toBeVisible();
  await expect(page.locator('input[name="password"]')).toHaveAttribute("minlength", "8");
  await expect(page.locator('input[name="password"]')).toHaveAttribute("pattern", /\?=.*\[A-Z\]/);
});

test("signup blocks invalid email and weak password before submit", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Create an account" }).click();

  const submit = page.getByRole("button", { name: "Create account" });
  await expect(submit).toBeDisabled();

  await page.getByLabel("Email").fill("person@mailinator.com");
  await page.getByLabel("Password").fill("password1");

  await expect(page.getByText("Use a permanent email address.")).toBeVisible();
  await expect(submit).toBeDisabled();

  await page.getByLabel("Email").fill("PERSON@example.com");
  await page.getByLabel("Password").fill("Stronger1!");

  await expect(submit).toBeEnabled();
});

test("protected pages redirect anonymous users to login", async ({ page }) => {
  await page.goto("/applications");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
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
