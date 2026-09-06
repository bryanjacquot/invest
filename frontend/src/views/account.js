/**
 * Account Detail & Settings View Module (/account?id=<uuid>)
 */
import { apiFetch } from '../api.js';
import { state } from '../state.js';
import { router } from '../router.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { escapeHtml } from '../utils/dom.js';

export default {
  accountId: null,
  accountData: null,
  chart: null,

  async mount(container, params) {
    this.accountId = params.get('id');

    if (!this.accountId) {
      this.renderAccountsDirectory(container);
      return;
    }

    await this.renderAccountDetail(container, this.accountId);
  },

  renderAccountsDirectory(container) {
    const accounts = state.accounts || [];
    container.innerHTML = `
      <section class="account-view-container">
        <div class="view-header-bar glass-card">
          <div>
            <h2>Accounts Directory</h2>
            <p class="subtext">Select an individual account to view performance, edit target return rates, or log balance updates.</p>
          </div>
          <button class="btn btn-primary" onclick="window.dispatchEvent(new CustomEvent('invest:open-add-account'))">
            + Add Account
          </button>
        </div>

        <div class="cards-grid" style="margin-top: 1.5rem;">
          ${accounts.map(a => `
            <div class="glass-card property-card interactive-card" onclick="window.dispatchEvent(new CustomEvent('invest:navigate-account', { detail: { accountId: '${a.id}' } }))">
              <div class="property-card-header">
                <div>
                  <div class="property-title">${escapeHtml(a.name)}</div>
                  <div class="property-address">${escapeHtml(a.institution_name || 'Manual')} • <span class="badge-pill moderate">${escapeHtml(a.category_group)}</span></div>
                </div>
                <div style="font-size: 1.1rem; font-weight: 700; color: ${a.account_class === 'liability' ? 'var(--accent-red)' : 'var(--accent-green)'};">
                  ${formatCurrency(a.current_balance)}
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-top: 0.75rem; color: var(--text-muted);">
                <span>Target Rate: <strong>+${(a.target_annual_return_rate || 7.0).toFixed(1)}%</strong></span>
                <span>Type: ${escapeHtml(a.subtype || a.type)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  },

  async renderAccountDetail(container, accountId) {
    const account = (state.accounts || []).find(a => a.id === accountId);
    if (!account) {
      container.innerHTML = `
        <div class="glass-card" style="text-align: center; padding: 3rem;">
          <h3>Account Not Found</h3>
          <p class="subtext">The requested account could not be located in your portfolio.</p>
          <button class="btn btn-secondary" style="margin-top: 1rem;" onclick="window.dispatchEvent(new CustomEvent('invest:navigate-overview'))">
            ← Back to Overview
          </button>
        </div>
      `;
      return;
    }

    this.accountData = account;

    container.innerHTML = `
      <section class="account-detail-container">
        <!-- Account Header Card -->
        <div class="glass-card" style="padding: 1.5rem; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <h2 style="margin: 0;">${escapeHtml(account.name)}</h2>
              <span class="badge-pill moderate">${escapeHtml(account.category_group)}</span>
            </div>
            <div style="margin-top: 0.5rem; color: var(--text-muted); font-size: 0.9rem;">
              <span>Institution: <strong>${escapeHtml(account.institution_name || 'Manual')}</strong></span>
              <span style="margin: 0 0.5rem;">•</span>
              <span>Source: <strong>${escapeHtml(account.source_type.toUpperCase())}</strong></span>
              <span style="margin: 0 0.5rem;">•</span>
              <span>Subtype: <strong>${escapeHtml(account.subtype || account.type)}</strong></span>
            </div>
          </div>

          <div style="text-align: right;">
            <div style="font-size: 0.85rem; color: var(--text-dim); text-transform: uppercase;">Current Balance</div>
            <div style="font-size: 1.75rem; font-weight: 800; color: ${account.account_class === 'liability' ? 'var(--accent-red)' : 'var(--accent-green)'};">
              ${formatCurrency(account.current_balance)}
            </div>
            <div style="margin-top: 0.5rem;">
              <button class="btn btn-sm btn-primary" id="btn-log-valuation">
                + Log Valuation / Payment
              </button>
            </div>
          </div>
        </div>

        <!-- Account Configuration & Target Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
          <!-- Target & Category Settings Card -->
          <div class="glass-card" style="padding: 1.5rem;">
            <h3>Target Return & Category Settings</h3>
            <form id="form-account-settings" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 1rem;">
              <div class="form-group">
                <label class="form-label">Account Name</label>
                <input type="text" id="acc-edit-name" class="form-input" value="${escapeHtml(account.name)}" required>
              </div>

              <div class="form-group">
                <label class="form-label">Category Group</label>
                <select id="acc-edit-category" class="form-select">
                  <option value="Retirement" ${account.category_group === 'Retirement' ? 'selected' : ''}>🛡️ Retirement (401k, 403b)</option>
                  <option value="Taxable Brokerage" ${account.category_group === 'Taxable Brokerage' ? 'selected' : ''}>📈 Taxable Brokerage</option>
                  <option value="IRAs" ${account.category_group === 'IRAs' ? 'selected' : ''}>🪙 IRAs (Traditional, Roth)</option>
                  <option value="Emergency Savings" ${account.category_group === 'Emergency Savings' ? 'selected' : ''}>🚨 Emergency Savings</option>
                  <option value="Real Estate" ${account.category_group === 'Real Estate' ? 'selected' : ''}>🏡 Real Estate</option>
                  <option value="Debt" ${account.category_group === 'Debt' || account.category_group === 'Mortgages' ? 'selected' : ''}>💳 Mortgages & Debt</option>
                  <option value="Other" ${account.category_group === 'Other' ? 'selected' : ''}>📁 Other</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Target Annual Growth Rate (% APR)</label>
                <input type="number" id="acc-edit-target" class="form-input" step="0.1" value="${account.target_annual_return_rate || 7.0}" required>
                <span class="subtext">Used to project compounded target curves vs actual performance.</span>
              </div>

              <div id="acc-save-success" class="badge-pill green hidden" style="text-align: center;">Settings Saved Successfully!</div>

              <button type="submit" class="btn btn-primary" style="margin-top: 0.5rem;">Save Settings</button>
            </form>
          </div>

          <!-- Account Meta & Details -->
          <div class="glass-card" style="padding: 1.5rem;">
            <h3>Account Specifications</h3>
            <div class="overview-stats-list" style="margin-top: 1rem;">
              <div class="overview-stat-row">
                <span class="overview-stat-label">Account ID</span>
                <span class="overview-stat-val" style="font-family: monospace; font-size: 0.8rem;">${account.id}</span>
              </div>
              <div class="overview-stat-row">
                <span class="overview-stat-label">Account Class</span>
                <span class="overview-stat-val">${account.account_class.toUpperCase()}</span>
              </div>
              <div class="overview-stat-row">
                <span class="overview-stat-label">Currency</span>
                <span class="overview-stat-val">${account.currency}</span>
              </div>
              <div class="overview-stat-row">
                <span class="overview-stat-label">Created Date</span>
                <span class="overview-stat-val">${formatDate(account.created_at)}</span>
              </div>
              ${account.linked_asset_name ? `
                <div class="overview-stat-row">
                  <span class="overview-stat-label">Linked Collateral Asset</span>
                  <span class="overview-stat-val" style="color: var(--accent-blue); font-weight: 600;">${escapeHtml(account.linked_asset_name)}</span>
                </div>
              ` : ''}
              ${account.manual_detail?.interest_rate ? `
                <div class="overview-stat-row">
                  <span class="overview-stat-label">Loan Interest Rate</span>
                  <span class="overview-stat-val">${account.manual_detail.interest_rate}%</span>
                </div>
              ` : ''}
              ${account.manual_detail?.monthly_payment ? `
                <div class="overview-stat-row">
                  <span class="overview-stat-label">Monthly Payment</span>
                  <span class="overview-stat-val">${formatCurrency(account.manual_detail.monthly_payment)}</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </section>
    `;

    this.bindDetailEvents(account);
  },

  bindDetailEvents(account) {
    document.getElementById('btn-log-valuation')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('invest:open-valuation-modal', {
        detail: {
          accountId: account.id,
          currentValue: account.current_balance,
          title: account.account_class === 'liability' ? 'Mortgage / Loan Payment' : 'Valuation Update'
        }
      }));
    });

    // Form settings submit
    document.getElementById('form-account-settings')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newName = document.getElementById('acc-edit-name').value.trim();
      const newCat = document.getElementById('acc-edit-category').value;
      const newTarget = parseFloat(document.getElementById('acc-edit-target').value);

      try {
        await apiFetch(`/accounts/${account.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: newName,
            category_group: newCat,
            target_annual_return_rate: newTarget
          })
        });

        const successPill = document.getElementById('acc-save-success');
        if (successPill) {
          successPill.classList.remove('hidden');
          setTimeout(() => successPill.classList.add('hidden'), 3000);
        }

        // Refresh state accounts
        window.dispatchEvent(new CustomEvent('invest:refresh-accounts'));
      } catch (err) {
        alert(`Failed to save account settings: ${err.message}`);
      }
    });
  },

  unmount() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
};
