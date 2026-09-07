import { test, expect } from '../fixtures/auth.fixture';
import { AccountPage } from '../page-objects/AccountPage';

test.describe('Suite 5: Holdings & Asset Allocation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/account');
    await page.locator('.account-detail-container').waitFor({ state: 'visible', timeout: 10000 });
  });

  test('HLD-01: Switching to Holdings tab displays Donut chart and Holdings table', async ({ page }) => {
    const accPage = new AccountPage(page);
    await accPage.switchToHoldings();
    await expect(page).toHaveURL(/tab=holdings/);
    await expect(page.locator('#accountAllocationChart')).toBeVisible();
    await expect(page.locator('#holdings-tbody')).toBeVisible();
  });

  test('HLD-02: Holdings search filters table rows', async ({ page }) => {
    const accPage = new AccountPage(page);
    await accPage.switchToHoldings();

    const searchInput = page.locator('#holding-search-input');
    await searchInput.fill('VTI');
    await page.waitForTimeout(300);

    const rows = page.locator('#holdings-tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
