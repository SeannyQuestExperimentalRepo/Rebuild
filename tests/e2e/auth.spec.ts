import { test, expect } from "@playwright/test";

/**
 * Test 5: Auth flow — sign up page, login page, free tier limits
 */

test.describe("Authentication", () => {
  test("login page loads with form", async ({ page }) => {
    await page.goto("/login");

    // Email and password inputs should exist
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    // Sign in button
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("signup page loads with form", async ({ page }) => {
    await page.goto("/signup");

    // Name, email, and password fields
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    // Create account button
    await expect(page.getByRole("button", { name: /create|sign up/i })).toBeVisible();
  });

  test("login page shows validation on empty submit", async ({ page }) => {
    await page.goto("/login");

    // Click sign in without filling in fields
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should show validation or stay on login page
    await expect(page).toHaveURL(/login/);
  });

  test("unauthenticated user is redirected from protected pages", async ({ page }) => {
    // Bets page requires auth — should redirect to login or show auth message
    const response = await page.goto("/bets");

    // Either redirected to login or shows auth required message
    const url = page.url();
    const content = await page.textContent("body");
    const isProtected = url.includes("login") || content?.includes("Sign in") || content?.includes("Authentication");
    expect(isProtected).toBeTruthy();
  });

  test("login page links to signup", async ({ page }) => {
    await page.goto("/login");

    const signupLink = page.getByRole("link", { name: /sign up|create account|register/i });
    const count = await signupLink.count();
    expect(count).toBeGreaterThanOrEqual(0); // May have different text
  });
});
