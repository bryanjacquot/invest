import { test, expect } from '../fixtures/auth.fixture';
import { SidebarComponent } from '../page-objects/SidebarComponent';

test.describe('Suite 2: Sidebar Navigation & Selection Highlights', () => {
  test('NAV-01: Click Overview navigates and highlights Overview', async ({ page }) => {
    const sidebar = new SidebarComponent(page);
    await sidebar.clickOverview();
    await expect(page).toHaveURL(/\/overview/);
    await expect(sidebar.overviewBtn).toHaveClass(/active/);
  });

  test('NAV-02: Click single account highlights only that account without checkboxes', async ({ page }) => {
    const sidebar = new SidebarComponent(page);
    const firstAccount = page.locator('#sidebar-accounts-list .sidebar-account-item').first();
    await firstAccount.waitFor({ state: 'visible', timeout: 8000 });

    const accName = await firstAccount.locator('.account-item-name').innerText();
    await firstAccount.click();

    await expect(page).toHaveURL(/\/account\?id=/);
    await sidebar.expectAccountActive(accName, true);
    await sidebar.expectAllAccountsActive(false);
  });

  test('NAV-03: Click All Accounts row highlights All Accounts and clears individual highlight', async ({ page }) => {
    const sidebar = new SidebarComponent(page);
    const firstAccount = page.locator('#sidebar-accounts-list .sidebar-account-item').first();
    await firstAccount.waitFor({ state: 'visible', timeout: 8000 });
    await firstAccount.click();
    await expect(page).toHaveURL(/\/account\?id=/);

    await sidebar.clickAllAccounts();
    await expect(page).toHaveURL(/\/account(?!\?id=)/);
    await sidebar.expectAllAccountsActive(true);
  });

  test('NAV-04: Legacy /performance URL routes to unified /account view', async ({ page }) => {
    await page.goto('/performance');
    await expect(page.locator('.account-detail-container')).toBeVisible({ timeout: 10000 });
  });
});
