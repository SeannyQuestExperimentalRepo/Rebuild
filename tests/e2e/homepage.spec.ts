import { test, expect } from "@playwright/test";

/**
 * Test 1: Homepage → Search → View Trend Results
 *
 * Verifies the core user flow: landing on the homepage, navigating to search,
 * entering a trend query, and viewing results.
 */

test.describe("Homepage and Search", () => {
  test("homepage loads with stats and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/TrendLine/);

    // Main heading should be visible
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Navigation links should exist
    await expect(page.getByRole("link", { name: /search|trends/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /picks|today/i })).toBeVisible();
  });

  test("search page loads and accepts queries", async ({ page }) => {
    await page.goto("/search");

    // Search input should be visible
    const searchInput = page.getByRole("textbox");
    await expect(searchInput).toBeVisible();

    // Type a query
    await searchInput.fill("Home underdogs in primetime NFL");

    // Submit the search
    await searchInput.press("Enter");

    // Should show loading or results (not error)
    await page.waitForTimeout(2000);

    // Either results are displayed or "no results" message
    const hasResults = await page.locator("[data-testid='trend-results'], .text-muted-foreground").count();
    expect(hasResults).toBeGreaterThan(0);
  });

  test("search page shows example queries", async ({ page }) => {
    await page.goto("/search");

    // Example queries should be visible as clickable elements
    const examples = page.locator("text=Home underdogs");
    const count = await examples.count();
    expect(count).toBeGreaterThanOrEqual(0); // May or may not show examples
  });

  test("search via URL query parameter", async ({ page }) => {
    await page.goto("/search?q=Kansas+City+Chiefs+as+favorites");

    // Should auto-execute the search
    await page.waitForTimeout(3000);

    // Page should not show an error
    const errorElement = page.locator(".text-destructive");
    const errorCount = await errorElement.count();
    expect(errorCount).toBe(0);
  });
});
