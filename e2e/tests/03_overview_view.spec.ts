import { test, expect } from '../fixtures/auth.fixture';
import { OverviewPage } from '../page-objects/OverviewPage';

test.describe('Suite 3: Overview View', () => {
  test('OVR-01: Net worth metrics load properly', async ({ page }) => {
    const overview = new OverviewPage(page);
    await overview.expectLoaded();
    await expect(page.locator('#kpi-all-accounts')).not.toHaveText('$0.00', { timeout: 10000 });
  });

  test('OVR-02: Clicking KPI cards routes to account view or real-estate', async ({ page }) => {
    const overview = new OverviewPage(page);
    await overview.cardRetirement.click();
    await expect(page).toHaveURL(/\/account/);

    await overview.goto();
    await overview.cardRealEstate.click();
    await expect(page).toHaveURL(/\/real-estate/);
  });
});
