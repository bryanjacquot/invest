/**
 * Performance & Analytics View Module (/performance)
 */
import { apiFetch } from '../api.js';
import { state, setMetricUnit } from '../state.js';
import { router } from '../router.js';
import { formatCurrency, formatPercent, formatDate } from '../utils/formatters.js';
import { escapeHtml } from '../utils/dom.js';

export default {
  params: null,
  charts: {
    performance: null,
    allocation: null
  },

  async mount(container, params) {
    this.params = params;
    const activeSubTab = params.get('tab') || 'performance';
    const activeTf = params.get('timeframe') || state.activeTimeframe || '1Y';
    const activeUnit = params.get('unit') || state.metricUnit || 'pct'; // 'pct' or 'dollar'
    state.activeTimeframe = activeTf;
    state.metricUnit = activeUnit;
    setMetricUnit(activeUnit);

    // Sync categories/accounts into state
    const catParam = params.get('categories');
    if (catParam) {
      state.selectedCategories = new Set(catParam.split(',').filter(Boolean));
    } else {
      state.selectedCategories = new Set();
    }

    const accParam = params.get('accounts');
    state.selectedAccountId = accParam || null;

    container.innerHTML = `
      <section id="view-performance-root" class="performance-view-container">
        <!-- Sub-navigation tabs -->
        <nav class="view-tabs" id="performance-sub-tabs">
          <button class="tab-btn ${activeSubTab === 'performance' ? 'active' : ''}" data-subtab="performance">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <span>Performance & Targets</span>
          </button>
          <button class="tab-btn ${activeSubTab === 'holdings' ? 'active' : ''}" data-subtab="holdings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
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
              <div class="btn-group" id="tf-btn-group">
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
              <div class="btn-group" id="unit-btn-group">
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

          <!-- Current TF Summary Cards (Horizontal 4-Column Grid in Single Glass Card) -->
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
              <h3 id="chart-title">Growth vs Target Annual Projection</h3>
              <div class="chart-legend">
                <span class="legend-item"><span class="legend-color-box actual"></span> <span id="legend-label-actual">Actual Portfolio</span></span>
                <span class="legend-item"><span class="legend-color-box target"></span> <span id="legend-label-target">Target Curve</span></span>
              </div>
            </div>
            <div class="canvas-container" style="position: relative; height: 380px; width: 100%;">
              <canvas id="performanceChart"></canvas>
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
                    <th>Gain / Loss</th>
                    <th>Actual Return</th>
                    <th>Target Return</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody id="performance-timeframe-tbody">
                  <tr><td colspan="7" class="text-center">Loading performance metrics...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Account Breakdown Matrix -->
          <div class="glass-card" style="margin-top: 1.5rem; padding: 1.5rem;">
            <h3>Account Performance Breakdown (<span class="current-tf-label">${activeTf}</span>)</h3>
            <div class="table-responsive" style="margin-top: 1rem;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Category</th>
                    <th>Current Balance</th>
                    <th>Gain / Loss</th>
                    <th>Actual Return</th>
                    <th>Target Rate</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody id="account-breakdown-tbody">
                  <tr><td colspan="8" class="text-center">Loading account breakdown...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- SUBTAB 2: Holdings & Allocation -->
        <div id="subtab-content-holdings" class="tab-content ${activeSubTab === 'holdings' ? 'active' : ''}">
          <div class="holdings-layout-grid">
            <!-- Asset Allocation Donut Chart -->
            <div class="glass-card chart-card">
              <div class="chart-header">
                <h3>Asset Allocation</h3>
                <div id="blended-risk-badge" class="badge-pill moderate">Moderate Risk (5.2)</div>
              </div>
              <div class="canvas-container donut-canvas-container" style="position: relative; height: 260px;">
                <canvas id="allocationChart"></canvas>
              </div>
              <div id="account-risks-container" class="account-risks-list" style="margin-top: 1.25rem;"></div>
            </div>

            <!-- Consolidated Holdings Table -->
            <div class="glass-card table-card">
              <div class="table-header-flex">
                <h3>Consolidated Holdings</h3>
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
                      <th>Account</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Value</th>
                      <th>Gain / Loss</th>
                      <th>Return</th>
                    </tr>
                  </thead>
                  <tbody id="holdings-tbody">
                    <tr><td colspan="8" class="text-center">Loading holdings...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    this.bindEvents();
    await this.loadData();
  },

  bindEvents() {
    // Subtab buttons
    document.querySelectorAll('#performance-sub-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const subtab = btn.getAttribute('data-subtab');
        this.updateUrl({ tab: subtab });
      });
    });

    // Timeframe selector
    document.querySelectorAll('#tf-btn-group button').forEach(btn => {
      btn.addEventListener('click', () => {
        const tf = btn.getAttribute('data-tf');
        state.activeTimeframe = tf;
        this.updateUrl({ timeframe: tf });
      });
    });

    // Unit toggle (% vs $)
    document.querySelectorAll('#unit-btn-group button').forEach(btn => {
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
    const newUrl = `/performance${queryString ? `?${queryString}` : ''}`;
    router.navigate(newUrl);
  },

  getFilterParam() {
    if (state.selectedAccountId) {
      return state.selectedAccountId;
    }
    if (state.selectedCategories.size === 0) {
      return 'all';
    }
    return Array.from(state.selectedCategories).join(',');
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
      const isDollar = (this.params.get('unit') === 'dollar');
      const filterParam = this.getFilterParam();
      const data = await apiFetch(`/analytics/performance?timeframe=${state.activeTimeframe}&account_filter=${encodeURIComponent(filterParam)}`);

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
        if (label4) label4.textContent = 'Ending Portfolio Balance';
        if (val4) val4.textContent = formatCurrency(endBalance);
        if (sub4) sub4.textContent = `Start Balance: ${formatCurrency(startBalance)}`;
      } else {
        if (label4) label4.textContent = 'Annualized Return';
        if (val4) val4.textContent = annVal;
        if (sub4) sub4.textContent = 'Compounded APR';
      }

      // Chart Legend Labels and Header Title
      const chartTitle = document.getElementById('chart-title');
      const legendActual = document.getElementById('legend-label-actual');
      const legendTarget = document.getElementById('legend-label-target');
      if (isDollar) {
        if (chartTitle) chartTitle.textContent = 'Portfolio Balance vs Target Projection ($)';
        if (legendActual) legendActual.textContent = 'Actual Portfolio Balance ($)';
        if (legendTarget) legendTarget.textContent = 'Target Projection ($)';
      } else {
        if (chartTitle) chartTitle.textContent = 'Growth vs Target Annual Projection (%)';
        if (legendActual) legendActual.textContent = 'Actual Return (%)';
        if (legendTarget) legendTarget.textContent = 'Target Curve (%)';
      }

      this.renderPerformanceChart(data.chart_series, isDollar);
      this.renderPerformanceTable(data.timeframe_metrics, isDollar);
      this.renderAccountBreakdownTable(data.account_breakdown, isDollar);
    } catch (err) {
      console.error('Error loading performance metrics:', err);
    }
  },

  renderPerformanceChart(chartSeries, isDollar = false) {
    const canvas = document.getElementById('performanceChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (this.charts.performance) {
      this.charts.performance.destroy();
    }

    const labels = chartSeries.map(p => p.date);
    const actualData = isDollar
      ? chartSeries.map(p => p.actual_balance)
      : chartSeries.map(p => p.actual_return_pct);
    const targetData = isDollar
      ? chartSeries.map(p => p.target_balance)
      : chartSeries.map(p => p.target_return_pct);

    const actualLabel = isDollar ? 'Actual Balance ($)' : 'Actual Return (%)';
    const targetLabel = isDollar ? 'Target Projection ($)' : 'Target Return Curve (%)';

    this.charts.performance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: actualLabel,
            data: actualData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.3,
            pointRadius: chartSeries.length > 30 ? 0 : 3,
            pointHoverRadius: 6
          },
          {
            label: targetLabel,
            data: targetData,
            borderColor: '#8b5cf6',
            borderDash: [5, 5],
            borderWidth: 2,
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 5
          }
        ]
      },
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
            callbacks: {
              label: (context) => {
                const val = context.parsed.y;
                if (isDollar) {
                  return `${context.dataset.label}: ${formatCurrency(val)}`;
                }
                return `${context.dataset.label}: ${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
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
      const gain = m.capital_gain_loss || 0;
      const ret = m.return_pct || 0;
      const tgt = m.target_return_pct || 0;
      const isAhead = m.ahead_of_target;

      return `
        <tr>
          <td><strong>${tf}</strong></td>
          <td>${formatCurrency(m.start_balance)}</td>
          <td>${formatCurrency(m.end_balance)}</td>
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

  renderAccountBreakdownTable(breakdown, isDollar = false) {
    const tbody = document.getElementById('account-breakdown-tbody');
    if (!tbody) return;

    if (!breakdown || breakdown.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No accounts matching current filter.</td></tr>';
      return;
    }

    tbody.innerHTML = breakdown.map(a => {
      const isAhead = a.ahead_of_target;
      const ret = a.return_pct || 0;
      return `
        <tr>
          <td>
            <strong>${escapeHtml(a.account_name)}</strong>
            <div style="font-size:0.75rem; color: var(--text-dim);">${escapeHtml(a.institution_name)}</div>
          </td>
          <td><span class="badge-pill moderate">${escapeHtml(a.category_group)}</span></td>
          <td>${formatCurrency(a.current_balance)}</td>
          <td class="${a.gain_loss >= 0 ? 'kpi-change positive' : 'kpi-change negative'}">
            ${a.gain_loss >= 0 ? '+' : ''}${formatCurrency(a.gain_loss)}
          </td>
          <td class="${ret >= 0 ? 'kpi-change positive' : 'kpi-change negative'}">
            ${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%
          </td>
          <td>+${(a.target_rate || 7.0).toFixed(1)}%</td>
          <td>
            <span class="badge-pill ${isAhead ? 'green' : 'red'}">${isAhead ? 'On Target' : 'Behind'}</span>
          </td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="window.dispatchEvent(new CustomEvent('invest:navigate-account', { detail: { accountId: '${a.account_id}' } }))">
              Details →
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async loadHoldingsAndAllocation() {
    try {
      const filterParam = this.getFilterParam();
      const [riskData, holdingsData] = await Promise.all([
        apiFetch(`/analytics/risk-profile?account_filter=${encodeURIComponent(filterParam)}`),
        apiFetch(`/analytics/holdings?account_filter=${encodeURIComponent(filterParam)}`)
      ]);

      const badge = document.getElementById('blended-risk-badge');
      if (badge) {
        badge.textContent = `${riskData.blended_risk_tier} Risk (${riskData.blended_risk_score.toFixed(1)})`;
        badge.className = `badge-pill ${riskData.blended_risk_tier.toLowerCase().replace(' ', '-')}`;
      }

      this.renderAllocationChart(riskData.asset_allocation);
      this.renderAccountRisksList(riskData.account_risks);
      this.allHoldings = holdingsData;
      this.renderHoldingsTable(holdingsData);
    } catch (err) {
      console.error('Error loading holdings and allocation:', err);
    }
  },

  renderAllocationChart(allocation) {
    const canvas = document.getElementById('allocationChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (this.charts.allocation) {
      this.charts.allocation.destroy();
    }

    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#ec4899'];
    const labels = allocation.map(a => a.category);
    const data = allocation.map(a => a.value);

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

  renderAccountRisksList(accountRisks) {
    const container = document.getElementById('account-risks-container');
    if (!container) return;

    container.innerHTML = `
      <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-dim); margin-bottom: 0.5rem; text-transform: uppercase;">
        Account Risk Ratings
      </div>
      ${accountRisks.map(r => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem;">
          <span style="font-weight: 500;">${escapeHtml(r.account_name)}</span>
          <span class="badge-pill ${r.risk_tier.toLowerCase().replace(' ', '-')}">${r.risk_tier} (${r.risk_score})</span>
        </div>
      `).join('')}
    `;
  },

  renderHoldingsTable(holdings) {
    const tbody = document.getElementById('holdings-tbody');
    if (!tbody) return;

    if (!holdings || holdings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No holdings found for selected filter.</td></tr>';
      return;
    }

    tbody.innerHTML = holdings.map(h => {
      const gain = (h.gain_loss_dollars || 0);
      const gainPct = (h.gain_loss_pct || 0);
      return `
        <tr>
          <td>
            <strong>${escapeHtml(h.ticker || '—')}</strong>
            <div style="font-size:0.75rem; color: var(--text-dim);">${escapeHtml(h.name)}</div>
          </td>
          <td><span class="badge-pill moderate">${escapeHtml(h.asset_class)}</span></td>
          <td style="font-size:0.8rem; color: var(--text-muted);">${escapeHtml(h.account_name)}</td>
          <td>${(h.quantity || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
          <td>${formatCurrency(h.price)}</td>
          <td><strong>${formatCurrency(h.current_value)}</strong></td>
          <td class="${gain >= 0 ? 'kpi-change positive' : 'kpi-change negative'}">
            ${gain >= 0 ? '+' : ''}${formatCurrency(gain)}
          </td>
          <td class="${gainPct >= 0 ? 'kpi-change positive' : 'kpi-change negative'}">
            ${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(2)}%
          </td>
        </tr>
      `;
    }).join('');
  },

  filterHoldingsTable(query) {
    if (!this.allHoldings) return;
    const q = (query || '').toLowerCase().trim();
    const filtered = this.allHoldings.filter(h =>
      (h.ticker && h.ticker.toLowerCase().includes(q)) ||
      (h.name && h.name.toLowerCase().includes(q)) ||
      (h.account_name && h.account_name.toLowerCase().includes(q))
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
