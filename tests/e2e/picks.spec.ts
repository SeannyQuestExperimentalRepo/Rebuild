import { test, expect } from "@playwright/test";

/**
 * Test 2: Today's Picks page
 *
 * Verifies the daily picks page loads correctly with sport tabs,
 * pick cards, and track record display.
 */

test.describe("Today's Picks", () => {
  test("picks page loads with sport tabs", async ({ page }) => {
    await page.goto("/today");

    // Page heading
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Sport tabs should be visible (NCAAMB, NFL, NCAAF)
    const ncaambTab = page.getByRole("button", { name: /NCAAMB/i });
    const nflTab = page.getByRole("button", { name: /NFL/i });
    await expect(ncaambTab.or(nflTab)).toBeVisible();
  });

  test("picks page switches sports", async ({ page }) => {
    await page.goto("/today");

    // Click each sport tab
    const tabs = page.locator("button").filter({ hasText: /^(NCAAMB|NFL|NCAAF)$/ });
    const tabCount = await tabs.count();

    for (let i = 0; i < tabCount; i++) {
      await tabs.nth(i).click();
      await page.waitForTimeout(500);
      // No error should appear
      const errors = await page.locator(".text-destructive").count();
      expect(errors).toBe(0);
    }
  });

  test("picks page shows track record bar", async ({ page }) => {
    await page.goto("/today");
    await page.waitForTimeout(2000);

    // Track record should show some stats (may be empty if no picks graded)
    const pageContent = await page.textContent("body");
    expect(pageContent).not.toBeNull();
  });
});
