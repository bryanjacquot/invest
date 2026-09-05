/**
 * InvestTracker — Client Single Page Application Logic
 */

// Global State
const state = {
  token: localStorage.getItem('invest_token') || null,
  user: null,
  accounts: [],
  selectedCategories: new Set(), // empty set means 'all'
  selectedAccountId: null,
  activeTimeframe: '1Y',
  viewFormat: 'chart',
  isAuthRegisterMode: false,
  sidebarOpen: localStorage.getItem('invest_sidebar_open') !== 'false',
  activeView: 'overview',
  subTab: 'performance',
  charts: {
    performance: null,
    allocation: null
  }
};

// Intelligently route API calls: use port 3011 directly when running on local dev servers, or relative /api behind Synology / Nginx reverse proxy
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? `${window.location.protocol}//${window.location.hostname}:3011/api`
  : '/api';

function getActiveFilterParam() {
  if (state.selectedAccountId) {
    return state.selectedAccountId;
  }
  if (state.selectedCategories.size === 0) {
    return 'all';
  }
  return Array.from(state.selectedCategories).join(',');
}

// =========================================================================
// API Helpers
// =========================================================================
async function apiFetch(endpoint, options = {}) {
  const headers = options.headers || {};
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Request failed with status ${res.status}`);
    }

    // Return blob if file download
    if (res.headers.get('content-type')?.includes('application/x-sqlite3')) {
      return res.blob();
    }

    return res.json();
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

function handleUnauthorized() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('invest_token');
  showAuthModal();
}

// =========================================================================
// Authentication & Initialization
// =========================================================================
async function initApp() {
  setupEventListeners();
  applySidebarState();

  if (!state.token) {
    showAuthModal();
    return;
  }

  try {
    state.user = await apiFetch('/auth/me');
    updateUserDisplay();
    await refreshAllData();
  } catch (err) {
    showAuthModal();
  }
}

function updateUserDisplay() {
  if (state.user) {
    document.getElementById('user-display-name').textContent = state.user.username;
    const dropUser = document.getElementById('dropdown-username');
    if (dropUser) dropUser.textContent = state.user.username;
    document.getElementById('user-avatar').textContent = state.user.username.charAt(0).toUpperCase();
  }
}

function showAuthModal() {
  const modal = document.getElementById('modal-auth');
  modal.classList.remove('hidden');
}

function hideAuthModal() {
  document.getElementById('modal-auth').classList.add('hidden');
}

// =========================================================================
// Sidebar State Management
// =========================================================================
function applySidebarState() {
  const app = document.getElementById('app');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (state.sidebarOpen) {
    app.classList.remove('sidebar-collapsed');
    backdrop?.classList.add('hidden');
  } else {
    app.classList.add('sidebar-collapsed');
    backdrop?.classList.add('hidden');
  }
}

function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  localStorage.setItem('invest_sidebar_open', state.sidebarOpen ? 'true' : 'false');
  applySidebarState();

  // If mobile, show/hide backdrop
  if (window.innerWidth <= 1024) {
    const backdrop = document.getElementById('sidebar-backdrop');
    if (state.sidebarOpen) {
      backdrop?.classList.remove('hidden');
    } else {
      backdrop?.classList.add('hidden');
    }
  }
}

function closeSidebarMobile() {
  if (window.innerWidth <= 1024) {
    state.sidebarOpen = false;
    applySidebarState();
  }
}

// =========================================================================
// Dashboard Data Refreshers
// =========================================================================
async function refreshAllData() {
  try {
    await loadAccounts();
  } catch (err) {
    console.error('Error loading accounts:', err);
  }

  try {
    await Promise.allSettled([
      loadNetWorthSummary(),
      loadPerformance(),
      loadHoldingsAndAllocation(),
      loadRealEstateEquity()
    ]);
  } catch (err) {
    console.error('Error loading dashboard data:', err);
  }
}

async function loadAccounts() {
  state.accounts = await apiFetch('/accounts');
  renderSidebarFilters();
  renderSidebarAccountsList();
  populateLinkedAssetDropdowns();
}

async function loadNetWorthSummary() {
  const data = await apiFetch('/analytics/net-worth');
  
  // Calculate per-category balances and account counts from state.accounts
  let retBal = 0, retCount = 0;
  let taxBal = 0, taxCount = 0;
  let iraBal = 0, iraCount = 0;
  let emgBal = 0, emgCount = 0;
  let reBal = 0, reCount = 0;
  let mortBal = 0, mortCount = 0;

  if (state.accounts && state.accounts.length > 0) {
    state.accounts.forEach(a => {
      const bal = a.current_balance || 0;
      if (a.account_class === 'liability' || a.category_group === 'Debt' || a.category_group === 'Mortgages' || a.category_group === 'Mortgage') {
        mortBal += bal; mortCount++;
      } else if (a.category_group === 'Emergency Savings' || a.subtype === 'savings') {
        emgBal += bal; emgCount++;
      } else if (a.category_group === 'Real Estate' || a.type === 'real_estate') {
        reBal += bal; reCount++;
      } else if (a.category_group === 'Retirement' || a.subtype === '401k' || a.subtype === '403b') {
        retBal += bal; retCount++;
      } else if (a.category_group === 'Taxable Brokerage' || a.subtype === 'brokerage') {
        taxBal += bal; taxCount++;
      } else if (a.category_group === 'IRAs' || a.category_group === 'IRA' || a.subtype === 'ira' || a.subtype === 'roth') {
        iraBal += bal; iraCount++;
      }
    });
  }

  // Use state.accounts when available, fallback to backend aggregated values
  const netWorthVal = data.total_net_worth || 0;
  const retirementVal = retCount > 0 ? retBal : (data.total_retirement || 0);
  const taxableVal = taxCount > 0 ? taxBal : (data.total_taxable_brokerage || 0);
  const iraVal = iraCount > 0 ? iraBal : (data.total_iras || 0);
  const emergencyVal = emgCount > 0 ? emgBal : (data.total_emergency_savings || 0);
  const realEstateVal = reCount > 0 ? reBal : (data.total_real_estate_assets || 0);
  const mortgageVal = mortCount > 0 ? mortBal : (data.total_mortgages || data.total_liabilities || 0);

  // 1. All Accounts (Blended)
  const elAll = document.getElementById('kpi-all-accounts');
  if (elAll) elAll.textContent = formatCurrency(netWorthVal);

  // 2. Retirement
  const elRet = document.getElementById('kpi-retirement');
  if (elRet) elRet.textContent = formatCurrency(retirementVal);
  const elRetCount = document.getElementById('kpi-count-retirement');
  if (elRetCount) elRetCount.textContent = `${retCount} ${retCount === 1 ? 'account' : 'accounts'}`;

  // 3. Taxable Brokerage
  const elTax = document.getElementById('kpi-taxable-brokerage');
  if (elTax) elTax.textContent = formatCurrency(taxableVal);
  const elTaxCount = document.getElementById('kpi-count-taxable-brokerage');
  if (elTaxCount) elTaxCount.textContent = `${taxCount} ${taxCount === 1 ? 'account' : 'accounts'}`;

  // 4. IRAs
  const elIra = document.getElementById('kpi-iras');
  if (elIra) elIra.textContent = formatCurrency(iraVal);
  const elIraCount = document.getElementById('kpi-count-iras');
  if (elIraCount) elIraCount.textContent = `${iraCount} ${iraCount === 1 ? 'account' : 'accounts'}`;

  // 5. Emergency Savings
  const elEmg = document.getElementById('kpi-emergency-savings');
  if (elEmg) elEmg.textContent = formatCurrency(emergencyVal);

  // 6. Real Estate
  const elRe = document.getElementById('kpi-real-estate');
  if (elRe) elRe.textContent = formatCurrency(realEstateVal);

  // 7. Mortgages
  const elMort = document.getElementById('kpi-mortgages');
  if (elMort) elMort.textContent = formatCurrency(mortgageVal);

  // 1Y and YTD changes
  const nw1y = document.getElementById('kpi-nw-1y');
  if (nw1y) {
    nw1y.textContent = `${data.change_1y_pct >= 0 ? '+' : ''}${data.change_1y_pct.toFixed(1)}% (1Y)`;
    nw1y.className = `kpi-change ${data.change_1y_pct >= 0 ? 'positive' : 'negative'}`;
  }

  // Overview Capital Structure detail statistics
  const totalAssets = (data.total_invested_assets || (retBal + taxBal + iraBal)) + realEstateVal + emergencyVal;
  const totalLiabilities = mortgageVal;
  const netWorth = netWorthVal;
  const debtToAssetPct = totalAssets > 0 ? ((totalLiabilities / totalAssets) * 100).toFixed(1) : '0.0';
  const equityRatioPct = totalAssets > 0 ? ((netWorth / totalAssets) * 100).toFixed(1) : '100.0';

  const elTotalAssets = document.getElementById('overview-total-assets');
  if (elTotalAssets) elTotalAssets.textContent = formatCurrency(totalAssets);

  const elTotalLiabilities = document.getElementById('overview-total-liabilities');
  if (elTotalLiabilities) elTotalLiabilities.textContent = formatCurrency(totalLiabilities);

  const elDebtRatio = document.getElementById('overview-debt-ratio');
  if (elDebtRatio) elDebtRatio.textContent = `${debtToAssetPct}%`;

  const elEquityRatio = document.getElementById('overview-equity-ratio');
  if (elEquityRatio) elEquityRatio.textContent = `${equityRatioPct}%`;

  if (data.last_synced_at) {
    const d = new Date(data.last_synced_at);
    const syncEl = document.getElementById('last-sync-time');
    if (syncEl) syncEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

async function loadPerformance() {
  const filterParam = getActiveFilterParam();
  const data = await apiFetch(`/analytics/performance?timeframe=${state.activeTimeframe}&account_filter=${encodeURIComponent(filterParam)}`);
  
  // Update Current TF summary cards
  const currMetric = data.timeframe_metrics[state.activeTimeframe] || {};
  document.querySelectorAll('.current-tf-label').forEach(el => el.textContent = state.activeTimeframe);

  const retEl = document.getElementById('metric-actual-return');
  const retVal = currMetric.return_pct || 0;
  retEl.textContent = `${retVal >= 0 ? '+' : ''}${retVal.toFixed(2)}%`;
  retEl.className = `val ${retVal >= 0 ? 'positive' : 'negative'}`;

  const gainEl = document.getElementById('metric-actual-gain');
  const gainVal = currMetric.capital_gain_loss || 0;
  gainEl.textContent = `${gainVal >= 0 ? '+' : ''}${formatCurrency(gainVal)}`;

  const tgtRetEl = document.getElementById('metric-target-return');
  tgtRetEl.textContent = `+${(currMetric.target_return_pct || 0).toFixed(2)}%`;

  const tgtGainEl = document.getElementById('metric-target-gain');
  tgtGainEl.textContent = formatCurrency((currMetric.target_end_balance || 0) - (currMetric.start_balance || 0));

  const varEl = document.getElementById('metric-variance');
  const varVal = currMetric.variance_pct || 0;
  varEl.textContent = `${varVal >= 0 ? '+' : ''}${varVal.toFixed(2)}%`;
  varEl.className = `val ${varVal >= 0 ? 'positive' : 'negative'}`;

  const statusEl = document.getElementById('metric-variance-status');
  if (currMetric.ahead_of_target) {
    statusEl.textContent = 'Ahead of Target';
    statusEl.className = 'badge-pill green';
  } else {
    statusEl.textContent = 'Behind Target';
    statusEl.className = 'badge-pill red';
  }

  const annEl = document.getElementById('metric-annualized');
  annEl.textContent = currMetric.annualized_return_pct !== null && currMetric.annualized_return_pct !== undefined ? `${currMetric.annualized_return_pct.toFixed(2)}%` : '—';

  // Render Charts & Tables
  renderPerformanceChart(data.chart_series);
  renderPerformanceTable(data.timeframe_metrics);
  renderAccountBreakdownTable(data.account_breakdown);
}

async function loadHoldingsAndAllocation() {
  const filterParam = getActiveFilterParam();
  const [riskData, holdingsData] = await Promise.all([
    apiFetch(`/analytics/risk-profile?account_filter=${encodeURIComponent(filterParam)}`),
    apiFetch(`/analytics/holdings?account_filter=${encodeURIComponent(filterParam)}`)
  ]);

  // Risk profile badge
  const badge = document.getElementById('blended-risk-badge');
  badge.textContent = `${riskData.blended_risk_tier} Risk (${riskData.blended_risk_score.toFixed(1)})`;
  badge.className = `badge-pill ${riskData.blended_risk_tier.toLowerCase().replace(' ', '-')}`;

  renderAllocationChart(riskData.asset_allocation);
  renderAccountRisksList(riskData.account_risks);
  renderHoldingsTable(holdingsData);
}

async function loadRealEstateEquity() {
  try {
    const properties = await apiFetch('/accounts/real-estate-equity');
    const container = document.getElementById('real-estate-cards-container');
    const eqEl = document.getElementById('kpi-re-equity');
    
    if (!properties || properties.length === 0) {
      if (container) {
        container.innerHTML = `
          <div class="glass-card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
            <h3>No Real Estate Properties Tracked Yet</h3>
            <p class="subtext" style="margin: 0.75rem 0 0;">Add your primary residence, rental units, or land using the <strong>+ Add Account</strong> action in the left navigation panel.</p>
          </div>
        `;
      }
      if (eqEl) eqEl.textContent = 'Equity: $0.00';
      return;
    }

    let totalPropVal = 0;
    let totalMortVal = 0;

    const cardsHtml = properties.map(p => {
      totalPropVal += (p.market_value || 0);
      totalMortVal += (p.mortgage_balance || 0);

      return `
        <div class="glass-card property-card">
          <div class="property-card-header">
            <div>
              <div class="property-title">🏡 ${escapeHtml(p.property_name)}</div>
              <div class="property-address">${escapeHtml(p.property_address || 'Real Estate Asset')}</div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="openValuationModal('${p.property_account_id}', ${p.market_value}, 'Property Valuation')">Update Value</button>
          </div>

          <div class="equity-bar-container">
            <div class="equity-stats">
              <span><strong>Equity:</strong> ${formatCurrency(p.equity_value)} (${p.equity_pct}%)</span>
              <span><strong>LTV:</strong> ${p.ltv_pct}%</span>
            </div>
            <div class="equity-bar" title="Green: Equity, Red: Debt">
              <div class="equity-fill" style="width: ${p.equity_pct}%;"></div>
            </div>
          </div>

          <div class="property-details-grid">
            <div>
              <span class="subtext">Market Valuation:</span>
              <div><strong>${formatCurrency(p.market_value)}</strong></div>
            </div>
            <div>
              <span class="subtext">Mortgage Balance:</span>
              <div style="color: var(--accent-red);"><strong>${p.mortgage_balance > 0 ? formatCurrency(p.mortgage_balance) : 'No Loan (Paid Off)'}</strong></div>
            </div>
            <div>
              <span class="subtext">Interest Rate:</span>
              <div>${p.interest_rate ? `${p.interest_rate}%` : '—'}</div>
            </div>
            <div>
              <span class="subtext">Monthly Payment:</span>
              <div>${p.monthly_payment ? formatCurrency(p.monthly_payment) : '—'}</div>
            </div>
          </div>

          ${p.mortgage_account_id ? `
            <div style="display:flex; justify-content:flex-end;">
              <button class="btn btn-sm btn-secondary" onclick="openValuationModal('${p.mortgage_account_id}', ${p.mortgage_balance}, 'Mortgage Balance Paydown')">Log Loan Payment</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    if (container) {
      container.innerHTML = cardsHtml;
    }

    // Update KPI subtext
    const totalEquity = Math.max(0, totalPropVal - totalMortVal);
    if (eqEl) eqEl.textContent = `Equity: ${formatCurrency(totalEquity)}`;
  } catch (err) {
    console.error('Error in loadRealEstateEquity:', err);
  }
}

// =========================================================================
// Chart Renderers (Chart.js)
// =========================================================================
function renderPerformanceChart(chartSeries) {
  const ctx = document.getElementById('performanceChart').getContext('2d');
  
  if (state.charts.performance) {
    state.charts.performance.destroy();
  }

  const labels = chartSeries.map(p => p.date);
  const actualData = chartSeries.map(p => p.actual_return_pct);
  const targetData = chartSeries.map(p => p.target_return_pct);

  state.charts.performance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Actual Return (%)',
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
          label: 'Target Return Curve (%)',
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
      interaction: {
        mode: 'index',
        intersect: false
      },
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
            label: function(context) {
              const val = context.parsed.y;
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
            callback: value => `${value >= 0 ? '+' : ''}${value}%`
          }
        }
      }
    }
  });
}

function renderAllocationChart(allocation) {
  const ctx = document.getElementById('allocationChart').getContext('2d');
  if (state.charts.allocation) {
    state.charts.allocation.destroy();
  }

  const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#ec4899'];
  const labels = allocation.map(a => a.category);
  const data = allocation.map(a => a.value);

  state.charts.allocation = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111827',
          padding: 10,
          callbacks: {
            label: context => `${context.label}: ${formatCurrency(context.raw)}`
          }
        }
      }
    }
  });

  // Render HTML legend
  const legendContainer = document.getElementById('allocation-legend-list');
  legendContainer.innerHTML = allocation.map((a, idx) => `
    <div class="legend-item" style="display:flex; justify-content:space-between; margin-top:0.4rem; font-size:0.85rem;">
      <span style="display:flex; align-items:center; gap:0.4rem;">
        <span style="width:8px; height:8px; border-radius:50%; background:${colors[idx % colors.length]};"></span>
        ${escapeHtml(a.category)} (${a.pct}%)
      </span>
      <strong>${formatCurrency(a.value)}</strong>
    </div>
  `).join('');
}

// =========================================================================
// Table Renderers
// =========================================================================
function renderPerformanceTable(metrics) {
  const tbody = document.getElementById('performance-table-body');
  const tfs = ['1M', 'YTD', '1Y', '3Y', '5Y', 'Lifetime'];
  
  tbody.innerHTML = tfs.map(tf => {
    const m = metrics[tf] || {};
    const ret = m.return_pct || 0;
    const isAhead = m.ahead_of_target;
    return `
      <tr>
        <td><strong>${tf}</strong></td>
        <td>${formatCurrency(m.start_balance || 0)}</td>
        <td>${formatCurrency(m.end_balance || 0)}</td>
        <td class="${(m.capital_gain_loss || 0) >= 0 ? 'kpi-change positive' : 'kpi-change negative'}">
          ${(m.capital_gain_loss || 0) >= 0 ? '+' : ''}${formatCurrency(m.capital_gain_loss || 0)}
        </td>
        <td class="${ret >= 0 ? 'kpi-change positive' : 'kpi-change negative'}">
          <strong>${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%</strong>
        </td>
        <td>${(m.target_return_pct || 0).toFixed(2)}%</td>
        <td>${formatCurrency(m.target_end_balance || 0)}</td>
        <td class="${isAhead ? 'kpi-change positive' : 'kpi-change negative'}">
          ${isAhead ? '+' : ''}${formatCurrency(m.variance_dollars || 0)}
        </td>
        <td>
          <span class="badge-pill ${isAhead ? 'green' : 'red'}">${isAhead ? 'Ahead' : 'Behind'}</span>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAccountBreakdownTable(accounts) {
  const tbody = document.getElementById('account-performance-table-body');
  if (accounts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No accounts available for active filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = accounts.map(a => {
    const ret = a.return_pct || 0;
    const isAhead = a.ahead_of_target;
    return `
      <tr>
        <td><strong>${escapeHtml(a.account_name)}</strong></td>
        <td><span class="badge-pill moderate">${escapeHtml(a.category_group)}</span></td>
        <td>${a.target_rate_pct}% / yr</td>
        <td>${formatCurrency(a.start_balance)}</td>
        <td>${formatCurrency(a.end_balance)}</td>
        <td class="${a.gain_loss >= 0 ? 'kpi-change positive' : 'kpi-change negative'}">
          ${a.gain_loss >= 0 ? '+' : ''}${formatCurrency(a.gain_loss)}
        </td>
        <td class="${ret >= 0 ? 'kpi-change positive' : 'kpi-change negative'}">
          <strong>${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%</strong>
        </td>
        <td>+${(a.target_return_pct || 0).toFixed(2)}%</td>
        <td class="${isAhead ? 'kpi-change positive' : 'kpi-change negative'}">
          ${isAhead ? '+' : ''}${formatCurrency(a.variance_dollars)}
        </td>
      </tr>
    `;
  }).join('');
}

function renderHoldingsTable(holdings) {
  const tbody = document.getElementById('holdings-table-body');
  const searchInput = document.getElementById('holding-search-input');
  const query = (searchInput.value || '').toLowerCase();

  const filtered = holdings.filter(h => 
    (h.name || '').toLowerCase().includes(query) || 
    (h.ticker_symbol || '').toLowerCase().includes(query) ||
    (h.account_name || '').toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" style="text-align:center;">No matching holdings found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(h => {
    const gain = h.unrealized_gain_loss || 0;
    const gainPct = h.unrealized_gain_loss_pct || 0;
    return `
      <tr>
        <td><span class="ticker-badge">${escapeHtml(h.ticker_symbol || '—')}</span></td>
        <td><strong>${escapeHtml(h.name)}</strong></td>
        <td>${escapeHtml(h.account_name || '—')}</td>
        <td><span class="subtext">${escapeHtml(h.asset_type)}</span></td>
        <td>${h.quantity.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
        <td>${formatCurrency(h.institution_price)}</td>
        <td><strong>${formatCurrency(h.institution_value)}</strong></td>
        <td>${formatCurrency(h.cost_basis)}</td>
        <td class="${gain >= 0 ? 'kpi-change positive' : 'kpi-change negative'}">
          ${gain >= 0 ? '+' : ''}${formatCurrency(gain)}
        </td>
        <td class="${gainPct >= 0 ? 'kpi-change positive' : 'kpi-change negative'}">
          ${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(2)}%
        </td>
        <td>${h.portfolio_weight_pct}%</td>
        <td><span class="badge-pill ${h.risk_tier.toLowerCase().replace(' ', '-')}">${h.risk_tier}</span></td>
      </tr>
    `;
  }).join('');
}

function renderAccountRisksList(accountRisks) {
  const container = document.getElementById('account-risk-list');
  container.innerHTML = accountRisks.map(a => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding: 0.6rem 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
      <div>
        <strong>${escapeHtml(a.account_name)}</strong>
        <div class="subtext">${formatCurrency(a.value)}</div>
      </div>
      <div style="text-align:right;">
        <span class="badge-pill ${a.risk_tier.toLowerCase().replace(' ', '-')}">${a.risk_tier} (${a.risk_score.toFixed(1)})</span>
      </div>
    </div>
  `).join('');
}

// =========================================================================
// Sidebar Filter & Account Renderers
// =========================================================================
function renderSidebarFilters() {
  // Compute counts per category
  const counts = {
    'Retirement': 0,
    'Taxable Brokerage': 0,
    'IRAs': 0,
    'Emergency Savings': 0,
    'Real Estate': 0,
    'Debt': 0
  };

  state.accounts.forEach(a => {
    const cat = a.category_group;
    if (counts[cat] !== undefined) {
      counts[cat]++;
    } else if (cat === 'Debt' || cat === 'Mortgages' || a.account_class === 'liability') {
      counts['Debt']++;
    }
  });

  // Update count badges
  const elRet = document.getElementById('count-Retirement');
  if (elRet) elRet.textContent = counts['Retirement'];

  const elBrok = document.getElementById('count-Taxable-Brokerage');
  if (elBrok) elBrok.textContent = counts['Taxable Brokerage'];

  const elIra = document.getElementById('count-IRAs');
  if (elIra) elIra.textContent = counts['IRAs'];

  const elEmg = document.getElementById('count-Emergency-Savings');
  if (elEmg) elEmg.textContent = counts['Emergency Savings'];

  const elRe = document.getElementById('count-Real-Estate');
  if (elRe) elRe.textContent = counts['Real Estate'];

  const elDebt = document.getElementById('count-Debt');
  if (elDebt) elDebt.textContent = counts['Debt'];

  // Sync checkboxes with state
  const allCheckbox = document.getElementById('filter-all-checkbox');
  const isAll = (state.selectedCategories.size === 0 && !state.selectedAccountId);
  if (allCheckbox) allCheckbox.checked = isAll;

  const allRow = document.querySelector('.filter-item-row[data-filter="all"]');
  if (allRow) allRow.classList.toggle('active', isAll);

  document.querySelectorAll('.filter-cat-checkbox').forEach(cb => {
    const val = cb.value;
    const isChecked = state.selectedCategories.has(val);
    cb.checked = isChecked;
    cb.closest('.filter-item-row')?.classList.toggle('active', isChecked);
  });
}

function renderSidebarAccountsList() {
  const container = document.getElementById('sidebar-accounts-list');
  const countBadge = document.getElementById('sidebar-accounts-count');

  if (countBadge) countBadge.textContent = state.accounts.length;

  if (state.accounts.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 1.5rem 0.5rem; color: var(--text-dim); font-size: 0.8rem;">
        No accounts added yet.<br>Click below to connect or add an account.
      </div>
    `;
    return;
  }

  container.innerHTML = state.accounts.map(a => {
    let icon = '🏦';
    if (a.category_group === 'Retirement' || a.subtype === '401k') icon = '🛡️';
    else if (a.category_group === 'IRAs' || a.subtype === 'ira') icon = '🪙';
    else if (a.category_group === 'Taxable Brokerage' || a.subtype === 'brokerage') icon = '📈';
    else if (a.category_group === 'Emergency Savings' || a.subtype === 'savings') icon = '🚨';
    else if (a.category_group === 'Real Estate' || a.type === 'real_estate') icon = '🏡';
    else if (a.category_group === 'Debt' || a.category_group === 'Mortgages' || a.account_class === 'liability') icon = '💳';

    const isSelectedAccount = state.selectedAccountId === a.id;

    return `
      <div class="sidebar-account-item ${isSelectedAccount ? 'active' : ''}" data-account-id="${a.id}" onclick="handleAccountItemClick('${a.id}')">
        <div class="account-item-left">
          <span class="account-item-icon">${icon}</span>
          <div class="account-item-title-group">
            <span class="account-item-name" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</span>
            <span class="account-item-sub">${escapeHtml(a.category_group)}</span>
          </div>
        </div>
        <div class="account-item-right">
          <span class="account-item-bal">${formatCurrency(a.current_balance)}</span>
          <button class="account-pencil-btn" title="Configure Account Settings" type="button" onclick="event.stopPropagation(); openEditAccountModal('${a.id}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function handleAccountItemClick(accountId) {
  if (state.selectedAccountId === accountId) {
    // Deselect
    state.selectedAccountId = null;
  } else {
    state.selectedAccountId = accountId;
    state.selectedCategories.clear();
  }
  renderSidebarFilters();
  renderSidebarAccountsList();
  showAccountFiltersView();
}

function populateLinkedAssetDropdowns() {
  const assetAccounts = state.accounts.filter(a => a.account_class === 'asset');
  const loanDropdown = document.getElementById('loan-linked-asset');
  const editDropdown = document.getElementById('edit-account-linked-asset');

  const options = '<option value="">None (Unsecured / Standalone)</option>' + 
    assetAccounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${escapeHtml(a.category_group)})</option>`).join('');

  if (loanDropdown) loanDropdown.innerHTML = options;
  if (editDropdown) editDropdown.innerHTML = options;
}

// =========================================================================
// Event Listeners & Modals
// =========================================================================

async function showOverview() {
  state.activeView = 'overview';

  // Highlight sidebar overview item
  document.getElementById('sidebar-nav-overview')?.classList.add('active');

  // Hide account sub-tabs
  document.getElementById('account-view-tabs')?.classList.add('hidden');

  // Activate overview tab content
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-overview')?.classList.add('active');

  // Ensure accounts are loaded if empty
  if (!state.accounts || state.accounts.length === 0) {
    try {
      await loadAccounts();
    } catch (e) {
      console.error('Error loading accounts in showOverview:', e);
    }
  }

  // Load overview metrics
  await Promise.allSettled([
    loadNetWorthSummary(),
    loadRealEstateEquity()
  ]);
}

function showAccountFiltersView(subTabName) {
  // Check if specifically Real Estate filter is selected
  const isOnlyRealEstate = state.selectedCategories.size === 1 && state.selectedCategories.has('Real Estate');
  const isRealEstateAccount = state.selectedAccountId && state.accounts.find(a => a.id === state.selectedAccountId && (a.category_group === 'Real Estate' || a.type === 'real_estate'));

  if (isOnlyRealEstate || isRealEstateAccount) {
    showRealEstateView();
    return;
  }

  state.activeView = 'account_filters';

  // Deactivate sidebar overview item
  document.getElementById('sidebar-nav-overview')?.classList.remove('active');

  // Show account sub-navigation tabs (Performance & Targets / Holdings & Allocation)
  const accountTabs = document.getElementById('account-view-tabs');
  if (accountTabs) accountTabs.classList.remove('hidden');

  // Determine active subtab
  const activeSubTab = subTabName || state.subTab || 'performance';
  state.subTab = activeSubTab;

  // Update top sub-tab buttons
  document.querySelectorAll('#account-view-tabs .tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === activeSubTab);
  });

  // Activate corresponding tab content
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`tab-${activeSubTab}`)?.classList.add('active');

  // Refresh active tab data
  if (activeSubTab === 'performance') {
    loadPerformance();
  } else if (activeSubTab === 'holdings') {
    loadHoldingsAndAllocation();
  }
}

function showRealEstateView() {
  state.activeView = 'real_estate';

  // Deactivate sidebar overview item
  document.getElementById('sidebar-nav-overview')?.classList.remove('active');

  // Hide account sub-tabs
  document.getElementById('account-view-tabs')?.classList.add('hidden');

  // Activate Real Estate tab content
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-realestate')?.classList.add('active');

  // Refresh Real Estate data
  loadRealEstate();
}

function setupEventListeners() {
  // Sidebar Toggle
  document.getElementById('btn-toggle-sidebar')?.addEventListener('click', toggleSidebar);
  document.getElementById('btn-close-sidebar')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-backdrop')?.addEventListener('click', toggleSidebar);

  // Sidebar Overview Navigation Item
  document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      showOverview();
      if (window.innerWidth <= 768) {
        closeSidebarMobile();
      }
    });
  });

  // Top Sub-Tabs Switching (Performance & Targets / Holdings & Allocation)
  document.querySelectorAll('#account-view-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      showAccountFiltersView(tabName);
    });
  });

  // Sidebar Filter Listeners
  // All Accounts Checkbox
  const allRow = document.querySelector('.filter-item-row[data-filter="all"]');
  const allCheckbox = document.getElementById('filter-all-checkbox');

  const handleAllFilterClick = (e) => {
    if (e.target !== allCheckbox) {
      allCheckbox.checked = true;
    }
    state.selectedCategories.clear();
    state.selectedAccountId = null;
    renderSidebarFilters();
    renderSidebarAccountsList();
    showAccountFiltersView('performance');
  };

  allRow?.addEventListener('click', (e) => {
    if (e.target === allCheckbox) return; // handled by change event
    handleAllFilterClick(e);
  });
  allCheckbox?.addEventListener('change', handleAllFilterClick);

  // Category Checkboxes
  document.querySelectorAll('.filter-cat-checkbox').forEach(cb => {
    const handleCategoryToggle = () => {
      state.selectedAccountId = null; // reset specific account
      const cat = cb.value;
      if (cb.checked) {
        state.selectedCategories.add(cat);
      } else {
        state.selectedCategories.delete(cat);
      }
      renderSidebarFilters();
      renderSidebarAccountsList();
      showAccountFiltersView();
    };

    cb.addEventListener('change', handleCategoryToggle);
    cb.closest('.filter-item-row')?.addEventListener('click', (e) => {
      if (e.target === cb) return;
      cb.checked = !cb.checked;
      handleCategoryToggle();
    });
  });

  // Timeframe selector
  document.querySelectorAll('.tf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTimeframe = btn.getAttribute('data-tf');
      loadPerformance();
    });
  });

  // View toggle (Chart vs Table)
  document.getElementById('toggle-view-chart')?.addEventListener('click', () => {
    document.getElementById('toggle-view-chart').classList.add('active');
    document.getElementById('toggle-view-table').classList.remove('active');
    document.getElementById('performance-chart-container').classList.remove('hidden');
    document.getElementById('performance-table-container').classList.add('hidden');
  });

  document.getElementById('toggle-view-table')?.addEventListener('click', () => {
    document.getElementById('toggle-view-table').classList.add('active');
    document.getElementById('toggle-view-chart').classList.remove('active');
    document.getElementById('performance-chart-container').classList.add('hidden');
    document.getElementById('performance-table-container').classList.remove('hidden');
  });

  // Holdings search input
  document.getElementById('holding-search-input')?.addEventListener('input', () => {
    loadHoldingsAndAllocation();
  });

  // Sync Button
  document.getElementById('btn-sync-now')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-now');
    const badge = document.getElementById('sync-status-badge');
    const statusText = document.getElementById('sync-status-text');
    if (badge) badge.className = 'status-badge syncing';
    if (statusText) statusText.textContent = 'Syncing Plaid API...';
    if (btn) btn.disabled = true;

    try {
      const res = await apiFetch('/plaid/sync', { method: 'POST' });
      if (statusText) statusText.textContent = 'Sync Complete';
      await refreshAllData();
    } catch (err) {
      if (statusText) statusText.textContent = 'Sync Failed';
      alert(`Sync failed: ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
      if (badge && statusText) {
        setTimeout(() => {
          badge.className = 'status-badge pulse-ready';
          statusText.textContent = 'System Ready';
        }, 2000);
      }
    }
  });

  // Seed Demo Portfolio Button
  document.getElementById('btn-seed-demo')?.addEventListener('click', async () => {
    if (confirm('Load realistic 5-year sample investment portfolio, IRAs, real estate, mortgage, and emergency savings?')) {
      try {
        await apiFetch('/seed/demo-portfolio', { method: 'POST' });
        alert('Demo portfolio loaded successfully!');
        await refreshAllData();
      } catch (err) {
        alert(`Error seeding demo: ${err.message}`);
      }
    }
  });

  // Auth Modal Submission
  document.getElementById('form-auth')?.addEventListener('submit', async e => {
    e.preventDefault();
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value;
    const errBanner = document.getElementById('auth-error-msg');
    errBanner.classList.add('hidden');

    const endpoint = state.isAuthRegisterMode ? '/auth/register' : '/auth/login';

    try {
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username: u, password: p })
      });

      state.token = data.access_token;
      localStorage.setItem('invest_token', state.token);
      hideAuthModal();
      state.user = await apiFetch('/auth/me');
      updateUserDisplay();
      await refreshAllData();
    } catch (err) {
      errBanner.textContent = err.message || 'Authentication failed';
      errBanner.classList.remove('hidden');
    }
  });

  // Toggle Login / Register
  document.getElementById('btn-toggle-auth-mode')?.addEventListener('click', () => {
    state.isAuthRegisterMode = !state.isAuthRegisterMode;
    const title = document.getElementById('auth-modal-title');
    const submitBtn = document.getElementById('btn-auth-submit');
    const togglePrompt = document.getElementById('auth-toggle-prompt');
    const toggleBtn = document.getElementById('btn-toggle-auth-mode');

    if (state.isAuthRegisterMode) {
      title.textContent = 'Create New Account';
      submitBtn.textContent = 'Register Account';
      togglePrompt.textContent = 'Already have an account?';
      toggleBtn.textContent = 'Sign In';
    } else {
      title.textContent = 'Sign In to InvestTracker';
      submitBtn.textContent = 'Sign In';
      togglePrompt.textContent = "Don't have an account?";
      toggleBtn.textContent = 'Create Account';
    }
  });

  // User Menu Dropdown & Actions
  const userMenuBtn = document.getElementById('user-menu-btn');
  const userDropdown = document.getElementById('user-dropdown-menu');

  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', e => {
      e.stopPropagation();
      userDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', e => {
      if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.classList.add('hidden');
      }
    });
  }

  // Open Database & Backup Modal from user dropdown
  document.getElementById('menu-btn-database')?.addEventListener('click', () => {
    userDropdown?.classList.add('hidden');
    document.getElementById('modal-database-backup')?.classList.remove('hidden');
  });

  // Logout from user dropdown
  document.getElementById('menu-btn-logout')?.addEventListener('click', () => {
    userDropdown?.classList.add('hidden');
    state.token = null;
    state.user = null;
    localStorage.removeItem('invest_token');
    showAuthModal();
  });

  // Unified Add Account Modal Opener
  document.getElementById('btn-sidebar-add-account')?.addEventListener('click', () => openAddAccountModal('plaid'));

  // 3-Mode Switcher inside Add Account Modal
  const btnPlaidTab = document.getElementById('tab-btn-add-plaid');
  const btnAssetTab = document.getElementById('tab-btn-add-asset');
  const btnLoanTab = document.getElementById('tab-btn-add-loan');
  const secPlaid = document.getElementById('section-add-plaid');
  const secAsset = document.getElementById('section-add-asset');
  const secLoan = document.getElementById('section-add-loan');

  const switchAddMode = (mode) => {
    btnPlaidTab?.classList.toggle('active', mode === 'plaid');
    btnAssetTab?.classList.toggle('active', mode === 'asset');
    btnLoanTab?.classList.toggle('active', mode === 'loan');

    secPlaid?.classList.toggle('hidden', mode !== 'plaid');
    secAsset?.classList.toggle('hidden', mode !== 'asset');
    secLoan?.classList.toggle('hidden', mode !== 'loan');
  };

  btnPlaidTab?.addEventListener('click', () => switchAddMode('plaid'));
  btnAssetTab?.addEventListener('click', () => switchAddMode('asset'));
  btnLoanTab?.addEventListener('click', () => switchAddMode('loan'));

  // Toggle real estate address/purchase price fields based on Asset Type or Category
  const assetTypeSelect = document.getElementById('asset-type');
  const assetCategorySelect = document.getElementById('asset-category');
  const assetReFields = document.getElementById('asset-realestate-fields');

  const updateAssetFieldsVisibility = () => {
    const isRE = (assetTypeSelect?.value === 'real_estate' || assetCategorySelect?.value === 'Real Estate');
    if (assetReFields) {
      assetReFields.classList.toggle('hidden', !isRE);
    }
  };

  assetTypeSelect?.addEventListener('change', () => {
    if (assetTypeSelect.value === 'real_estate' && assetCategorySelect) {
      assetCategorySelect.value = 'Real Estate';
    }
    updateAssetFieldsVisibility();
  });

  assetCategorySelect?.addEventListener('change', () => {
    updateAssetFieldsVisibility();
  });

  // Plaid Flow inside Add Account Modal
  document.getElementById('btn-start-plaid-flow')?.addEventListener('click', async () => {
    try {
      const linkRes = await apiFetch('/plaid/link-token', { method: 'POST' });
      const instName = prompt('Enter Bank / Brokerage Name (e.g. Schwab, Vanguard, Fidelity, Chase):', 'Charles Schwab');
      if (instName) {
        await apiFetch('/plaid/exchange-token', {
          method: 'POST',
          body: JSON.stringify({
            public_token: `public-sandbox-${Date.now()}`,
            institution_name: instName
          })
        });
        alert(`${instName} connected successfully!`);
        document.getElementById('modal-add-account').classList.add('hidden');
        await refreshAllData();
      }
    } catch (err) {
      alert(`Plaid connection error: ${err.message}`);
    }
  });

  // Close modals on close button or backdrop click
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach(m => {
        if (m.id !== 'modal-auth' || state.token) {
          m.classList.add('hidden');
        }
      });
    });
  });

  // 1. Manual Asset Form Submission
  document.getElementById('form-add-asset')?.addEventListener('submit', async e => {
    e.preventDefault();
    const typeVal = document.getElementById('asset-type').value;
    const catVal = document.getElementById('asset-category').value;
    const isRE = (typeVal === 'real_estate' || catVal === 'Real Estate');

    const payload = {
      name: document.getElementById('asset-name').value,
      account_class: 'asset',
      type: typeVal,
      subtype: typeVal === 'real_estate' ? 'property' : (typeVal === 'depository' ? 'savings' : 'investment'),
      category_group: catVal,
      initial_balance: parseFloat(document.getElementById('asset-balance').value) || 0,
      target_annual_return_rate: parseFloat(document.getElementById('asset-target-rate').value) || 4.0,
      linked_asset_id: null,
      manual_detail: isRE ? {
        property_address: document.getElementById('asset-address')?.value || null,
        purchase_price: parseFloat(document.getElementById('asset-purchase-price')?.value) || null
      } : null
    };

    try {
      await apiFetch('/accounts/manual', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      document.getElementById('modal-add-account').classList.add('hidden');
      document.getElementById('form-add-asset').reset();
      await refreshAllData();
    } catch (err) {
      alert(`Error creating asset account: ${err.message}`);
    }
  });

  // 2. Manual Loan Form Submission
  document.getElementById('form-add-loan')?.addEventListener('submit', async e => {
    e.preventDefault();
    const loanTypeVal = document.getElementById('loan-type').value;
    const linkedAsset = document.getElementById('loan-linked-asset').value || null;

    const payload = {
      name: document.getElementById('loan-name').value,
      account_class: 'liability',
      type: 'loan',
      subtype: loanTypeVal,
      category_group: 'Debt', // mapped to Mortgages & Debt
      initial_balance: parseFloat(document.getElementById('loan-balance').value) || 0,
      target_annual_return_rate: 0.0,
      linked_asset_id: linkedAsset,
      manual_detail: {
        interest_rate: parseFloat(document.getElementById('loan-interest-rate')?.value) || null,
        original_loan_amount: parseFloat(document.getElementById('loan-original-amount')?.value) || null,
        monthly_payment: parseFloat(document.getElementById('loan-monthly-payment')?.value) || null
      }
    };

    try {
      await apiFetch('/accounts/manual', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      document.getElementById('modal-add-account').classList.add('hidden');
      document.getElementById('form-add-loan').reset();
      await refreshAllData();
    } catch (err) {
      alert(`Error creating loan account: ${err.message}`);
    }
  });

  // Valuation Log Form
  document.getElementById('form-log-valuation')?.addEventListener('submit', async e => {
    e.preventDefault();
    const accId = document.getElementById('valuation-account-id').value;
    const newBal = parseFloat(document.getElementById('valuation-new-balance').value);
    const note = document.getElementById('valuation-note').value;

    try {
      await apiFetch('/accounts/valuations', {
        method: 'POST',
        body: JSON.stringify({
          account_id: accId,
          new_balance: newBal,
          note
        })
      });
      document.getElementById('modal-log-valuation').classList.add('hidden');
      await refreshAllData();
    } catch (err) {
      alert(`Error logging update: ${err.message}`);
    }
  });

  // Edit Account Form
  document.getElementById('form-edit-account')?.addEventListener('submit', async e => {
    e.preventDefault();
    const accId = document.getElementById('edit-account-id').value;
    const name = document.getElementById('edit-account-name').value;
    const cat = document.getElementById('edit-account-category').value;
    const targetRate = parseFloat(document.getElementById('edit-account-target').value);
    const linkedAsset = document.getElementById('edit-account-linked-asset').value;

    try {
      await apiFetch(`/accounts/${accId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          category_group: cat,
          target_annual_return_rate: targetRate,
          linked_asset_id: linkedAsset || ''
        })
      });
      document.getElementById('modal-edit-account').classList.add('hidden');
      await refreshAllData();
    } catch (err) {
      alert(`Error updating account: ${err.message}`);
    }
  });

  // Download Backup
  document.getElementById('btn-download-backup')?.addEventListener('click', async () => {
    try {
      const blob = await apiFetch('/backup/download');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invest_backup_${new Date().toISOString().slice(0, 10)}.sqlite`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert(`Backup download failed: ${err.message}`);
    }
  });

  // Restore Backup
  document.getElementById('form-restore-backup')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fileInput = document.getElementById('backup-file-input');
    if (!fileInput.files[0]) return;

    if (confirm('Are you sure you want to restore this database? Current data will be replaced.')) {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);

      try {
        const res = await apiFetch('/backup/restore', {
          method: 'POST',
          body: formData
        });
        alert(res.message);
        window.location.reload();
      } catch (err) {
        alert(`Restore failed: ${err.message}`);
      }
    }
  });
}

// =========================================================================
// Modal Helpers (Accessible from window)
// =========================================================================
window.openAddAccountModal = function(initialMode = 'plaid', defaultAssetType = 'real_estate') {
  const modal = document.getElementById('modal-add-account');
  const btnPlaid = document.getElementById('tab-btn-add-plaid');
  const btnAsset = document.getElementById('tab-btn-add-asset');
  const btnLoan = document.getElementById('tab-btn-add-loan');
  const secPlaid = document.getElementById('section-add-plaid');
  const secAsset = document.getElementById('section-add-asset');
  const secLoan = document.getElementById('section-add-loan');

  btnPlaid?.classList.toggle('active', initialMode === 'plaid');
  btnAsset?.classList.toggle('active', initialMode === 'asset' || initialMode === 'manual');
  btnLoan?.classList.toggle('active', initialMode === 'loan');

  secPlaid?.classList.toggle('hidden', initialMode !== 'plaid');
  secAsset?.classList.toggle('hidden', initialMode !== 'asset' && initialMode !== 'manual');
  secLoan?.classList.toggle('hidden', initialMode !== 'loan');

  if (initialMode === 'asset' || initialMode === 'manual') {
    const typeSelect = document.getElementById('asset-type');
    const catSelect = document.getElementById('asset-category');
    if (typeSelect) typeSelect.value = defaultAssetType;

    if (defaultAssetType === 'real_estate' && catSelect) {
      catSelect.value = 'Real Estate';
      document.getElementById('asset-realestate-fields')?.classList.remove('hidden');
    } else {
      document.getElementById('asset-realestate-fields')?.classList.add('hidden');
    }
  }

  populateLinkedAssetDropdowns();
  modal.classList.remove('hidden');
};

window.openValuationModal = function(accountId, currentBalance, title = 'Update Valuation') {
  document.getElementById('valuation-account-id').value = accountId;
  document.getElementById('valuation-new-balance').value = currentBalance;
  document.getElementById('valuation-modal-title').textContent = title;
  document.getElementById('modal-log-valuation').classList.remove('hidden');
};

window.openEditAccountModal = function(accountId) {
  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc) return;

  document.getElementById('edit-account-id').value = acc.id;
  document.getElementById('edit-account-name').value = acc.name;
  document.getElementById('edit-account-category').value = acc.category_group;
  document.getElementById('edit-account-target').value = acc.target_annual_return_rate || 7.0;
  document.getElementById('edit-account-linked-asset').value = acc.linked_asset_id || '';

  document.getElementById('modal-edit-account').classList.remove('hidden');
};

// =========================================================================
// Utilities
// =========================================================================
function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Start application
document.addEventListener('DOMContentLoaded', initApp);
