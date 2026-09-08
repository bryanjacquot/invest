import { Page, Locator, expect } from '@playwright/test';

export class Modals {
  readonly page: Page;
  readonly editAccountModal: Locator;
  readonly editNameInput: Locator;
  readonly editCategorySelect: Locator;
  readonly editLinkedAccountSelect: Locator;
  readonly editSubmitBtn: Locator;

  // Add Account Modal
  readonly addAccountModal: Locator;
  readonly tabPlaid: Locator;
  readonly tabManual: Locator;
  readonly tabDebt: Locator;
  readonly btnConnectPlaid: Locator;
  readonly manualAccountTypeSelect: Locator;
  readonly manualAccountNameInput: Locator;
  readonly manualAccountBalanceInput: Locator;
  readonly manualAccountTargetInput: Locator;
  readonly manualAccountLinkedDebtSelect: Locator;
  readonly manualSubmitBtn: Locator;
  readonly debtAccountNameInput: Locator;
  readonly debtAccountBalanceInput: Locator;
  readonly debtAccountLinkedAssetSelect: Locator;
  readonly debtAccountInterestInput: Locator;
  readonly debtAccountPaymentInput: Locator;
  readonly debtSubmitBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.editAccountModal = page.locator('#modal-edit-account');
    this.editNameInput = page.locator('#edit-acc-name');
    this.editCategorySelect = page.locator('#edit-acc-category');
    this.editTargetRateInput = page.locator('#edit-acc-target');
    this.editLinkedAccountSelect = page.locator('#edit-acc-linked-account');
    this.editSubmitBtn = page.locator('#form-edit-account button[type="submit"]');

    this.addAccountModal = page.locator('#modal-add-account');
    this.tabPlaid = page.locator('#modal-add-account nav button[data-tab="plaid"]');
    this.tabManual = page.locator('#modal-add-account nav button[data-tab="manual"]');
    this.tabDebt = page.locator('#modal-add-account nav button[data-tab="debt"]');
    this.btnConnectPlaid = page.locator('#btn-connect-plaid');
    this.manualAccountTypeSelect = page.locator('#manual-account-type');
    this.manualAccountNameInput = page.locator('#manual-account-name');
    this.manualAccountBalanceInput = page.locator('#manual-account-balance');
    this.manualAccountTargetInput = page.locator('#manual-account-target');
    this.manualAccountLinkedDebtSelect = page.locator('#manual-account-linked-debt');
    this.manualSubmitBtn = page.locator('#form-add-manual-account button[type="submit"]');
    this.debtAccountNameInput = page.locator('#debt-account-name');
    this.debtAccountBalanceInput = page.locator('#debt-account-balance');
    this.debtAccountLinkedAssetSelect = page.locator('#debt-account-linked-asset');
    this.debtAccountInterestInput = page.locator('#debt-account-interest');
    this.debtAccountPaymentInput = page.locator('#debt-account-payment');
    this.debtSubmitBtn = page.locator('#form-add-debt-account button[type="submit"]');
  }

  async updateAccountDetails(name: string, targetRate: number) {
    await this.editNameInput.fill(name);
    await this.editTargetRateInput.fill(targetRate.toString());
    await this.editSubmitBtn.click();
    await this.editAccountModal.waitFor({ state: 'hidden', timeout: 5000 });
  }
}
