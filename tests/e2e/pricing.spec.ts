import { test, expect } from "@playwright/test";

/**
 * Test 4: Pricing page — verify tier display and CTA buttons
 */

test.describe("Pricing Page", () => {
  test("pricing page shows both tiers", async ({ page }) => {
    await page.goto("/pricing");

    // Both tier cards should be visible
    await expect(page.getByText("Free")).toBeVisible();
    await expect(page.getByText("Premium")).toBeVisible();

    // Pricing amounts
    await expect(page.getByText("$0")).toBeVisible();
    await expect(page.getByText("$19")).toBeVisible();
  });

  test("billing toggle switches between monthly and annual", async ({ page }) => {
    await page.goto("/pricing");

    // Initially shows monthly
    await expect(page.getByText("$19")).toBeVisible();

    // Click the Annual toggle
    const toggle = page.locator("button").filter({ has: page.locator("span.rounded-full.bg-white") });
    await toggle.click();

    // Should show annual pricing
    await expect(page.getByText("$149")).toBeVisible();
    await expect(page.getByText(/Save/)).toBeVisible();
  });

  test("subscribe button exists for non-authenticated users", async ({ page }) => {
    await page.goto("/pricing");

    // Subscribe Now button should be visible
    await expect(page.getByRole("button", { name: /Subscribe Now/i })).toBeVisible();

    // Get Started link should be visible
    await expect(page.getByRole("link", { name: /Get Started/i })).toBeVisible();
  });

  test("pricing page shows feature comparison", async ({ page }) => {
    await page.goto("/pricing");

    // Key features should be listed
    await expect(page.getByText(/Trend queries/i)).toBeVisible();
    await expect(page.getByText(/Daily picks/i)).toBeVisible();
    await expect(page.getByText(/Bet tracking/i)).toBeVisible();
  });

  test("success banner shows after successful checkout", async ({ page }) => {
    await page.goto("/pricing?success=true");
    await expect(page.getByText(/Subscription activated/i)).toBeVisible();
  });

  test("cancel banner shows after canceled checkout", async ({ page }) => {
    await page.goto("/pricing?canceled=true");
    await expect(page.getByText(/Checkout was canceled/i)).toBeVisible();
  });
});
