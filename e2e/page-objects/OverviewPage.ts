import { Page, Locator, expect } from '@playwright/test';

export class OverviewPage {
  readonly page: Page;
  readonly netWorthValue: Locator;
  readonly cardAll: Locator;
  readonly cardRetirement: Locator;
  readonly cardTaxable: Locator;
  readonly cardRealEstate: Locator;

  constructor(page: Page) {
    this.page = page;
    this.netWorthValue = page.locator('#kpi-all-accounts');
    this.cardAll = page.locator('#card-kpi-all');
    this.cardRetirement = page.locator('#card-kpi-ret');
    this.cardTaxable = page.locator('#card-kpi-tax');
    this.cardRealEstate = page.locator('#card-kpi-re');
  }

  async goto() {
    await this.page.goto('/overview');
  }

  async expectLoaded() {
    await expect(this.netWorthValue).toBeVisible();
  }
}
