import { test, expect } from '@playwright/test';

test.describe('Contacts page', () => {
  test('contacts list renders with table', async ({ page }) => {
    await page.goto('/contacts');

    // Wait for heading
    await expect(page.getByText('Directorio de Contactos')).toBeVisible({
      timeout: 15000,
    });

    // Table should be present
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
  });

  test('search input is functional', async ({ page }) => {
    await page.goto('/contacts');

    await expect(page.getByText('Directorio de Contactos')).toBeVisible({
      timeout: 15000,
    });

    // Search input should be available
    const searchInput = page.getByPlaceholder(/Buscar por nombre/i);
    await expect(searchInput).toBeVisible();

    // Typing in search should not crash the page
    await searchInput.fill('test');
    await expect(page.locator('table')).toBeVisible();
  });
});
