import { test, expect } from '@playwright/test';

test.describe('Stash Web App - Auth Screen', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');

    // Check that the page loads
    await expect(page).toHaveTitle(/Stash/i);
  });

  test('should show auth screen when not logged in', async ({ page }) => {
    await page.goto('/');

    // Auth screen should be visible
    const authScreen = page.locator('#auth-screen');
    await expect(authScreen).toBeVisible();

    // Should show the sign-in button
    const signInBtn = page.locator('#google-signin-btn');
    await expect(signInBtn).toBeVisible();
  });

  test('should have Stash branding on auth screen', async ({ page }) => {
    await page.goto('/');

    // Logo should be visible
    const logo = page.locator('.logo');
    await expect(logo).toBeVisible();

    // Should have app name
    await expect(page.locator('.logo h1')).toHaveText('Stash');
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

  test('should have service worker file', async ({ page }) => {
    // Just verify the SW file exists and is accessible
    const response = await page.goto('/sw.js');
    expect(response?.status()).toBe(200);
  });
});

test.describe('Stash Static Assets', () => {
  test('should load styles', async ({ page }) => {
    const response = await page.goto('/styles.css');
    expect(response?.status()).toBe(200);
  });

  test('should load app.js', async ({ page }) => {
    const response = await page.goto('/app.js');
    expect(response?.status()).toBe(200);
  });
});

// Theme toggle tests - these require the main screen to be visible (authenticated)
// Skipped in CI since we can't authenticate with mock credentials
test.describe('Stash Authenticated Features', () => {
  test.skip(({ browserName }) => true, 'Skipped: requires real Supabase credentials');

  test('should have theme toggle in main screen', async ({ page }) => {
    await page.goto('/');
    const themeToggle = page.locator('.theme-toggle');
    await expect(themeToggle).toBeVisible();
  });

  test('should toggle theme on click', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');
    await page.locator('.theme-toggle').click();
    const newTheme = await html.getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);
  });
});
