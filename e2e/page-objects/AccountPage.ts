import { Page, Locator, expect } from '@playwright/test';

export class AccountPage {
  readonly page: Page;
  readonly tabPerformance: Locator;
  readonly tabHoldings: Locator;
  readonly btnUnitPct: Locator;
  readonly btnUnitDollar: Locator;
  readonly btnChartToggle: Locator;
  readonly btnTableToggle: Locator;
  readonly metricActualReturn: Locator;
  readonly metricTargetReturn: Locator;
  readonly metricVariance: Locator;
  readonly chartCanvas: Locator;
  readonly matrixTable: Locator;
  readonly btnEditAccount: Locator;
  readonly holdingsSearchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.tabPerformance = page.locator('#account-sub-tabs button[data-subtab="performance"]');
    this.tabHoldings = page.locator('#account-sub-tabs button[data-subtab="holdings"]');
    this.btnUnitPct = page.locator('#account-unit-btn-group button[data-unit="pct"]');
    this.btnUnitDollar = page.locator('#account-unit-btn-group button[data-unit="dollar"]');
    this.btnChartToggle = page.locator('#toggle-view-chart');
    this.btnTableToggle = page.locator('#toggle-view-table');
    this.metricActualReturn = page.locator('#metric-actual-return');
    this.metricTargetReturn = page.locator('#metric-target-return');
    this.metricVariance = page.locator('#metric-variance');
    this.chartCanvas = page.locator('#accountPerformanceChart');
    this.matrixTable = page.locator('#performance-table-container');
    this.btnEditAccount = page.locator('#btn-edit-account');
    this.holdingsSearchInput = page.locator('#holding-search-input');
  }

  async selectTimeframe(tf: '1M' | 'YTD' | '1Y' | '3Y' | '5Y' | 'LIFETIME') {
    await this.page.locator(`#account-tf-btn-group button[data-tf="${tf}"]`).click();
  }

  async setMetricUnit(unit: 'pct' | 'dollar') {
    if (unit === 'pct') {
      await this.btnUnitPct.click();
    } else {
      await this.btnUnitDollar.click();
    }
  }

  async switchToTable() {
    await this.btnTableToggle.click();
  }

  async switchToChart() {
    await this.btnChartToggle.click();
  }

  async switchToHoldings() {
    await this.tabHoldings.click();
  }
}
