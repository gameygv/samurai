import { test, expect } from '@playwright/test';

// Login tests do NOT use saved auth state — they test the login page itself
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login page', () => {
  test('valid credentials redirect to dashboard', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email de Acceso').fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel('Clave de Seguridad').fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole('button', { name: 'Acceder al Sistema' }).click();

    await page.waitForURL('/', { timeout: 15000 });
    await expect(page).toHaveURL('/');
  });

  test('invalid password shows error message', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email de Acceso').fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel('Clave de Seguridad').fill('wrong-password-12345');
    await page.getByRole('button', { name: 'Acceder al Sistema' }).click();

    // Sonner toast with error message
    await expect(page.getByText('Email o contraseña incorrectos.')).toBeVisible({
      timeout: 10000,
    });
  });

  test('authenticated user is redirected away from /login', async ({ browser }) => {
    // Create a context WITH saved auth state
    const context = await browser.newContext({
      storageState: 'e2e/.auth/user.json',
    });
    const page = await context.newPage();

    await page.goto('/login');

    // Should redirect to dashboard
    await page.waitForURL('/', { timeout: 15000 });
    await expect(page).toHaveURL('/');

    await context.close();
  });
});
