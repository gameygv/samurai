import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');

  // Fill login form using exact labels from Login.tsx
  await page.getByLabel('Email de Acceso').fill(process.env.E2E_USER_EMAIL!);
  await page.getByLabel('Clave de Seguridad').fill(process.env.E2E_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Acceder al Sistema' }).click();

  // Wait for redirect to dashboard
  await page.waitForURL('/', { timeout: 15000 });

  // Save auth state
  await page.context().storageState({ path: authFile });
});
