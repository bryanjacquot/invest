import { test, expect } from '@playwright/test';

test.describe('Suite 1: Authentication Flow', () => {
  test('AUTH-01: App loads brand logo and elements', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#brand-logo-btn .brand-title')).toBeVisible();
  });

  test('AUTH-02: User can submit credentials and register/log in', async ({ page }) => {
    await page.goto('/');

    const authModal = page.locator('#modal-auth');
    if (await authModal.isVisible()) {
      await page.click('#btn-toggle-auth-mode');
      const uniqueName = `tester_${Date.now()}`;
      await page.fill('#auth-username', uniqueName);
      await page.fill('#auth-password', 'Password123!');
      await page.click('#auth-submit-btn');

      await authModal.waitFor({ state: 'hidden', timeout: 10000 });
    }

    await expect(page.locator('#user-display-name')).toBeVisible();
  });
});
