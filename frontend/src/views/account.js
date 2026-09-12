/**
 * Account Detail & Performance View Module (/account)
 * Consolidates single-account, multi-account, and all-accounts performance and holdings.
 */
import { apiFetch } from '../api.js';
import { state, setMetricUnit } from '../state.js';
import { router } from '../router.js';
import { formatCurrency, formatPercent, formatDate, formatDateTime } from '../utils/formatters.js';
import { escapeHtml } from '../utils/dom.js';

const ACCOUNT_COLORS = [
  '#38bdf8', // Sky Blue
  '#a855f7', // Purple
  '#fbbf24', // Amber
  '#f43f5e', // Rose
  '#06b6d4', // Cyan
  '#818cf8', // Indigo
  '#a3e635', // Lime
  '#2dd4bf', // Teal
  '#d946ef', // Fuchsia
  '#fb923c'  // Orange
];

export default {
  selectedAccountIds: [],
  isSingleAccount: false,
  singleAccount: null,
  params: null,
  charts: {
    performance: null,
    allocation: null
  },
  allHoldings: [],

  async mount(container, params) {
    this.params = params;
    const idParam = params.get('id');
    const accountsParam = params.get('accounts');

    const accounts = state.accounts || [];

    if (idParam) {
      this.selectedAccountIds = [idParam];
      this.isSingleAccount = true;
    } else if (accountsParam) {
      this.selectedAccountIds = accountsParam.split(',').filter(Boolean);
      this.isSingleAccount = (this.selectedAccountIds.length === 1);
    } else {
      this.selectedAccountIds = accounts.map(a => a.id);
      this.isSingleAccount = (this.selectedAccountIds.length === 1);
    }

    if (this.isSingleAccount && this.selectedAccountIds.length === 1) {
      let acc = accounts.find(a => a.id === this.selectedAccountIds[0]);
      if (!acc) {
        try {
          const freshAccounts = await apiFetch('/accounts');
          acc = freshAccounts.find(a => a.id === this.selectedAccountIds[0]);
        } catch (err) {
          console.error('Error fetching account details:', err);
        }
      }
      this.singleAccount = acc || null;
    } else {
      this.singleAccount = null;
    }

    await this.renderView(container);
  },

  async renderView(container) {
    const activeSubTab = this.params.get('tab') || 'performance';
    const activeTf = this.params.get('timeframe') || state.activeTimeframe || '1Y';
    const activeUnit = this.params.get('unit') || state.metricUnit || 'pct';
    state.activeTimeframe = activeTf;
    state.metricUnit = activeUnit;
    setMetricUnit(activeUnit);

    const accounts = state.accounts || [];
    const selectedAccs = accounts.filter(a => this.selectedAccountIds.includes(a.id));

    // Calculate total balance for selected accounts
    let totalBal = 0;
    selectedAccs.forEach(a => {
      if (a.account_class === 'liability') {
        totalBal -= a.current_balance;
      } else {
        totalBal += a.current_balance;
      }
    });

    const isAll = (this.selectedAccountIds.length === 0 || this.selectedAccountIds.length === accounts.length);
    const isSingle = this.isSingleAccount && this.singleAccount;

    container.innerHTML = `
      <section class="account-detail-container">
        <!-- 1. Top Account / Portfolio Header Card -->
        <div class="glass-card" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
            <div>
              ${isSingle ? `
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <h2 style="margin: 0;" id="account-view-title">${escapeHtml(this.singleAccount.name)}</h2>
                  <span class="badge-pill moderate">${escapeHtml(this.singleAccount.subtype || this.singleAccount.type)}</span>
                </div>
                <div style="margin-top: 0.5rem; color: var(--text-muted); font-size: 0.9rem;">
                  <span>Institution: <strong>${escapeHtml(this.singleAccount.institution_name || 'Manual')}</strong></span>
                </div>
              ` : `
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <h2 style="margin: 0;" id="account-view-title">${isAll ? 'All Accounts' : `${this.selectedAccountIds.length} Accounts Selected`}</h2>
                  <span class="badge-pill moderate">${isAll ? 'Blended Portfolio' : 'Custom Selection'}</span>
                </div>
                <div style="margin-top: 0.5rem; color: var(--text-muted); font-size: 0.9rem;">
                  <span>Total Portfolio Scope</span>
                  <span style="margin: 0 0.5rem;">•</span>
                  <span><strong>${selectedAccs.length}</strong> active account${selectedAccs.length === 1 ? '' : 's'} included</span>
                </div>
              `}
            </div>

            <div style="text-align: right;">
              <div style="font-size: 0.85rem; color: var(--text-dim); text-transform: uppercase;">Current Balance</div>
              <div id="account-current-balance-display" style="font-size: 1.75rem; font-weight: 800; color: ${totalBal < 0 ? 'var(--accent-red)' : 'var(--accent-green)'};">
                ${formatCurrency(isSingle ? this.singleAccount.current_balance : totalBal)}
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-glass);">
            <div id="account-sync-info" style="font-size: 0.85rem; color: var(--text-muted);">
              ${isSingle && this.singleAccount.source_type === 'plaid' ? (
                this.singleAccount.sync_error ? `
                  <span style="color: var(--accent-red); font-weight: 500; display: inline-flex; align-items: center; gap: 0.35rem;" id="account-sync-error-msg">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Sync Error: ${escapeHtml(this.singleAccount.sync_error)}
                  </span>
                ` : `
                  <span id="account-last-synced-msg">Last synced: <strong style="color: var(--text-main);">${this.singleAccount.last_synced_at ? formatDateTime(this.singleAccount.last_synced_at) : 'Never'}</strong></span>
                `
              ) : ''}
            </div>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end;">
              ${isSingle ? `
                <button class="btn btn-sm btn-secondary" id="btn-edit-account" title="Edit account settings and specifications">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit Account
                </button>
                ${this.singleAccount.source_type === 'manual' ? `
                  <button class="btn btn-sm btn-primary" id="btn-log-valuation">
                    + Log Valuation / Payment
                  </button>
                ` : ''}
              ` : `
                <button class="btn btn-sm btn-secondary" id="btn-add-account-header">
                  + Add Account
                </button>
              `}
            </div>
          </div>
        </div>

        <!-- 2. Performance & Analytics Body -->
        <div class="performance-view-container" style="margin-top: 1.5rem;">
          <!-- Sub-navigation tabs -->
          <nav class="view-tabs sub-nav-tabs" id="account-sub-tabs">
            <button type="button" class="tab-btn ${activeSubTab === 'performance' ? 'active' : ''}" data-subtab="performance">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              <span>Performance & Targets</span>
            </button>
            <button type="button" class="tab-btn ${activeSubTab === 'holdings' ? 'active' : ''}" data-subtab="holdings">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
              <span>Holdings & Allocation</span>
            </button>
          </nav>

          <!-- SUBTAB 1: Performance & Targets -->
          <div id="subtab-content-performance" class="tab-content ${activeSubTab === 'performance' ? 'active' : ''}">
            <!-- Controls Bar (Horizon, Unit: % / $, Format: Chart / Table) -->
            <div class="view-header-bar glass-card">
              <!-- 1. Horizon Selector -->
              <div class="timeframe-selector">
                <span class="control-label">Horizon:</span>
                <div class="btn-group" id="account-tf-btn-group">
                  <button class="tf-btn ${activeTf === '1M' ? 'active' : ''}" data-tf="1M">1M</button>
                  <button class="tf-btn ${activeTf === 'YTD' ? 'active' : ''}" data-tf="YTD">YTD</button>
                  <button class="tf-btn ${activeTf === '1Y' ? 'active' : ''}" data-tf="1Y">1Y</button>
                  <button class="tf-btn ${activeTf === '3Y' ? 'active' : ''}" data-tf="3Y">3Y</button>
                  <button class="tf-btn ${activeTf === '5Y' ? 'active' : ''}" data-tf="5Y">5Y</button>
                  <button class="tf-btn ${activeTf === 'LIFETIME' ? 'active' : ''}" data-tf="LIFETIME">Lifetime</button>
                </div>
              </div>

              <!-- 2. Unit Selector (% vs $) -->
              <div class="unit-toggle-selector">
                <span class="control-label">Metric:</span>
                <div class="btn-group" id="account-unit-btn-group">
                  <button class="tf-btn ${activeUnit === 'pct' ? 'active' : ''}" data-unit="pct" title="Percentage Return (%)">
                    % Percent
                  </button>
                  <button class="tf-btn ${activeUnit === 'dollar' ? 'active' : ''}" data-unit="dollar" title="Dollar Value Growth ($)">
                    $ Dollars
                  </button>
                </div>
              </div>

              <!-- 3. View Format Selector (Chart vs Table) -->
              <div class="view-toggle-selector">
                <div class="btn-group">
                  <button id="toggle-view-chart" class="btn-toggle active" title="Chart View">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    <span>Chart</span>
                  </button>
                  <button id="toggle-view-table" class="btn-toggle" title="Table View">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
                    <span>Table</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Current TF Summary Cards (Horizontal 4-Column Grid) -->
            <div class="glass-card target-summary-card">
              <div class="summary-metric">
                <span class="label" id="metric-label-1">Actual Return (<span class="current-tf-label">${activeTf}</span>)</span>
                <span class="val positive" id="metric-actual-return">+0.00%</span>
                <span class="subval" id="metric-actual-gain">+$0.00</span>
              </div>

              <div class="summary-metric">
                <span class="label" id="metric-label-2">Target Return (<span class="current-tf-label">${activeTf}</span>)</span>
                <span class="val" id="metric-target-return">+0.00%</span>
                <span class="subval" id="metric-target-gain">Target: $0.00</span>
              </div>

              <div class="summary-metric">
                <span class="label" id="metric-label-3">Variance vs Target</span>
                <span class="val positive" id="metric-variance">+0.00%</span>
                <span id="metric-variance-status" class="badge-pill green">Ahead of Target</span>
              </div>

              <div class="summary-metric">
                <span class="label" id="metric-label-4">Annualized Return</span>
                <span class="val" id="metric-annualized">0.00%</span>
                <span class="subval" id="metric-sub-4">Compounded APR</span>
              </div>
            </div>

            <!-- Chart View -->
            <div id="performance-chart-container" class="glass-card chart-wrapper">
              <div class="chart-header">
                <h3 id="chart-title">Growth vs Target Annual Projection ${activeUnit === 'dollar' ? '($)' : '(%)'}</h3>
              </div>
              <div class="canvas-container" style="position: relative; height: 380px; width: 100%;">
                <canvas id="accountPerformanceChart"></canvas>
              </div>
            </div>

            <!-- Table View (Hidden by default) -->
            <div id="performance-table-container" class="glass-card hidden" style="margin-top: 1.5rem; padding: 1.5rem;">
              <h3>Timeframe Performance Matrix</h3>
              <div class="table-responsive" style="margin-top: 1rem;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Time Horizon</th>
                      <th>Start Balance</th>
                      <th>End Balance</th>
                      <th>Net Contrib</th>
                      <th>Gain / Loss</th>
                      <th>Actual Return</th>
                      <th>Target Return</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody id="performance-timeframe-tbody">
                    <tr><td colspan="8" class="text-center">Loading performance metrics...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- SUBTAB 2: Holdings & Allocation -->
          <div id="subtab-content-holdings" class="tab-content ${activeSubTab === 'holdings' ? 'active' : ''}">
            <div class="holdings-layout-stacked holdings-layout-grid" style="display: flex !important; flex-direction: column !important; gap: 1.5rem !important; width: 100% !important;">
              <!-- Consolidated Holdings Table -->
              <div class="glass-card table-card">
                <div class="table-header-flex">
                  <h3>Holdings</h3>
                  <div class="search-input-wrapper">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="holding-search-input" placeholder="Search ticker or name..." class="search-input">
                  </div>
                </div>

                <div class="table-responsive" style="margin-top: 1rem; max-height: 520px; overflow-y: auto;">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Class</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Value</th>
                        <th>Gain / Loss</th>
                        <th>Return</th>
                      </tr>
                    </thead>
                    <tbody id="holdings-tbody">
                      <tr><td colspan="7" class="text-center">Loading holdings...</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Asset Allocation Donut Chart -->
              <div class="glass-card chart-card">
                <div class="chart-header">
                  <h3>Asset Allocation</h3>
                  <div id="blended-risk-badge" class="badge-pill moderate">Moderate Risk (5.2)</div>
                </div>
                <div class="canvas-container donut-canvas-container" style="position: relative; height: 280px; max-width: 480px; margin: 0 auto;">
                  <canvas id="accountAllocationChart"></canvas>
                </div>
                <div id="account-risks-container" class="account-risks-list" style="margin-top: 1.25rem;"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    this.bindDetailEvents();
    await this.loadData();
  },

  bindDetailEvents() {
    // Edit Account button -> opens Edit Account modal (single account)
    document.getElementById('btn-edit-account')?.addEventListener('click', () => {
      if (this.singleAccount) {
        window.dispatchEvent(new CustomEvent('invest:open-edit-account', {
          detail: { accountId: this.singleAccount.id }
        }));
      }
    });

    // Log Valuation button (single account)
    document.getElementById('btn-log-valuation')?.addEventListener('click', () => {
      if (this.singleAccount) {
        window.dispatchEvent(new CustomEvent('invest:open-valuation-modal', {
          detail: {
            accountId: this.singleAccount.id,
            currentValue: this.singleAccount.current_balance,
            title: this.singleAccount.account_class === 'liability' ? 'Mortgage / Loan Payment' : 'Valuation Update'
          }
        }));
      }
    });

    // Add Account button (multi-account header)
    document.getElementById('btn-add-account-header')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('invest:open-add-account'));
    });

    // Subtab buttons
    document.querySelectorAll('#account-sub-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const subtab = btn.getAttribute('data-subtab');
        this.updateUrl({ tab: subtab });
      });
    });

    // Timeframe selector
    document.querySelectorAll('#account-tf-btn-group button').forEach(btn => {
      btn.addEventListener('click', () => {
        const tf = btn.getAttribute('data-tf');
        state.activeTimeframe = tf;
        this.updateUrl({ timeframe: tf });
      });
    });

    // Unit toggle (% vs $)
    document.querySelectorAll('#account-unit-btn-group button').forEach(btn => {
      btn.addEventListener('click', () => {
        const unit = btn.getAttribute('data-unit');
        state.metricUnit = unit;
        setMetricUnit(unit);
        this.updateUrl({ unit });
      });
    });

    // View toggle (Chart vs Table)
    document.getElementById('toggle-view-chart')?.addEventListener('click', () => {
      document.getElementById('toggle-view-chart')?.classList.add('active');
      document.getElementById('toggle-view-table')?.classList.remove('active');
      document.getElementById('performance-chart-container')?.classList.remove('hidden');
      document.getElementById('performance-table-container')?.classList.add('hidden');
    });

    document.getElementById('toggle-view-table')?.addEventListener('click', () => {
      document.getElementById('toggle-view-table')?.classList.add('active');
      document.getElementById('toggle-view-chart')?.classList.remove('active');
      document.getElementById('performance-chart-container')?.classList.add('hidden');
      document.getElementById('performance-table-container')?.classList.remove('hidden');
    });

    // Holdings search
    document.getElementById('holding-search-input')?.addEventListener('input', (e) => {
      this.filterHoldingsTable(e.target.value);
    });
  },

  updateUrl(overrides = {}) {
    const currentParams = new URLSearchParams(window.location.search);

    if (this.isSingleAccount && this.selectedAccountIds.length === 1) {
      currentParams.set('id', this.selectedAccountIds[0]);
      currentParams.delete('accounts');
    } else if (this.selectedAccountIds.length > 0 && this.selectedAccountIds.length < (state.accounts || []).length) {
      currentParams.set('accounts', this.selectedAccountIds.join(','));
      currentParams.delete('id');
    } else {
      currentParams.delete('id');
      currentParams.delete('accounts');
    }

    if (state.metricUnit && state.metricUnit !== 'pct' && !currentParams.has('unit')) {
      currentParams.set('unit', state.metricUnit);
    }

    Object.entries(overrides).forEach(([k, v]) => {
      if (v === null || v === undefined) {
        currentParams.delete(k);
      } else {
        currentParams.set(k, v);
      }
    });

    const queryString = currentParams.toString();
    const newUrl = `/account${queryString ? `?${queryString}` : ''}`;
    router.navigate(newUrl);
  },

  getFilterQueryString() {
    if (this.isSingleAccount && this.selectedAccountIds.length === 1) {
      return encodeURIComponent(this.selectedAccountIds[0]);
    }
    if (this.selectedAccountIds.length > 0 && this.selectedAccountIds.length < (state.accounts || []).length) {
      return encodeURIComponent(this.selectedAccountIds.join(','));
    }
    return 'all';
  },

  async loadData() {
    const activeSubTab = this.params.get('tab') || 'performance';
    if (activeSubTab === 'performance') {
      await this.loadPerformanceMetrics();
    } else {
      await this.loadHoldingsAndAllocation();
    }
  },

  async loadPerformanceMetrics() {
    try {
      const isDollar = (this.params.get('unit') === 'dollar' || state.metricUnit === 'dollar');
      const filterStr = this.getFilterQueryString();
      const data = await apiFetch(`/analytics/performance?timeframe=${state.activeTimeframe}&account_filter=${filterStr}`);

      const currMetric = data.timeframe_metrics[state.activeTimeframe] || {};
      document.querySelectorAll('.current-tf-label').forEach(el => el.textContent = state.activeTimeframe);

      const retVal = currMetric.return_pct || 0;
      const gainVal = currMetric.capital_gain_loss || 0;
      const tgtRetVal = currMetric.target_return_pct || 0;
      const tgtGainVal = (currMetric.target_end_balance || 0) - (currMetric.start_balance || 0);
      const varPct = currMetric.variance_pct || 0;
      const varDollars = currMetric.variance_dollars !== undefined ? currMetric.variance_dollars : (gainVal - tgtGainVal);
      const startBalance = currMetric.start_balance || 0;
      const endBalance = currMetric.end_balance || 0;
      const annVal = currMetric.annualized_return_pct !== null && currMetric.annualized_return_pct !== undefined
        ? `${currMetric.annualized_return_pct.toFixed(2)}%`
        : '—';

      // 1. Metric Card 1: Actual
      const label1 = document.getElementById('metric-label-1');
      const val1 = document.getElementById('metric-actual-return');
      const sub1 = document.getElementById('metric-actual-gain');
      if (isDollar) {
        if (label1) label1.innerHTML = `Actual Gain (<span class="current-tf-label">${state.activeTimeframe}</span>)`;
        if (val1) {
          val1.textContent = `${gainVal >= 0 ? '+' : ''}${formatCurrency(gainVal)}`;
          val1.className = `val ${gainVal >= 0 ? 'positive' : 'negative'}`;
        }
        if (sub1) sub1.textContent = `${retVal >= 0 ? '+' : ''}${retVal.toFixed(2)}% Return`;
      } else {
        if (label1) label1.innerHTML = `Actual Return (<span class="current-tf-label">${state.activeTimeframe}</span>)`;
        if (val1) {
          val1.textContent = `${retVal >= 0 ? '+' : ''}${retVal.toFixed(2)}%`;
          val1.className = `val ${retVal >= 0 ? 'positive' : 'negative'}`;
        }
        if (sub1) sub1.textContent = `${gainVal >= 0 ? '+' : ''}${formatCurrency(gainVal)}`;
      }

      // 2. Metric Card 2: Target
      const label2 = document.getElementById('metric-label-2');
      const val2 = document.getElementById('metric-target-return');
      const sub2 = document.getElementById('metric-target-gain');
      if (isDollar) {
        if (label2) label2.innerHTML = `Target Growth (<span class="current-tf-label">${state.activeTimeframe}</span>)`;
        if (val2) val2.textContent = `+${formatCurrency(tgtGainVal)}`;
        if (sub2) sub2.textContent = `+${tgtRetVal.toFixed(2)}% Target Rate`;
      } else {
        if (label2) label2.innerHTML = `Target Return (<span class="current-tf-label">${state.activeTimeframe}</span>)`;
        if (val2) val2.textContent = `+${tgtRetVal.toFixed(2)}%`;
        if (sub2) sub2.textContent = `Target: ${formatCurrency(tgtGainVal)}`;
      }

      // 3. Metric Card 3: Variance
      const label3 = document.getElementById('metric-label-3');
      const val3 = document.getElementById('metric-variance');
      const statusEl = document.getElementById('metric-variance-status');
      if (isDollar) {
        if (label3) label3.textContent = 'Variance vs Target ($)';
        if (val3) {
          val3.textContent = `${varDollars >= 0 ? '+' : ''}${formatCurrency(varDollars)}`;
          val3.className = `val ${varDollars >= 0 ? 'positive' : 'negative'}`;
        }
      } else {
        if (label3) label3.textContent = 'Variance vs Target (%)';
        if (val3) {
          val3.textContent = `${varPct >= 0 ? '+' : ''}${varPct.toFixed(2)}%`;
          val3.className = `val ${varPct >= 0 ? 'positive' : 'negative'}`;
        }
      }

      if (statusEl) {
        if (currMetric.ahead_of_target) {
          statusEl.textContent = 'Ahead of Target';
          statusEl.className = 'badge-pill green';
        } else {
          statusEl.textContent = 'Behind Target';
          statusEl.className = 'badge-pill red';
        }
      }

      // 4. Metric Card 4: Annualized / Balance
      const label4 = document.getElementById('metric-label-4');
      const val4 = document.getElementById('metric-annualized');
      const sub4 = document.getElementById('metric-sub-4');
      if (isDollar) {
        if (label4) label4.textContent = 'Ending Balance';
        if (val4) val4.textContent = formatCurrency(endBalance);
        if (sub4) sub4.textContent = `Start Balance: ${formatCurrency(startBalance)}`;
      } else {
        if (label4) label4.textContent = 'Annualized Return';
        if (val4) val4.textContent = annVal;
        if (sub4) sub4.textContent = 'Compounded APR';
      }

      // Chart Header Title
      const chartTitle = document.getElementById('chart-title');
      if (chartTitle) {
        chartTitle.textContent = isDollar
          ? 'Growth vs Target Annual Projection ($)'
          : 'Growth vs Target Annual Projection (%)';
      }

      this.renderPerformanceChart(data.chart_series, isDollar, data.account_breakdown);
      this.renderPerformanceTable(data.timeframe_metrics, isDollar);
    } catch (err) {
      console.error('Error loading performance metrics:', err);
    }
  },

  renderPerformanceChart(chartSeries, isDollar = false, accountBreakdown = []) {
    const canvas = document.getElementById('accountPerformanceChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (this.charts.performance) {
      this.charts.performance.destroy();
    }

    const labels = chartSeries.map(p => p.date);
    const datasets = [];

    // Check if we have multiple accounts in the breakdown/series
    const isMulti = !this.isSingleAccount && accountBreakdown.length > 1;

    // 1. Total/Blended Actual Line (Green #10b981)
    const actualData = isDollar
      ? chartSeries.map(p => p.actual_balance)
      : chartSeries.map(p => p.actual_return_pct);

    const totalLabel = isMulti
      ? (isDollar ? 'Total ($)' : 'Average Return (%)')
      : (isDollar ? 'Actual Balance ($)' : 'Actual Return (%)');

    datasets.push({
      label: totalLabel,
      data: actualData,
      borderColor: '#10b981',
      backgroundColor: isMulti ? 'transparent' : 'rgba(16, 185, 129, 0.08)',
      borderWidth: 3.0,
      fill: !isMulti,
      tension: 0.3,
      pointRadius: chartSeries.length > 30 ? 0 : 3,
      pointHoverRadius: 6,
      order: 1
    });

    // 2. Target Line (Peach #ff9052, Dashed)
    const targetData = isDollar
      ? chartSeries.map(p => p.target_balance)
      : chartSeries.map(p => p.target_return_pct);

    const targetLabel = isDollar ? 'Target Curve ($)' : 'Target Curve (%)';

    datasets.push({
      label: targetLabel,
      data: targetData,
      borderColor: '#ff9052',
      borderDash: [5, 5],
      borderWidth: 2.2,
      fill: false,
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 5,
      order: 2
    });

    // 3. Multi-account individual lines if multi-selected
    if (isMulti && chartSeries.length > 0) {
      const samplePoint = chartSeries[0];
      const accBalances = samplePoint.account_balances || {};
      const accNames = Object.keys(accBalances);

      accNames.forEach((accName, idx) => {
        const color = ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length];
        const lineData = chartSeries.map(p => {
          if (isDollar) {
            return p.account_balances ? (p.account_balances[accName] || 0) : 0;
          }
          return p.account_returns_pct ? (p.account_returns_pct[accName] || 0) : 0;
        });

        datasets.push({
          label: accName,
          data: lineData,
          borderColor: color,
          borderWidth: 2.0,
          fill: false,
          tension: 0.3,
          pointRadius: chartSeries.length > 30 ? 0 : 2,
          pointHoverRadius: 5,
          order: 3 + idx
        });
      });
    }

    this.charts.performance = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111827',
            titleColor: '#f9fafb',
            bodyColor: '#e5e7eb',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 12,
            boxWidth: 10,
            boxHeight: 10,
            boxPadding: 4,
            usePointStyle: false,
            callbacks: {
              labelColor: (context) => {
                const color = context.dataset.borderColor || '#3b82f6';
                return {
                  borderColor: color,
                  backgroundColor: color,
                  borderWidth: 0,
                  borderRadius: 2
                };
              },
              label: (context) => {
                const val = context.parsed.y;
                if (isDollar) {
                  return ` ${context.dataset.label}: ${formatCurrency(val)}`;
                }
                return ` ${context.dataset.label}: ${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#9ca3af', font: { size: 11 }, maxTicksLimit: 8 }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            ticks: {
              color: '#9ca3af',
              font: { size: 11 },
              callback: (v) => {
                if (isDollar) {
                  if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
                  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}k`;
                  return `$${v}`;
                }
                return `${v >= 0 ? '+' : ''}${v}%`;
              }
            }
          }
        }
      }
    });
  },

  renderPerformanceTable(timeframeMetrics, isDollar = false) {
    const tbody = document.getElementById('performance-timeframe-tbody');
    if (!tbody) return;

    const tfList = ['1M', 'YTD', '1Y', '3Y', '5Y', 'LIFETIME'];
    tbody.innerHTML = tfList.map(tf => {
      const m = timeframeMetrics[tf] || {};
      const contrib = m.net_contributions || 0;
      const gain = m.capital_gain_loss || 0;
      const ret = m.return_pct || 0;
      const tgt = m.target_return_pct || 0;
      const isAhead = m.ahead_of_target;

      return `
        <tr>
          <td><strong>${tf}</strong></td>
          <td>${formatCurrency(m.start_balance)}</td>
          <td>${formatCurrency(m.end_balance)}</td>
          <td style="color: ${contrib !== 0 ? 'var(--text-main)' : 'var(--text-muted)'};">
            ${contrib !== 0 ? (contrib > 0 ? '+' : '') + formatCurrency(contrib) : '—'}
          </td>
          <td class="${gain >= 0 ? 'kpi-change positive' : 'kpi-change negative'}">
            ${gain >= 0 ? '+' : ''}${formatCurrency(gain)}
          </td>
          <td class="${ret >= 0 ? 'kpi-change positive' : 'kpi-change negative'}">
            ${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%
          </td>
          <td>+${tgt.toFixed(2)}%</td>
          <td>
            <span class="badge-pill ${isAhead ? 'green' : 'red'}">${isAhead ? 'Ahead' : 'Behind'}</span>
          </td>
        </tr>
      `;
    }).join('');
  },

  async loadHoldingsAndAllocation() {
    try {
      const filterStr = this.getFilterQueryString();
      const [riskData, holdingsData] = await Promise.all([
        apiFetch(`/analytics/risk-profile?account_filter=${filterStr}`),
        apiFetch(`/analytics/holdings?account_filter=${filterStr}`)
      ]);

      const badge = document.getElementById('blended-risk-badge');
      if (badge) {
        badge.textContent = `${riskData.blended_risk_tier} Risk (${riskData.blended_risk_score.toFixed(1)})`;
        badge.className = `badge-pill ${riskData.blended_risk_tier.toLowerCase().replace(' ', '-')}`;
      }

      this.renderAllocationChart(riskData.asset_allocation);
      this.allHoldings = holdingsData;
      this.renderHoldingsTable(holdingsData);
    } catch (err) {
      console.error('Error loading holdings and allocation:', err);
    }
  },

  renderAllocationChart(allocation) {
    const canvas = document.getElementById('accountAllocationChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (this.charts.allocation) {
      this.charts.allocation.destroy();
    }

    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#ec4899'];
    const labels = (allocation || []).map(a => a.category);
    const data = (allocation || []).map(a => a.value);

    this.charts.allocation = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, color: '#9ca3af', font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.label}: ${formatCurrency(context.raw)}`
            }
          }
        }
      }
    });
  },

  renderHoldingsTable(holdings) {
    const tbody = document.getElementById('holdings-tbody');
    if (!tbody) return;

    if (!holdings || holdings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 2rem;">No holdings found for this account selection.</td></tr>';
      return;
    }

    tbody.innerHTML = holdings.map(h => {
      const gain = h.unrealized_gain_loss || 0;
      const ret = h.unrealized_gain_loss_pct || 0;
      const isPositive = gain >= 0;
      const price = h.institution_price ?? h.price ?? h.unit_price ?? (h.quantity ? h.institution_value / h.quantity : 0);
      const primaryTitle = h.ticker_symbol || h.name || h.security_name || '—';
      const secondaryTitle = (h.name && h.ticker_symbol && h.name !== h.ticker_symbol) ? h.name : (h.security_name || '');

      return `
        <tr>
          <td>
            <strong>${escapeHtml(primaryTitle)}</strong>
            ${secondaryTitle ? `<div style="font-size:0.75rem; color:var(--text-dim);">${escapeHtml(secondaryTitle)}</div>` : ''}
          </td>
          <td><span class="badge-pill moderate">${escapeHtml(h.asset_type || h.asset_class || 'Equity')}</span></td>
          <td>${h.quantity ? h.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 }) : '—'}</td>
          <td>${formatCurrency(price)}</td>
          <td><strong>${formatCurrency(h.institution_value)}</strong></td>
          <td class="${isPositive ? 'kpi-change positive' : 'kpi-change negative'}">
            ${isPositive ? '+' : ''}${formatCurrency(gain)}
          </td>
          <td class="${isPositive ? 'kpi-change positive' : 'kpi-change negative'}">
            ${isPositive ? '+' : ''}${ret.toFixed(2)}%
          </td>
        </tr>
      `;
    }).join('');
  },

  filterHoldingsTable(query) {
    if (!this.allHoldings) return;
    const q = query.toLowerCase().trim();
    if (!q) {
      this.renderHoldingsTable(this.allHoldings);
      return;
    }

    const filtered = this.allHoldings.filter(h =>
      (h.ticker_symbol && h.ticker_symbol.toLowerCase().includes(q)) ||
      (h.name && h.name.toLowerCase().includes(q)) ||
      (h.security_name && h.security_name.toLowerCase().includes(q)) ||
      (h.asset_type && h.asset_type.toLowerCase().includes(q)) ||
      (h.asset_class && h.asset_class.toLowerCase().includes(q))
    );

    this.renderHoldingsTable(filtered);
  },

  unmount() {
    if (this.charts.performance) {
      this.charts.performance.destroy();
      this.charts.performance = null;
    }
    if (this.charts.allocation) {
      this.charts.allocation.destroy();
      this.charts.allocation = null;
    }
  }
};
