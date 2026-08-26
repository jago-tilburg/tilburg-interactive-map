import { test, expect } from "@playwright/test";

// Smoke-level only: a real magic-link email can't be completed by an
// automated browser without an email API integration. Full completion is
// verified manually against the deployed staging URL (see the plan's
// verification section) — this test just confirms the account-chooser and
// visitor email-submit UI render and are reachable.
test("account chooser opens and the visitor email-submit step renders", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Account" }).click();
  await expect(page.getByRole("dialog", { name: "Wie ben je?" })).toBeVisible();

  await page.getByText("👤 Ik ben bezoeker").click();
  await expect(page.getByRole("dialog", { name: "Inloggen als bezoeker" })).toBeVisible();
  await expect(page.getByLabel("E-mailadres")).toBeVisible();
  await expect(page.getByText("Verstuur inloglink")).toBeVisible();
});
