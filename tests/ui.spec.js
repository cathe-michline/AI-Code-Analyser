const { test, expect } = require("@playwright/test");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("shows the main controls", async ({ page }) => {
  await expect(
    page.getByRole("heading", {
      name: "AI Code Explainer & Refactoring Assistant",
    })
  ).toBeVisible();
  await expect(page.locator("#codeInput")).toBeVisible();
  await expect(page.locator("#modeSelect")).toBeVisible();
  await expect(page.locator("#langSelect")).toBeVisible();
});

test("switches the right-hand tabs", async ({ page }) => {
  // Two buttons are labelled "Tests" (action vs tab), so use ids.
  await page.locator("#tabRefactorBtn").click();
  await expect(page.locator("#tab-refactor")).toBeVisible();

  await page.locator("#tabTestsBtn").click();
  await expect(page.locator("#tab-tests")).toBeVisible();

  await page.locator("#tabSecurityBtn").click();
  await expect(page.locator("#tab-security")).toBeVisible();

  await page.locator("#tabExplainBtn").click();
  await expect(page.locator("#tab-explain")).toBeVisible();
});

test("mode select updates the beginner/pro label", async ({ page }) => {
  await expect(page.locator("#currentModeText")).toContainText("Beginner");

  await page.locator("#modeSelect").selectOption("pro");
  await expect(page.locator("#currentModeText")).toContainText("Pro");

  await page.locator("#modeSelect").selectOption("beginner");
  await expect(page.locator("#currentModeText")).toContainText("Beginner");
});

test("Clear empties the code box", async ({ page }) => {
  const codeBox = page.locator("#codeInput");
  await expect(codeBox).not.toHaveValue("");

  await page.locator("#clearBtn").click();
  await expect(codeBox).toHaveValue("");
});

test("Analyze does nothing when the code box is empty", async ({ page }) => {
  await page.locator("#clearBtn").click();
  await page.locator("#analyzeBtn").click();
  await expect(page.locator("#loading")).toHaveClass(/hidden/);
});
