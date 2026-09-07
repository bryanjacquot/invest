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
});
