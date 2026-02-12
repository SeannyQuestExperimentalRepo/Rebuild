import { test, expect } from "@playwright/test";

/**
 * Test 3: Odds page — compare lines across books
 */

test.describe("Odds Page", () => {
  test("odds page loads", async ({ page }) => {
    await page.goto("/odds");

    // Page heading
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("odds page has no JavaScript errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/odds");
    await page.waitForTimeout(2000);

    expect(errors).toHaveLength(0);
  });
});
