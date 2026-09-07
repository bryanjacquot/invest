import { Page, Locator, expect } from '@playwright/test';

export class Modals {
  readonly page: Page;
  readonly editAccountModal: Locator;
  readonly editNameInput: Locator;
  readonly editCategorySelect: Locator;
  readonly editTargetRateInput: Locator;
  readonly editSubmitBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.editAccountModal = page.locator('#modal-edit-account');
    this.editNameInput = page.locator('#edit-acc-name');
    this.editCategorySelect = page.locator('#edit-acc-category');
    this.editTargetRateInput = page.locator('#edit-acc-target');
    this.editSubmitBtn = page.locator('#form-edit-account button[type="submit"]');
  }

  async updateAccountDetails(name: string, targetRate: number) {
    await this.editNameInput.fill(name);
    await this.editTargetRateInput.fill(targetRate.toString());
    await this.editSubmitBtn.click();
    await this.editAccountModal.waitFor({ state: 'hidden', timeout: 5000 });
  }
}
