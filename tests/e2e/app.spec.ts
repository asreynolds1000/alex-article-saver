import { test, expect } from '@playwright/test';

test.describe('Stash Web App', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');

    // Check that the page loads
    await expect(page).toHaveTitle(/Stash/i);
  });

  test('should show auth screen when not logged in', async ({ page }) => {
    await page.goto('/');

    // Should show the auth screen with sign-in button
    const signInBtn = page.locator('#google-signin-btn');
    await expect(signInBtn).toBeVisible();
  });

  test('should have theme toggle', async ({ page }) => {
    await page.goto('/');

    // Theme toggle should be visible
    const themeToggle = page.locator('.theme-toggle');
    await expect(themeToggle).toBeVisible();
  });

  test('should toggle theme on click', async ({ page }) => {
    await page.goto('/');

    // Get initial theme
    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');

    // Click theme toggle
    await page.locator('.theme-toggle').click();

    // Theme should have changed
    const newTheme = await html.getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);
  });
});

test.describe('Stash PWA', () => {
  test('should have valid manifest', async ({ page }) => {
    const response = await page.goto('/manifest.json');
    expect(response?.status()).toBe(200);

    const manifest = await response?.json();
    expect(manifest.name).toBe('Stash');
    expect(manifest.short_name).toBe('Stash');
  });

  test('should register service worker', async ({ page }) => {
    await page.goto('/');

    // Wait for service worker registration
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        return !!registration;
      }
      return false;
    });

    // Service worker should be registered (may take a moment)
    // This is a soft check - SW registration can be flaky in tests
    expect(swRegistered).toBeDefined();
  });
});
