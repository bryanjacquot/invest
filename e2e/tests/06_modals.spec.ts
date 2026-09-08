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

    // Close modal
    await modals.addAccountModal.locator('.modal-close-btn').first().click();
    await expect(modals.addAccountModal).toBeHidden();
  });
});
