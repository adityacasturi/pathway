import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const canMutate = process.env.E2E_ALLOW_MUTATION === "1";

test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated smoke tests.");

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email ?? "");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
}

test("authenticated user can navigate core app surfaces", async ({ page }) => {
  await signIn(page);

  await page.goto("/applications");
  await expect(page.getByRole("heading", { name: "Applications" })).toBeVisible();

  await page.goto("/live");
  await expect(page.getByRole("heading", { name: "Openings" })).toBeVisible();

  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "Companies" })).toBeVisible();
  await expect(page.getByPlaceholder(/Search company, role, or location/)).toBeVisible();

  await page.goto("/stats");
  await expect(page.getByRole("heading", { name: "Insights" })).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByText(email ?? "")).toBeVisible();
});

test("discover feed renders without duplicate visible posting links", async ({ page }) => {
  await signIn(page);
  await page.goto("/discover");

  const hrefs = await page
    .getByTestId("posting-row")
    .locator('a[target="_blank"]')
    .evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).href).filter(Boolean),
    );

  expect(hrefs.length).toBe(new Set(hrefs).size);
});

test("authenticated user can create, edit, add an event, and delete an application", async ({ page }) => {
  test.skip(!canMutate, "Set E2E_ALLOW_MUTATION=1 to run mutation smoke tests.");

  await signIn(page);
  await page.goto("/applications");

  const company = `E2E Pathway ${Date.now()}`;
  const editedCompany = `${company} Edited`;
  await page.getByRole("button", { name: "Add application" }).click();
  await page.getByRole("textbox", { name: "Company", exact: true }).fill(company);
  await page.getByRole("textbox", { name: "Role", exact: true }).fill("Production Smoke Intern");
  await page.getByRole("button", { name: "Add" }).click();

  const row = page.getByTestId("application-row").filter({ hasText: company });
  await expect(row).toBeVisible();

  await row.click();
  await page.getByRole("textbox", { name: "Company", exact: true }).fill(editedCompany);
  await page.getByRole("textbox", { name: "Company", exact: true }).press("Enter");
  await expect(page.getByText("Saved")).toBeVisible();

  await page.getByRole("button", { name: "Interview", exact: true }).click();
  await page.getByRole("button", { name: "Add event" }).click();
  await expect(page.getByText(/Interview/i).first()).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  const editedRow = page.getByTestId("application-row").filter({ hasText: editedCompany });
  await expect(editedRow).toBeVisible();

  await editedRow.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
  await editedRow.click({ button: "right", position: { x: 24, y: 24 } });
  await page.getByRole("button", { name: "Delete application" }).click();
  await page.getByTestId("confirm-delete-application").click();
  await expect(editedRow).toHaveCount(0);
});

test("authenticated user can dismiss and restore a discover posting", async ({ page }) => {
  test.skip(!canMutate, "Set E2E_ALLOW_MUTATION=1 to run mutation smoke tests.");

  await signIn(page);
  await page.goto("/discover");
  await expect(page.getByRole("heading", { name: "Companies" })).toBeVisible();

  const firstRow = page.getByTestId("posting-row").first();
  await expect(firstRow.or(page.getByText("Nothing matches the filters."))).toBeVisible();
  if ((await firstRow.count()) === 0) test.skip(true, "No discover postings available.");

  const postingId = await firstRow.getAttribute("data-posting-id");
  expect(postingId).toBeTruthy();

  await firstRow.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.locator(`[data-posting-id="${postingId}"]`)).toHaveCount(0);

  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByLabel("Show dismissed").check();
  const dismissedRow = page.locator(`[data-posting-id="${postingId}"]`);
  await expect(dismissedRow).toBeVisible();

  await page.getByRole("heading", { name: "Companies" }).click();
  await dismissedRow.scrollIntoViewIfNeeded();
  await expect(dismissedRow.getByRole("button", { name: "Restore" })).toBeEnabled();
  await dismissedRow.getByRole("button", { name: "Restore" }).click();
  await expect(dismissedRow).toBeVisible();
});
