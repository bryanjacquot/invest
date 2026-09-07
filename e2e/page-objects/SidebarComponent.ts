import { Page, Locator, expect } from '@playwright/test';

export class SidebarComponent {
  readonly page: Page;
  readonly overviewBtn: Locator;
  readonly allAccountsRow: Locator;
  readonly accountsList: Locator;
  readonly addAccountBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.overviewBtn = page.locator('#sidebar-nav-overview');
    this.allAccountsRow = page.locator('#sidebar-account-all');
    this.accountsList = page.locator('#sidebar-accounts-list');
    this.addAccountBtn = page.locator('#btn-sidebar-add-account');
  }

  async clickOverview() {
    await this.overviewBtn.click();
  }

  async clickAllAccounts() {
    await this.allAccountsRow.click();
  }

  async clickAccountByName(name: string, isMulti = false) {
    const item = this.page.locator('.sidebar-account-item', { hasText: name }).first();
    if (isMulti) {
      await item.click({ modifiers: ['Meta'] });
    } else {
      await item.click();
    }
  }

  async expectAccountActive(name: string, active = true) {
    const item = this.page.locator('#sidebar-accounts-list .sidebar-account-item', { hasText: name }).first();
    if (active) {
      await expect(item).toHaveClass(/active/);
    } else {
      await expect(item).not.toHaveClass(/active/);
    }
  }

  async expectAllAccountsActive(active = true) {
    if (active) {
      await expect(this.allAccountsRow).toHaveClass(/active/);
    } else {
      await expect(this.allAccountsRow).not.toHaveClass(/active/);
    }
  }
}
