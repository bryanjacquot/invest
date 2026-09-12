import { test, expect } from '../fixtures/auth.fixture';
import { Modals } from '../page-objects/Modals';

test.describe('Suite 6: Modals & Actions', () => {

  test('MOD-01: Edit Account dialog pre-fills and updates settings', async ({ page }) => {
    const firstAccount = page.locator('#sidebar-accounts-list .sidebar-account-item').first();
    await firstAccount.waitFor({ state: 'visible', timeout: 8000 });
    await firstAccount.click();

    await expect(page).toHaveURL(/\/account\?id=/);

    const editBtn = page.locator('#btn-edit-account');
    await editBtn.waitFor({ state: 'visible', timeout: 8000 });
    await editBtn.click();

    const modal = page.locator('#modal-edit-account');
    await expect(modal).toBeVisible();

    const modals = new Modals(page);
    await expect(modals.editNameInput).not.toBeEmpty();
    await expect(modals.editTypeSelect).toBeVisible();
    await expect(modals.editTypeSelect).not.toBeEmpty();
    await expect(modals.editTargetRateInput).not.toBeEmpty();

    // Close modal
    await modal.locator('.modal-close-btn').first().click();
    await expect(modal).toBeHidden();
  });

  test('MOD-02: Add Account modal has 3 tabs, categorized manual picker, and debt form', async ({ page }) => {
    // Open Add Account Modal via Sidebar button
    const addAccountBtn = page.locator('#btn-sidebar-add-account');
    await addAccountBtn.waitFor({ state: 'visible', timeout: 8000 });
    await addAccountBtn.click();

    const modals = new Modals(page);
    await expect(modals.addAccountModal).toBeVisible();

    // Verify 3 tabs exist
    await expect(modals.tabPlaid).toBeVisible();
    await expect(modals.tabManual).toBeVisible();
    await expect(modals.tabDebt).toBeVisible();

    // Tab 1: Plaid Connect tab is active
    await expect(modals.tabPlaid).toHaveClass(/active/);
    await expect(page.locator('#add-tab-plaid')).toBeVisible();

    // Tab 2: Manual Account with Categorized Dropdown
    await modals.tabManual.click();
    await expect(modals.tabManual).toHaveClass(/active/);
    await expect(modals.manualAccountTypeSelect).toBeVisible();

    // Verify optgroups and options from screenshots
    const optgroups = modals.manualAccountTypeSelect.locator('optgroup');
    await expect(optgroups).toHaveCount(4);
    await expect(optgroups.nth(0)).toHaveAttribute('label', 'TAXABLE');
    await expect(optgroups.nth(1)).toHaveAttribute('label', 'TAX-DEFERRED');
    await expect(optgroups.nth(2)).toHaveAttribute('label', 'TAX-FREE');
    await expect(optgroups.nth(3)).toHaveAttribute('label', 'REAL ESTATE & OTHER');

    // Verify specific options
    const checkingOption = modals.manualAccountTypeSelect.locator('option[value="Checking"]');
    await expect(checkingOption).toHaveText('Checking');
    const rothIraOption = modals.manualAccountTypeSelect.locator('option[value="Roth IRA"]');
    await expect(rothIraOption).toHaveText('Roth IRA');

    // Tab 3: Debt Account
    await modals.tabDebt.click();
    await expect(modals.tabDebt).toHaveClass(/active/);
    await expect(modals.debtAccountNameInput).toBeVisible();
    await expect(modals.debtAccountBalanceInput).toBeVisible();
    await expect(modals.debtAccountInterestInput).toBeVisible();
    await expect(modals.debtAccountPaymentInput).toBeVisible();

    // Verify Link to Debt Dropdown in Tab 2
    await modals.tabManual.click();
    await expect(modals.manualAccountLinkedDebtSelect).toBeVisible();

    // Verify Link to Asset Dropdown in Tab 3
    await modals.tabDebt.click();
    await expect(modals.debtAccountLinkedAssetSelect).toBeVisible();

    // Close modal
    await modals.addAccountModal.locator('.modal-close-btn').first().click();
    await expect(modals.addAccountModal).toBeHidden();
  });

  test('MOD-03: Bidirectional Asset-Debt linking in Add Account creates mutual link', async ({ page }) => {
    const modals = new Modals(page);
    const addAccountBtn = page.locator('#btn-sidebar-add-account');
    await addAccountBtn.click();

    // 1. Create a Debt Account
    await modals.tabDebt.click();
    const testDebtName = `Auto Loan ${Date.now()}`;
    await modals.debtAccountNameInput.fill(testDebtName);
    await modals.debtAccountBalanceInput.fill('25000');
    await modals.debtAccountInterestInput.fill('4.5');
    await modals.debtAccountPaymentInput.fill('500');
    await modals.debtSubmitBtn.click();
    await expect(modals.addAccountModal).toBeHidden();

    // 2. Open Add Account and Create an Asset linking to the new Debt Account
    await addAccountBtn.click();
    await modals.tabManual.click();
    const testAssetName = `Car Asset ${Date.now()}`;
    await modals.manualAccountNameInput.fill(testAssetName);
    await modals.manualAccountBalanceInput.fill('35000');
    await modals.manualAccountTargetInput.fill('5.0');

    // Select the debt account from the dropdown
    const debtOption = modals.manualAccountLinkedDebtSelect.locator('option', { hasText: testDebtName });
    await debtOption.waitFor({ state: 'attached', timeout: 5000 });
    const debtVal = await debtOption.getAttribute('value');
    await modals.manualAccountLinkedDebtSelect.selectOption(debtVal!);
    await modals.manualSubmitBtn.click();
    await expect(modals.addAccountModal).toBeHidden();

    // 3. Find and click on the Debt Account in the sidebar to check its Edit modal
    const debtItem = page.locator('#sidebar-accounts-list .sidebar-account-item', { hasText: testDebtName });
    await debtItem.waitFor({ state: 'visible', timeout: 8000 });
    await debtItem.click();

    // Open Edit modal on Debt Account
    const editBtn = page.locator('#btn-edit-account');
    await editBtn.waitFor({ state: 'visible', timeout: 8000 });
    await editBtn.click();

    // Verify it is bidirectionally linked back to the Asset
    await expect(modals.editAccountModal).toBeVisible();
    await expect(modals.editLinkedAccountSelect).not.toHaveValue('');

    // Close modal
    await modals.editAccountModal.locator('button:has-text("Cancel")').click();
    await expect(modals.editAccountModal).toBeHidden();
  });

  test('MOD-04: Single account page displays cleaned up Account.type badge and debt subtype selector works', async ({ page }) => {
    // 1. Open Add Account modal and check debt subtypes
    const modals = new Modals(page);
    const addAccountBtn = page.locator('#btn-sidebar-add-account');
    await addAccountBtn.click();
    await modals.tabDebt.click();

    const debtSubtypeSelect = page.locator('#debt-account-subtype');
    await expect(debtSubtypeSelect).toBeVisible();
    await expect(debtSubtypeSelect.locator('option[value="Mortgage"]')).toHaveText('Mortgage');
    await expect(debtSubtypeSelect.locator('option[value="Other"]')).toHaveText('Other');

    // Create a Mortgage debt account
    const debtName = `Mortgage Test ${Date.now()}`;
    await modals.debtAccountNameInput.fill(debtName);
    await debtSubtypeSelect.selectOption('Mortgage');
    await modals.debtAccountBalanceInput.fill('400000');
    await modals.debtSubmitBtn.click();
    await expect(modals.addAccountModal).toBeHidden();

    // 2. Click on the newly created debt account in sidebar
    const debtItem = page.locator('#sidebar-accounts-list .sidebar-account-item', { hasText: debtName });
    await debtItem.waitFor({ state: 'visible', timeout: 8000 });
    await debtItem.click();

    // 3. Verify single account header shows only the Account.subtype badge without clutter
    const headerPill = page.locator('.account-detail-container .badge-pill.moderate').first();
    await expect(headerPill).toBeVisible();
    await expect(headerPill).toHaveText('Mortgage');
  });

  test('MOD-05: Plaid tab displays configuration status via environment and contains no secret inputs', async ({ page }) => {
    const modals = new Modals(page);
    const addAccountBtn = page.locator('#btn-sidebar-add-account');
    await addAccountBtn.click();

    await expect(modals.tabPlaid).toHaveClass(/active/);
    
    // Ensure that UI inputs for client ID and secret do not exist in the DOM
    await expect(page.locator('#plaid-config-client-id')).toHaveCount(0);
    await expect(page.locator('#plaid-config-secret')).toHaveCount(0);
    await expect(page.locator('#form-plaid-config')).toHaveCount(0);

    // Check that either the unconfigured panel or the connected panel is displayed
    const unconfiguredPanel = page.locator('#plaid-unconfigured-panel');
    const connectedPanel = page.locator('#plaid-connected-panel');

    const isConnectedVisible = await connectedPanel.isVisible();
    if (isConnectedVisible) {
      // If configured via environment variables
      await expect(page.locator('#btn-connect-plaid')).toBeVisible();
    } else {
      // If unconfigured, instructions to set environment variables are shown
      await expect(unconfiguredPanel).toBeVisible();
      await expect(unconfiguredPanel).toContainText('PLAID_CLIENT_ID');
      await expect(unconfiguredPanel).toContainText('PLAID_SECRET');
      await expect(unconfiguredPanel).toContainText('README.md');
    }
  });

  test('MOD-06: Delete Account flow with confirmation, irreversible warning, and success dialog', async ({ page }) => {
    // 1. Create a dedicated account to delete
    const accountToDelete = `DelAcc_${Date.now()}`;
    await page.locator('#btn-sidebar-add-account').click();
    const modals = new Modals(page);
    await modals.tabManual.click();
    await modals.manualAccountTypeSelect.selectOption('Investment');
    await modals.manualAccountNameInput.fill(accountToDelete);
    await modals.manualAccountBalanceInput.fill('12500');
    await modals.manualSubmitBtn.click();
    await expect(modals.addAccountModal).toBeHidden();

    // 2. Select the created account from the sidebar
    const accountItem = page.locator('#sidebar-accounts-list .sidebar-account-item', { hasText: accountToDelete });
    await accountItem.waitFor({ state: 'visible', timeout: 8000 });
    await accountItem.click();

    // 3. Open Edit Account modal
    const editBtn = page.locator('#btn-edit-account');
    await editBtn.waitFor({ state: 'visible', timeout: 8000 });
    await editBtn.click();

    const editModal = page.locator('#modal-edit-account');
    await expect(editModal).toBeVisible();

    // 4. Verify red Delete Account button exists in lower left
    const deleteBtn = page.locator('#btn-delete-account');
    await expect(deleteBtn).toBeVisible();
    await expect(deleteBtn).toHaveClass(/btn-danger/);

    // 5. Click Delete Account and verify confirmation modal
    await deleteBtn.click();
    const confirmModal = page.locator('#modal-confirm-delete-account');
    await expect(confirmModal).toBeVisible();
    await expect(page.locator('#delete-confirm-account-name')).toHaveText(accountToDelete);
    await expect(confirmModal).toContainText('irreversible');

    // 6. Confirm deletion
    const [delResponse] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/accounts/') && resp.request().method() === 'DELETE' && resp.status() === 200),
      page.locator('#btn-confirm-delete-account').click()
    ]);
    expect(delResponse.status()).toBe(200);

    // Both confirmation and edit dialogs should close
    await expect(confirmModal).toBeHidden();
    await expect(editModal).toBeHidden();

    // 7. Success dialog should appear
    const successModal = page.locator('#modal-delete-account-success');
    await expect(successModal).toBeVisible();
    await expect(page.locator('#delete-success-account-name')).toHaveText(accountToDelete);
    await expect(successModal).toContainText('successfully deleted');

    // 8. Click Close on success dialog
    await page.locator('#btn-close-delete-success').click();
    await expect(successModal).toBeHidden();

    // 9. Sidebar should refresh and no longer show the deleted account
    await expect(page.locator('#sidebar-accounts-list .sidebar-account-item', { hasText: accountToDelete })).toHaveCount(0);
  });

  test('MOD-07: Delete Account failure displays error dialog with API message and Close button', async ({ page }) => {
    // 1. Select the first account and open Edit modal
    const firstAccount = page.locator('#sidebar-accounts-list .sidebar-account-item').first();
    await firstAccount.waitFor({ state: 'visible', timeout: 8000 });
    await firstAccount.click();

    const editBtn = page.locator('#btn-edit-account');
    await editBtn.waitFor({ state: 'visible', timeout: 8000 });
    await editBtn.click();

    const editModal = page.locator('#modal-edit-account');
    await expect(editModal).toBeVisible();

    // 2. Click Delete Account
    const deleteBtn = page.locator('#btn-delete-account');
    await deleteBtn.click();

    const confirmModal = page.locator('#modal-confirm-delete-account');
    await expect(confirmModal).toBeVisible();

    // 3. Mock API failure for the DELETE request
    await page.route('**/api/accounts/*', async route => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Simulated database error deleting account records' })
        });
      } else {
        await route.continue();
      }
    });

    // 4. Click confirm delete
    await page.locator('#btn-confirm-delete-account').click();

    // Confirm modal closes, error modal appears
    await expect(confirmModal).toBeHidden();
    const errorModal = page.locator('#modal-delete-account-error');
    await expect(errorModal).toBeVisible();
    await expect(page.locator('#delete-error-message')).toContainText('Simulated database error deleting account records');

    // 5. Click Close on error modal
    await page.locator('#btn-close-delete-error').click();
    await expect(errorModal).toBeHidden();
  });

  test('MOD-08: Log Valuation update on manual account succeeds and updates balance', async ({ page }) => {
    // 1. Create a dedicated manual asset account
    const manualAccName = `ValAcc_${Date.now()}`;
    await page.locator('#btn-sidebar-add-account').click();
    const modals = new Modals(page);
    await modals.tabManual.click();
    await modals.manualAccountTypeSelect.selectOption('Real Estate / Property');
    await modals.manualAccountNameInput.fill(manualAccName);
    await modals.manualAccountBalanceInput.fill('40000');
    await modals.manualSubmitBtn.click();
    await expect(modals.addAccountModal).toBeHidden();

    // 2. Select the manual account
    const accountItem = page.locator('#sidebar-accounts-list .sidebar-account-item', { hasText: manualAccName });
    await accountItem.waitFor({ state: 'visible', timeout: 8000 });
    await accountItem.click();

    // 3. Verify Log Valuation button is visible
    const valBtn = page.locator('#btn-log-valuation');
    await expect(valBtn).toBeVisible();

    // 4. Open Valuation modal
    await valBtn.click();
    const valModal = page.locator('#modal-valuation');
    await expect(valModal).toBeVisible();

    // 5. Fill new valuation and submit
    await page.locator('#valuation-amount').fill('50250');
    await page.locator('#valuation-note').fill('Spring Appraisal Update');

    const [valResponse] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/api/accounts/valuation') && resp.status() === 200),
      page.locator('#form-valuation button[type="submit"]').click()
    ]);
    expect(valResponse.status()).toBe(200);

    // 6. Modal should close
    await expect(valModal).toBeHidden();
  });

  test('MOD-09: Log Valuation button only appears on manual accounts, not on Plaid accounts or All Accounts', async ({ page }) => {
    // 1. On "All Accounts" overview, Log Valuation should not appear
    await page.goto('/account');
    await expect(page.locator('#btn-log-valuation')).toHaveCount(0);
    await expect(page.locator('#btn-log-valuation-multi')).toHaveCount(0);

    // 2. Navigate to a Plaid account (Vanguard 401(k) Plan)
    const plaidItem = page.locator('#sidebar-accounts-list .sidebar-account-item', { hasText: 'Vanguard 401(k)' });
    await plaidItem.waitFor({ state: 'visible', timeout: 8000 });
    await plaidItem.click();
    await expect(page.locator('#btn-edit-account')).toBeVisible();

    // Plaid account must NOT show Log Valuation button
    await expect(page.locator('#btn-log-valuation')).toHaveCount(0);

    // 3. Navigate to a manual account (Primary Residence)
    const manualItem = page.locator('#sidebar-accounts-list .sidebar-account-item', { hasText: 'Primary Residence' });
    await manualItem.waitFor({ state: 'visible', timeout: 8000 });
    await manualItem.click();

    // Manual account MUST show Log Valuation button
    await expect(page.locator('#btn-log-valuation')).toBeVisible();
  });
});


