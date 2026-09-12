import { test, expect } from '../fixtures/auth.fixture';

test.describe('Suite 7: Plaid Daily Sync & Account Sync Status', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/account');
    await page.locator('.account-detail-container').waitFor({ state: 'visible', timeout: 10000 });
  });

  test('SYNC-01: Header does not contain "Sync Now" button', async ({ page }) => {
    const syncNowBtn = page.locator('#btn-sync-now');
    await expect(syncNowBtn).toHaveCount(0);
  });

  test('SYNC-02: When accounts are already synced today, header sync indicator remains hidden', async ({ page }) => {
    const syncStatus = page.locator('#header-sync-status');
    await expect(syncStatus).toHaveClass(/hidden/);
  });

  test('SYNC-03: Auto-sync runs on load when Plaid account was not synced today', async ({ page }) => {
    // Intercept /api/accounts on initial load to simulate an account last synced yesterday
    let syncTriggered = false;
    await page.route('**/api/plaid/sync', async (route) => {
      syncTriggered = true;
      // Introduce slight delay so we can inspect the syncing state
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'On-demand synchronization complete.',
          synced_institutions_count: 1,
          synced_accounts_count: 1,
          created_snapshots_count: 1,
          synced_holdings_count: 2,
          timestamp: new Date().toISOString()
        })
      });
    });

    // Intercept accounts to return a Plaid account with last_synced_at from 2 days ago
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    await page.route('**/api/accounts', async (route) => {
      const res = await route.fetch();
      const accounts = await res.json();
      if (Array.isArray(accounts) && accounts.length > 0) {
        // Set first Plaid account to 2 days ago
        for (const acc of accounts) {
          if (acc.source_type === 'plaid') {
            acc.last_synced_at = twoDaysAgo;
          }
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(accounts)
      });
    });

    // Reload page to trigger initApp()
    await page.reload();
    await page.locator('.account-detail-container').waitFor({ state: 'visible', timeout: 10000 });

    const syncStatus = page.locator('#header-sync-status');
    const statusText = page.locator('#sync-status-text');

    // Wait for sync to complete
    await expect(statusText).toHaveText(/Sync Complete/, { timeout: 8000 });
    expect(syncTriggered).toBe(true);
  });

  test('SYNC-04: Plaid account displays "Last synced: <date and time>" opposite Edit Account button', async ({ page }) => {
    // Click on a Plaid account in the sidebar
    const plaidAccountRow = page.locator('.sidebar-account-item[data-source="plaid"]').first();
    await expect(plaidAccountRow).toBeVisible();
    await plaidAccountRow.click();

    // Verify Edit Account button is visible
    const editBtn = page.locator('#btn-edit-account');
    await expect(editBtn).toBeVisible();

    // Verify Last synced message is visible in #account-sync-info opposite Edit Account
    const syncInfo = page.locator('#account-sync-info');
    await expect(syncInfo).toBeVisible();
    const lastSyncedMsg = page.locator('#account-last-synced-msg');
    await expect(lastSyncedMsg).toBeVisible();
    await expect(lastSyncedMsg).toContainText('Last synced:');
  });

  test('SYNC-05: Plaid account with sync error displays "Sync Error: <error>" opposite Edit Account button', async ({ page }) => {
    // Intercept accounts to inject a sync_error on a Plaid account
    await page.route('**/api/accounts', async (route) => {
      const res = await route.fetch();
      const accounts = await res.json();
      if (Array.isArray(accounts)) {
        for (const acc of accounts) {
          if (acc.source_type === 'plaid') {
            acc.sync_error = 'ITEM_LOGIN_REQUIRED: Please re-authenticate';
          }
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(accounts)
      });
    });

    await page.reload();
    await page.locator('.account-detail-container').waitFor({ state: 'visible', timeout: 10000 });

    // Select the Plaid account
    const plaidAccountRow = page.locator('.sidebar-account-item[data-source="plaid"]').first();
    await expect(plaidAccountRow).toBeVisible();
    await plaidAccountRow.click();

    // Check error display
    const syncErrorMsg = page.locator('#account-sync-error-msg');
    await expect(syncErrorMsg).toBeVisible();
    await expect(syncErrorMsg).toContainText('Sync Error: ITEM_LOGIN_REQUIRED: Please re-authenticate');
  });

  test('SYNC-06: Manual account does not display Last synced or Sync Error', async ({ page }) => {
    // Select a manual account in the sidebar
    const manualAccountRow = page.locator('.sidebar-account-item[data-source="manual"]').first();
    if (await manualAccountRow.isVisible()) {
      await manualAccountRow.click();

      // Edit Account is visible
      await expect(page.locator('#btn-edit-account')).toBeVisible();

      // Sync message should not be present
      await expect(page.locator('#account-last-synced-msg')).toHaveCount(0);
      await expect(page.locator('#account-sync-error-msg')).toHaveCount(0);
    }
  });

  test('SYNC-07: Capture screenshot of Plaid account view with Last synced', async ({ page }) => {
    const plaidAccountRow = page.locator('.sidebar-account-item[data-source="plaid"]').first();
    await expect(plaidAccountRow).toBeVisible();
    await plaidAccountRow.click();
    await expect(page.locator('#account-last-synced-msg')).toBeVisible();
    await page.screenshot({ path: '/Users/bryanjacquot/.gemini/antigravity-ide/brain/2cc0767f-06a1-4496-b069-48b08501c86b/plaid_account_sync_view.png' });
  });

  test('SYNC-08: Capture screenshot of Sync Error on Plaid account', async ({ page }) => {
    await page.route('**/api/accounts', async (route) => {
      const res = await route.fetch();
      const accounts = await res.json();
      if (Array.isArray(accounts)) {
        for (const acc of accounts) {
          if (acc.source_type === 'plaid') {
            acc.sync_error = 'ITEM_LOGIN_REQUIRED: Credentials expired';
          }
        }
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(accounts) });
    });
    await page.reload();
    await page.locator('.account-detail-container').waitFor({ state: 'visible', timeout: 10000 });
    const plaidAccountRow = page.locator('.sidebar-account-item[data-source="plaid"]').first();
    await plaidAccountRow.click();
    await expect(page.locator('#account-sync-error-msg')).toBeVisible();
    await page.screenshot({ path: '/Users/bryanjacquot/.gemini/antigravity-ide/brain/2cc0767f-06a1-4496-b069-48b08501c86b/plaid_account_error_view.png' });
  });
});
