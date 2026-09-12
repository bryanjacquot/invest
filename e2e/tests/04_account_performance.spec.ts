import { test, expect } from '../fixtures/auth.fixture';
import { AccountPage } from '../page-objects/AccountPage';

test.describe('Suite 4: Account Performance & Controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/account');
    await page.locator('.account-detail-container').waitFor({ state: 'visible', timeout: 10000 });
  });

  test('ACC-01: Metric unit toggle converts between % and $ without losing state', async ({ page }) => {
    const accPage = new AccountPage(page);
    await accPage.btnUnitDollar.click();
    await expect(page).toHaveURL(/unit=dollar/);
    await expect(page.locator('#chart-title')).toContainText('($)');

    await accPage.btnUnitPct.click();
    await expect(page).toHaveURL(/unit=pct/);
    await expect(page.locator('#chart-title')).toContainText('(%)');
  });

  test('ACC-02: Horizon selection updates timeframe in URL and summary', async ({ page }) => {
    const accPage = new AccountPage(page);
    await accPage.selectTimeframe('3Y');
    await expect(page).toHaveURL(/timeframe=3Y/);
    await expect(page.locator('.current-tf-label').first()).toHaveText('3Y');
  });

  test('ACC-03: View format toggles between Chart and Table', async ({ page }) => {
    const accPage = new AccountPage(page);
    await accPage.switchToTable();
    await expect(accPage.matrixTable).toBeVisible();
    await expect(page.locator('#performance-chart-container')).toBeHidden();

    await accPage.switchToChart();
    await expect(page.locator('#performance-chart-container')).toBeVisible();
    await expect(accPage.matrixTable).toBeHidden();
  });

  test('ACC-04: Subtab buttons display "Performance" and "Holdings"', async ({ page }) => {
    const accPage = new AccountPage(page);
    await expect(accPage.tabPerformance).toHaveText('Performance');
    await expect(accPage.tabHoldings).toHaveText('Holdings');
  });

  test('ACC-05: Lifetime horizon displays non-zero return and targets for accounts', async ({ page }) => {
    const accPage = new AccountPage(page);
    await accPage.selectTimeframe('LIFETIME');
    await expect(page).toHaveURL(/timeframe=LIFETIME/);
    await expect(accPage.metricActualReturn).not.toHaveText('+0.00%');
    await page.screenshot({ path: '/Users/bryanjacquot/.gemini/antigravity-ide/brain/2cc0767f-06a1-4496-b069-48b08501c86b/account_renamed_subtabs.png' });

    // Click on Ally High Yield Savings account
    const allyItem = page.locator('#sidebar-accounts-list .sidebar-account-item', { hasText: 'Ally High Yield Savings' });
    await allyItem.click();
    await expect(page.locator('#account-view-title')).toHaveText('Ally High Yield Savings');
    await expect(accPage.metricActualReturn).not.toHaveText('+0.00%');
    await expect(accPage.metricTargetReturn).not.toHaveText('+0.00%');
    await page.screenshot({ path: '/Users/bryanjacquot/.gemini/antigravity-ide/brain/2cc0767f-06a1-4496-b069-48b08501c86b/ally_account_lifetime_performance.png' });
  });
});
