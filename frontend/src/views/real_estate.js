/**
 * Real Estate & Loans View Module (/real-estate)
 */
import { apiFetch } from '../api.js';
import { formatCurrency, formatPercent } from '../utils/formatters.js';
import { escapeHtml } from '../utils/dom.js';

export default {
  async mount(container, params) {
    container.innerHTML = `
      <section id="view-realestate-root" class="tab-content active">
        <div class="view-header-bar glass-card">
          <div>
            <h2>Real Estate & Collateralized Debt</h2>
            <p class="subtext">Track physical properties, market valuations, attached mortgages, and net equity.</p>
          </div>
          <button class="btn btn-primary" onclick="window.dispatchEvent(new CustomEvent('invest:open-add-account', { detail: { tab: 'manual' } }))">
            + Add Property / Loan
          </button>
        </div>

        <div id="real-estate-cards-container" class="cards-grid" style="margin-top: 1.5rem;">
          <div class="glass-card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
            <h3>Loading Real Estate Portfolios...</h3>
          </div>
        </div>
      </section>
    `;

    await this.loadProperties();
  },

  async loadProperties() {
    const container = document.getElementById('real-estate-cards-container');
    if (!container) return;

    try {
      const properties = await apiFetch('/accounts/real-estate-equity');

      if (!properties || properties.length === 0) {
        container.innerHTML = `
          <div class="glass-card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
            <h3>No Real Estate Properties Tracked Yet</h3>
            <p class="subtext" style="margin: 0.75rem 0 0;">Add your primary residence, rental units, or land using the <strong>+ Add Property / Loan</strong> button above.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = properties.map(p => `
        <div class="glass-card property-card">
          <div class="property-card-header">
            <div>
              <div class="property-title">🏡 ${escapeHtml(p.property_name)}</div>
              <div class="property-address">${escapeHtml(p.property_address || 'Real Estate Asset')}</div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="window.dispatchEvent(new CustomEvent('invest:open-valuation-modal', { detail: { accountId: '${p.property_account_id}', currentValue: ${p.market_value}, title: 'Property Valuation Update' } }))">
              Update Value
            </button>
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
              <button class="btn btn-sm btn-secondary" onclick="window.dispatchEvent(new CustomEvent('invest:open-valuation-modal', { detail: { accountId: '${p.mortgage_account_id}', currentValue: ${p.mortgage_balance}, title: 'Mortgage Balance Paydown' } }))">
                Log Loan Payment
              </button>
            </div>
          ` : ''}
        </div>
      `).join('');
    } catch (err) {
      console.error('Error loading real estate equity:', err);
      container.innerHTML = `
        <div class="glass-card" style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--accent-red);">
          Failed to load real estate properties: ${escapeHtml(err.message)}
        </div>
      `;
    }
  },

  unmount() {}
};
