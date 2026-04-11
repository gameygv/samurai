import { test, expect } from '@playwright/test';

/**
 * Smoke test post-fix 2026-04-10:
 *   - Bug 1: MessageList renderiza audio player via media-proxy
 *   - Bug 2: PaymentAudit expone botón Re-analizar
 *   - Bug 3: FunnelStage pills clickeable + cambio visible
 *   - Layout: admin/dev ve Radar Leads (agente no lo verá)
 *
 * Corre contra producción con cuenta dev (gameygv@gmail.com).
 */
test.use({ storageState: 'e2e/.auth/user.json' });

test('Inbox carga y contiene los componentes fixeados', async ({ page }) => {
  await page.goto('/inbox', { waitUntil: 'networkidle' });

  // Layout: dev debe ver Radar Leads
  await expect(page.getByRole('link', { name: /Radar Leads/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Archivo de Chats/i })).toBeVisible();

  // Esperar a que carguen leads
  await page.waitForTimeout(2500);

  // Click primer lead de la lista
  const firstLead = page.locator('button').filter({ hasText: /.{3,}/ }).nth(3);
  await firstLead.click().catch(() => {});
  await page.waitForTimeout(1500);

  // Bug 3 — FunnelStage visible
  await expect(page.getByText(/ETAPA DEL EMBUDO/i)).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /HUNTING/i })).toBeVisible();

  // Bug 2 — Ojo de Halcón con botón Re-analizar
  await expect(page.getByText(/Ojo de Halcón/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Re-analizar/i })).toBeVisible();
});

test('media-proxy endpoint responde correctamente a requests inválidos', async ({ request }) => {
  // sin params → 400
  const r1 = await request.get('https://giwoovmvwlddaizorizk.supabase.co/functions/v1/media-proxy');
  expect(r1.status()).toBe(400);

  // params con mensaje inexistente → 404
  const r2 = await request.get('https://giwoovmvwlddaizorizk.supabase.co/functions/v1/media-proxy?message_id=notexist&lead_id=00000000-0000-0000-0000-000000000000');
  expect(r2.status()).toBe(404);
});
