import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('page loads with heading', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test('stat cards are visible', async ({ page }) => {
    await page.goto('/');

    // Wait for dashboard to finish loading
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible({
      timeout: 15000,
    });

    // Verify the 4 stat cards by their titles (exact match to avoid sidebar nav links)
    await expect(page.getByText('Ventas', { exact: true })).toBeVisible();
    await expect(page.getByText('Revenue', { exact: true })).toBeVisible();
    await expect(page.getByText('Cartera', { exact: true })).toBeVisible();
    await expect(page.getByText('Match CAPI', { exact: true })).toBeVisible();
  });

  test('sidebar navigation is present', async ({ page }) => {
    await page.goto('/');

    // Layout sidebar should have the brand name and nav links
    await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Dashboard').first()).toBeVisible();
  });
});
