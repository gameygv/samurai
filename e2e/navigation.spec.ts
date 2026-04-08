import { test, expect } from '@playwright/test';

test.describe('Sidebar navigation', () => {
  test('navigates to Contactos page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });

    await page.locator('aside').getByText('Contactos').click();
    await page.waitForURL('/contacts');

    await expect(page.getByText('Directorio de Contactos')).toBeVisible({
      timeout: 15000,
    });
  });

  test('navigates to Leads page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });

    await page.locator('aside').getByText('Radar Leads').click();
    await page.waitForURL('/leads');

    // Leads page should have content (not blank)
    await expect(page.locator('main')).not.toBeEmpty();
  });

  test('navigates to Pipeline page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('aside')).toBeVisible({ timeout: 15000 });

    await page.locator('aside').getByText('Pipeline Ventas').click();
    await page.waitForURL('/pipeline');

    await expect(page.locator('main')).not.toBeEmpty();
  });
});
