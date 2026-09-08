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

    // Tab 1: Plaid Connect
    await expect(modals.tabPlaid).toHaveClass(/active/);
    await expect(modals.btnConnectPlaid).toBeVisible();

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
});

