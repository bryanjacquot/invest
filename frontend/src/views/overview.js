/**
 * Overview View Module (/overview)
 */
import { apiFetch } from '../api.js';
import { state } from '../state.js';
import { router } from '../router.js';
import { formatCurrency, formatPercent } from '../utils/formatters.js';

export default {
  async mount(container, params) {
    container.innerHTML = `
      <section id="tab-overview" class="tab-content active">
        <!-- Account Filter Panels KPI Grid -->
        <section class="kpi-grid">
          <!-- 1. All Accounts (Blended) -->
          <div class="kpi-card glass-card card-glow-primary interactive-card" id="card-kpi-all" title="View blended portfolio performance">
            <div class="kpi-header">
              <span class="kpi-label">All Accounts (Blended)</span>
              <span class="badge-icon-emoji">🌟</span>
            </div>
            <div class="kpi-value" id="kpi-all-accounts">$0.00</div>
            <div class="kpi-footer">
              <span id="kpi-nw-1y" class="kpi-change positive">+0.0% (1Y)</span>
              <span class="kpi-subtext">Total Net Worth</span>
            </div>
          </div>

          <!-- 2. Retirement -->
          <div class="kpi-card glass-card interactive-card" id="card-kpi-ret" title="View retirement accounts">
            <div class="kpi-header">
              <span class="kpi-label">Retirement</span>
              <span class="badge-icon-emoji">🛡️</span>
            </div>
            <div class="kpi-value" id="kpi-retirement">$0.00</div>
            <div class="kpi-footer">
              <span id="kpi-count-retirement" class="kpi-subtext">0 accounts</span>
            </div>
          </div>

          <!-- 3. Taxable Brokerage -->
          <div class="kpi-card glass-card interactive-card" id="card-kpi-tax" title="View taxable brokerage accounts">
            <div class="kpi-header">
              <span class="kpi-label">Taxable Brokerage</span>
              <span class="badge-icon-emoji">📈</span>
            </div>
            <div class="kpi-value" id="kpi-taxable-brokerage">$0.00</div>
            <div class="kpi-footer">
              <span id="kpi-count-taxable-brokerage" class="kpi-subtext">0 accounts</span>
            </div>
          </div>

          <!-- 4. IRAs -->
          <div class="kpi-card glass-card interactive-card" id="card-kpi-ira" title="View IRA accounts">
            <div class="kpi-header">
              <span class="kpi-label">IRAs</span>
              <span class="badge-icon-emoji">🪙</span>
            </div>
            <div class="kpi-value" id="kpi-iras">$0.00</div>
            <div class="kpi-footer">
              <span id="kpi-count-iras" class="kpi-subtext">0 accounts</span>
            </div>
          </div>

          <!-- 5. Emergency Savings -->
          <div class="kpi-card glass-card interactive-card" id="card-kpi-emg" title="View emergency savings">
            <div class="kpi-header">
              <span class="kpi-label">Emergency Savings</span>
              <span class="badge-icon-emoji">🚨</span>
            </div>
            <div class="kpi-value" id="kpi-emergency-savings">$0.00</div>
            <div class="kpi-footer">
              <span class="kpi-subtext">Liquid cash reserve</span>
            </div>
          </div>

          <!-- 6. Real Estate -->
          <div class="kpi-card glass-card interactive-card" id="card-kpi-re" title="View real estate & properties">
            <div class="kpi-header">
              <span class="kpi-label">Real Estate</span>
              <span class="badge-icon-emoji">🏡</span>
            </div>
            <div class="kpi-value" id="kpi-real-estate">$0.00</div>
            <div class="kpi-footer">
              <span id="kpi-re-equity" class="kpi-change neutral">Equity: $0.00</span>
            </div>
          </div>

          <!-- 7. Mortgages -->
          <div class="kpi-card glass-card interactive-card" id="card-kpi-mort" title="View mortgages & debt">
            <div class="kpi-header">
              <span class="kpi-label">Mortgages</span>
              <span class="badge-icon-emoji">💳</span>
            </div>
            <div class="kpi-value" id="kpi-mortgages">$0.00</div>
            <div class="kpi-footer">
              <span class="kpi-subtext">Mortgages & loans</span>
            </div>
          </div>
        </section>

        <!-- Capital Structure Summary Card -->
        <div class="overview-detail-section">
          <div class="overview-detail-card glass-card">
            <div class="overview-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span>Portfolio Balance & Capital Structure</span>
            </div>
            <div class="overview-stats-list">
              <div class="overview-stat-row">
                <span class="overview-stat-label">
                  <span class="legend-dot" style="background:#10b981;"></span>
                  Total Gross Assets
                </span>
                <span id="overview-total-assets" class="overview-stat-val">$0.00</span>
              </div>
              <div class="overview-stat-row">
                <span class="overview-stat-label">
                  <span class="legend-dot" style="background:#ef4444;"></span>
                  Total Liabilities & Mortgages
                </span>
                <span id="overview-total-liabilities" class="overview-stat-val">$0.00</span>
              </div>
              <div class="overview-stat-row">
                <span class="overview-stat-label">
                  <span class="legend-dot" style="background:#3b82f6;"></span>
                  Equity-to-Asset Ratio
                </span>
                <span id="overview-equity-ratio" class="overview-stat-val">100.0%</span>
              </div>
              <div class="overview-stat-row">
                <span class="overview-stat-label">
                  <span class="legend-dot" style="background:#f59e0b;"></span>
                  Debt-to-Asset Ratio
                </span>
                <span id="overview-debt-ratio" class="overview-stat-val">0.0%</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    // Attach card navigation handlers
    document.getElementById('card-kpi-all')?.addEventListener('click', () => router.navigate('/performance'));
    document.getElementById('card-kpi-ret')?.addEventListener('click', () => router.navigate('/performance?categories=Retirement'));
    document.getElementById('card-kpi-tax')?.addEventListener('click', () => router.navigate('/performance?categories=Taxable%20Brokerage'));
    document.getElementById('card-kpi-ira')?.addEventListener('click', () => router.navigate('/performance?categories=IRAs'));
    document.getElementById('card-kpi-emg')?.addEventListener('click', () => router.navigate('/performance?categories=Emergency%20Savings'));
    document.getElementById('card-kpi-re')?.addEventListener('click', () => router.navigate('/real-estate'));
    document.getElementById('card-kpi-mort')?.addEventListener('click', () => router.navigate('/performance?categories=Debt'));

    // Load metrics
    await this.loadMetrics();
  },

  async loadMetrics() {
    try {
      const [data, properties] = await Promise.all([
        apiFetch('/analytics/net-worth'),
        apiFetch('/accounts/real-estate-equity').catch(() => [])
      ]);

      // Calculate category metrics from state.accounts
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

      const netWorthVal = data.total_net_worth || 0;
      const retirementVal = retCount > 0 ? retBal : (data.total_retirement || 0);
      const taxableVal = taxCount > 0 ? taxBal : (data.total_taxable_brokerage || 0);
      const iraVal = iraCount > 0 ? iraBal : (data.total_iras || 0);
      const emergencyVal = emgCount > 0 ? emgBal : (data.total_emergency_savings || 0);
      const realEstateVal = reCount > 0 ? reBal : (data.total_real_estate_assets || 0);
      const mortgageVal = mortCount > 0 ? mortBal : (data.total_mortgages || data.total_liabilities || 0);

      // Render 7 KPI cards
      const elAll = document.getElementById('kpi-all-accounts');
      if (elAll) elAll.textContent = formatCurrency(netWorthVal);

      const elRet = document.getElementById('kpi-retirement');
      if (elRet) elRet.textContent = formatCurrency(retirementVal);
      const elRetCount = document.getElementById('kpi-count-retirement');
      if (elRetCount) elRetCount.textContent = `${retCount} ${retCount === 1 ? 'account' : 'accounts'}`;

      const elTax = document.getElementById('kpi-taxable-brokerage');
      if (elTax) elTax.textContent = formatCurrency(taxableVal);
      const elTaxCount = document.getElementById('kpi-count-taxable-brokerage');
      if (elTaxCount) elTaxCount.textContent = `${taxCount} ${taxCount === 1 ? 'account' : 'accounts'}`;

      const elIra = document.getElementById('kpi-iras');
      if (elIra) elIra.textContent = formatCurrency(iraVal);
      const elIraCount = document.getElementById('kpi-count-iras');
      if (elIraCount) elIraCount.textContent = `${iraCount} ${iraCount === 1 ? 'account' : 'accounts'}`;

      const elEmg = document.getElementById('kpi-emergency-savings');
      if (elEmg) elEmg.textContent = formatCurrency(emergencyVal);

      const elRe = document.getElementById('kpi-real-estate');
      if (elRe) elRe.textContent = formatCurrency(realEstateVal);

      const elMort = document.getElementById('kpi-mortgages');
      if (elMort) elMort.textContent = formatCurrency(mortgageVal);

      // 1Y Trailing Change
      const nw1y = document.getElementById('kpi-nw-1y');
      if (nw1y && data.change_1y_pct !== undefined) {
        nw1y.textContent = `${data.change_1y_pct >= 0 ? '+' : ''}${data.change_1y_pct.toFixed(1)}% (1Y)`;
        nw1y.className = `kpi-change ${data.change_1y_pct >= 0 ? 'positive' : 'negative'}`;
      }

      // Real Estate Net Equity
      let totalPropVal = 0, totalMortVal = 0;
      if (properties && properties.length > 0) {
        properties.forEach(p => {
          totalPropVal += (p.market_value || 0);
          totalMortVal += (p.mortgage_balance || 0);
        });
      }
      const totalEquity = Math.max(0, totalPropVal - totalMortVal);
      const eqEl = document.getElementById('kpi-re-equity');
      if (eqEl) eqEl.textContent = `Equity: ${formatCurrency(totalEquity)}`;

      // Capital structure
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
    } catch (err) {
      console.error('Error loading overview metrics:', err);
    }
  },

  unmount() {}
};
