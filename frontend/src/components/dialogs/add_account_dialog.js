/**
 * Add Account Dialog Component (3-Tabs: Plaid, Manual Asset, Debt)
 */
import { state } from '../../state.js';
import { apiFetch } from '../../api.js';
import { formatCurrency } from '../../utils/formatters.js';

export const MANUAL_ACCOUNT_TYPES = {
  // TAXABLE
  'Checking': { type: 'TAXABLE', subtype: 'Checking', category_group: 'Emergency Savings', defaultTarget: 1.0 },
  'Investment': { type: 'TAXABLE', subtype: 'Investment', category_group: 'Taxable Brokerage', defaultTarget: 8.0 },
  'Savings': { type: 'TAXABLE', subtype: 'Savings', category_group: 'Emergency Savings', defaultTarget: 4.0 },

  // TAX-DEFERRED
  '401(k)': { type: 'TAX-DEFERRED', subtype: '401(k)', category_group: 'Retirement', defaultTarget: 7.0 },
  '403(b)': { type: 'TAX-DEFERRED', subtype: '403(b)', category_group: 'Retirement', defaultTarget: 7.0 },
  '457(b)': { type: 'TAX-DEFERRED', subtype: '457(b)', category_group: 'Retirement', defaultTarget: 7.0 },
  'IRA': { type: 'TAX-DEFERRED', subtype: 'IRA', category_group: 'IRAs', defaultTarget: 7.0 },
  'IRA (Inherited)': { type: 'TAX-DEFERRED', subtype: 'IRA (Inherited)', category_group: 'IRAs', defaultTarget: 7.0 },
  'Other PreTax': { type: 'TAX-DEFERRED', subtype: 'Other PreTax', category_group: 'Retirement', defaultTarget: 7.0 },

  // TAX-FREE
  '529': { type: 'TAX-FREE', subtype: '529', category_group: 'Other', defaultTarget: 6.0 },
  'HSA': { type: 'TAX-FREE', subtype: 'HSA', category_group: 'Other', defaultTarget: 5.0 },
  'Roth 401(k)': { type: 'TAX-FREE', subtype: 'Roth 401(k)', category_group: 'Retirement', defaultTarget: 7.0 },
  'Roth 403(b)': { type: 'TAX-FREE', subtype: 'Roth 403(b)', category_group: 'Retirement', defaultTarget: 7.0 },
  'Roth 457(b)': { type: 'TAX-FREE', subtype: 'Roth 457(b)', category_group: 'Retirement', defaultTarget: 7.0 },
  'Roth IRA': { type: 'TAX-FREE', subtype: 'Roth IRA', category_group: 'IRAs', defaultTarget: 7.0 },
  'Roth IRA (Inherited)': { type: 'TAX-FREE', subtype: 'Roth IRA (Inherited)', category_group: 'IRAs', defaultTarget: 7.0 },

  // REAL-ESTATE, OTHER
  'Real Estate / Property': { type: 'REAL-ESTATE, OTHER', subtype: 'Real Estate / Property', category_group: 'Real Estate', defaultTarget: 4.0 },
  'Other Asset': { type: 'REAL-ESTATE, OTHER', subtype: 'Other Asset', category_group: 'Other', defaultTarget: 5.0 },

  // DEBT
  'Mortgage': { type: 'DEBT', subtype: 'Mortgage', category_group: 'Debt', defaultTarget: 0.0 },
  'Other': { type: 'DEBT', subtype: 'Other', category_group: 'Debt', defaultTarget: 0.0 }
};

export function getAddAccountDialogHtml() {
  return `
    <!-- UNIFIED ADD ACCOUNT MODAL -->
    <div id="modal-add-account" class="modal-backdrop hidden">
      <div class="modal-card glass-modal" style="max-width: 620px;">
        <div class="modal-header">
          <div>
            <h2>Add New Account</h2>
          </div>
          <button type="button" class="btn-close modal-close-btn">&times;</button>
        </div>

        <!-- 3-Mode Sub-Navigation Tabs Component -->
        <nav class="modal-tabs" id="add-account-modal-tabs">
          <button type="button" class="tab-btn active" data-tab="plaid">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <span>Using Plaid</span>
          </button>
          <button type="button" class="tab-btn" data-tab="manual">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <span>Manually</span>
          </button>
          <button type="button" class="tab-btn" data-tab="debt">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <span>Debt Manually</span>
          </button>
        </nav>

        <!-- TAB 1: Using Plaid -->
        <div id="add-tab-plaid" class="modal-tab-content active">
          <!-- 1. Plaid Configured Panel (Shown when environment variables are set) -->
          <div id="plaid-connected-panel" class="glass-card" style="background: rgba(31, 41, 55, 0.4); text-align: center; padding: 2rem 1.5rem; margin-top: 0.5rem;">
            <div class="brand-icon" style="margin: 0 auto 1rem; width: 48px; height: 48px; font-size: 1.5rem;">🔗</div>
            <h3 style="font-size: 1.15rem; margin-bottom: 0.5rem;">Automated Brokerage & Bank Sync</h3>
            <p class="subtext" style="max-width: 440px; margin: 0 auto 1.25rem;">
              Securely connect your institutional investment accounts, 401(k) plans, IRAs, or checking & savings from Vanguard, Fidelity, Schwab, Chase, and 12,000+ financial institutions.
            </p>
            <div id="plaid-env-pill" class="badge-pill green" style="display: inline-block; margin-bottom: 1.25rem;">
              🟢 Plaid Configured (<span id="plaid-env-label">SANDBOX</span>)
            </div>
            <div>
              <button type="button" id="btn-connect-plaid" class="btn btn-primary btn-glow btn-lg" style="margin: 0 auto;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span>Connect with Plaid</span>
              </button>
            </div>
          </div>

          <!-- 2. Plaid Unconfigured Notice (Shown when environment variables are missing) -->
          <div id="plaid-unconfigured-panel" class="glass-card hidden" style="background: rgba(31, 41, 55, 0.4); padding: 1.75rem 1.5rem; margin-top: 0.5rem; text-align: center;">
            <div class="brand-icon" style="margin: 0 auto 1rem; width: 48px; height: 48px; font-size: 1.5rem;">⚙️</div>
            <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">Plaid Integration Not Configured</h4>
            <p class="subtext" style="max-width: 460px; margin: 0 auto 1.25rem; font-size: 0.9rem; line-height: 1.5;">
              To connect institutional bank and brokerage accounts, export your Plaid credentials as environment variables:
            </p>
            <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-glass); border-radius: 8px; padding: 0.75rem 1rem; max-width: 420px; margin: 0 auto 1.25rem; text-align: left; font-family: monospace; font-size: 0.82rem; color: var(--accent-cyan);">
              export PLAID_CLIENT_ID=&lt;your_client_id&gt;<br>
              export PLAID_SECRET=&lt;your_secret&gt;<br>
              export PLAID_ENV=production
            </div>
            <p class="subtext" style="font-size: 0.85rem; margin: 0 auto;">
              Refer to <code>README.md</code> for setup instructions. You can also add accounts manually using the <strong>Manually</strong> and <strong>Debt Manually</strong> tabs above.
            </p>
          </div>
        </div>

        <!-- TAB 2: Add account manually -->
        <div id="add-tab-manual" class="modal-tab-content">
          <form id="form-add-manual-account" class="modal-form" style="margin-top: 0.5rem;">
            <div style="margin-bottom: 0.5rem;">
              <h3 style="font-size: 1.1rem; margin-bottom: 0.25rem;">What type of account is this?</h3>
              <p class="subtext">Select the category and account type to configure return expectations</p>
            </div>

            <div class="form-group">
              <label for="manual-account-type">Account Type</label>
              <select id="manual-account-type" class="form-input custom-account-select" required>
                <optgroup label="TAXABLE">
                  <option value="Checking">Checking</option>
                  <option value="Investment" selected>Investment</option>
                  <option value="Savings">Savings</option>
                </optgroup>
                <optgroup label="TAX-DEFERRED">
                  <option value="401(k)">401(k)</option>
                  <option value="403(b)">403(b)</option>
                  <option value="457(b)">457(b)</option>
                  <option value="IRA">IRA</option>
                  <option value="IRA (Inherited)">IRA (Inherited)</option>
                  <option value="Other PreTax">Other PreTax</option>
                </optgroup>
                <optgroup label="TAX-FREE">
                  <option value="529">529</option>
                  <option value="HSA">HSA</option>
                  <option value="Roth 401(k)">Roth 401(k)</option>
                  <option value="Roth 403(b)">Roth 403(b)</option>
                  <option value="Roth 457(b)">Roth 457(b)</option>
                  <option value="Roth IRA">Roth IRA</option>
                  <option value="Roth IRA (Inherited)">Roth IRA (Inherited)</option>
                </optgroup>
                <optgroup label="REAL ESTATE & OTHER">
                  <option value="Real Estate / Property">Real Estate / Property</option>
                  <option value="Other Asset">Other Asset</option>
                </optgroup>
              </select>
            </div>

            <div class="form-group">
              <label for="manual-account-name">Account Name</label>
              <input type="text" id="manual-account-name" class="form-input" placeholder="e.g. Fidelity Brokerage, Primary Residence, Chase Savings" required>
            </div>

            <div class="grid-2col">
              <div class="form-group">
                <label for="manual-account-balance">Current Balance ($)</label>
                <input type="number" step="0.01" id="manual-account-balance" class="form-input" placeholder="0.00" required>
              </div>

              <div class="form-group">
                <label for="manual-account-target">Target Rate of Return (%)</label>
                <input type="number" step="0.1" id="manual-account-target" class="form-input" value="7.0">
              </div>
            </div>

            <div class="form-group">
              <label for="manual-account-linked-debt">Link to Debt / Mortgage (Optional)</label>
              <select id="manual-account-linked-debt" class="form-input">
                <option value="">None (Unencumbered / Standalone)</option>
              </select>
            </div>

            <div class="form-actions">
              <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
              <button type="submit" class="btn btn-primary btn-glow">Save Account</button>
            </div>
          </form>
        </div>

        <!-- TAB 3: Add debt account manually -->
        <div id="add-tab-debt" class="modal-tab-content">
          <form id="form-add-debt-account" class="modal-form" style="margin-top: 0.5rem;">
            <div style="margin-bottom: 0.5rem;">
              <h3 style="font-size: 1.1rem; margin-bottom: 0.25rem;">Add Debt Account</h3>
              <p class="subtext">Track mortgages, personal loans, or lines of credit</p>
            </div>

            <div class="grid-2col">
              <div class="form-group">
                <label for="debt-account-name">Account Name</label>
                <input type="text" id="debt-account-name" class="form-input" placeholder="e.g. 30-Year Mortgage, Auto Loan, Student Loan" required>
              </div>

              <div class="form-group">
                <label for="debt-account-subtype">Debt Subtype</label>
                <select id="debt-account-subtype" class="form-input" required>
                  <option value="Mortgage" selected>Mortgage</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div class="grid-2col">
              <div class="form-group">
                <label for="debt-account-balance">Current Balance ($)</label>
                <input type="number" step="0.01" id="debt-account-balance" class="form-input" placeholder="0.00" required>
              </div>

              <div class="form-group">
                <label for="debt-account-linked-asset">Link to Collateral Asset (Optional)</label>
                <select id="debt-account-linked-asset" class="form-input">
                  <option value="">None (Unsecured / Standalone)</option>
                </select>
              </div>
            </div>

            <div class="grid-2col">
              <div class="form-group">
                <label for="debt-account-interest">Interest Rate (%)</label>
                <input type="number" step="0.01" id="debt-account-interest" class="form-input" placeholder="e.g. 5.50">
              </div>

              <div class="form-group">
                <label for="debt-account-payment">Monthly Payment ($)</label>
                <input type="number" step="0.01" id="debt-account-payment" class="form-input" placeholder="e.g. 1500.00">
              </div>
            </div>

            <div class="form-actions">
              <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
              <button type="submit" class="btn btn-primary btn-glow">Save Debt Account</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

export function openAddAccountModal(activeTab = 'plaid') {
  const modal = document.getElementById('modal-add-account');
  if (!modal) return;

  populateLinkedAssetDropdowns();
  modal.classList.remove('hidden');
  switchAddAccountTab(activeTab);
}

export function switchAddAccountTab(tabName) {
  let normalizedTab = tabName;
  if (tabName === 'asset') normalizedTab = 'manual';
  if (tabName === 'loan') normalizedTab = 'debt';

  document.querySelectorAll('#modal-add-account nav .tab-btn').forEach(btn => {
    const btnTab = btn.getAttribute('data-tab');
    btn.classList.toggle('active', btnTab === normalizedTab);
  });
  document.querySelectorAll('#modal-add-account .modal-tab-content').forEach(c => {
    c.classList.toggle('active', c.id === `add-tab-${normalizedTab}`);
  });

  if (normalizedTab === 'plaid') {
    updatePlaidTabUI();
  }
}

async function updatePlaidTabUI() {
  const connectedPanel = document.getElementById('plaid-connected-panel');
  const unconfiguredPanel = document.getElementById('plaid-unconfigured-panel');
  const envLabel = document.getElementById('plaid-env-label');

  try {
    const status = await apiFetch('/plaid/status');
    if (status && status.configured) {
      connectedPanel?.classList.remove('hidden');
      unconfiguredPanel?.classList.add('hidden');
      if (envLabel) {
        envLabel.textContent = (status.env || 'sandbox').toUpperCase();
      }
    } else {
      connectedPanel?.classList.add('hidden');
      unconfiguredPanel?.classList.remove('hidden');
    }
  } catch (err) {
    console.warn('Could not check Plaid status:', err);
    connectedPanel?.classList.add('hidden');
    unconfiguredPanel?.classList.remove('hidden');
  }
}

export function setupAddAccountDialog() {
  document.querySelectorAll('#modal-add-account nav .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchAddAccountTab(btn.getAttribute('data-tab'));
    });
  });

  // Account Type Dropdown Change Handler
  const accountTypeSelect = document.getElementById('manual-account-type');
  const accountTargetInput = document.getElementById('manual-account-target');
  accountTypeSelect?.addEventListener('change', () => {
    const selected = MANUAL_ACCOUNT_TYPES[accountTypeSelect.value];
    if (selected && accountTargetInput) {
      accountTargetInput.value = selected.defaultTarget;
    }
  });

  // Tab 2: Manual Asset / Account Form
  document.getElementById('form-add-manual-account')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const typeKey = document.getElementById('manual-account-type')?.value || 'Investment';
    const name = document.getElementById('manual-account-name')?.value.trim();
    const balance = parseFloat(document.getElementById('manual-account-balance')?.value) || 0;
    const target = parseFloat(document.getElementById('manual-account-target')?.value) || 7.0;
    const linkedDebtId = document.getElementById('manual-account-linked-debt')?.value || null;

    const typeConfig = MANUAL_ACCOUNT_TYPES[typeKey] || {
      type: 'TAXABLE',
      subtype: typeKey,
      category_group: 'Taxable Brokerage'
    };

    try {
      await apiFetch('/accounts/manual', {
        method: 'POST',
        body: JSON.stringify({
          name,
          type: typeConfig.type,
          subtype: typeConfig.subtype,
          category_group: typeConfig.category_group,
          account_class: 'asset',
          initial_balance: balance,
          target_annual_return_rate: target,
          linked_asset_id: linkedDebtId
        })
      });

      document.getElementById('modal-add-account')?.classList.add('hidden');
      document.getElementById('form-add-manual-account')?.reset();
      window.dispatchEvent(new CustomEvent('invest:refresh-all-data'));
    } catch (err) {
      alert(`Error creating account: ${err.message}`);
    }
  });

  // Tab 3: Debt Account Form
  document.getElementById('form-add-debt-account')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('debt-account-name')?.value.trim();
    const subtype = document.getElementById('debt-account-subtype')?.value || 'Mortgage';
    const balance = parseFloat(document.getElementById('debt-account-balance')?.value) || 0;
    const linkedAssetId = document.getElementById('debt-account-linked-asset')?.value || null;
    const interest = parseFloat(document.getElementById('debt-account-interest')?.value) || null;
    const payment = parseFloat(document.getElementById('debt-account-payment')?.value) || null;

    try {
      await apiFetch('/accounts/manual', {
        method: 'POST',
        body: JSON.stringify({
          name,
          type: 'DEBT',
          subtype: subtype,
          category_group: 'Debt',
          account_class: 'liability',
          initial_balance: balance,
          target_annual_return_rate: 0.0,
          linked_asset_id: linkedAssetId,
          manual_detail: {
            interest_rate: interest,
            monthly_payment: payment
          }
        })
      });

      document.getElementById('modal-add-account')?.classList.add('hidden');
      document.getElementById('form-add-debt-account')?.reset();
      window.dispatchEvent(new CustomEvent('invest:refresh-all-data'));
    } catch (err) {
      alert(`Error creating debt account: ${err.message}`);
    }
  });

  // Tab 1: Plaid Link Handler
  const launchPlaidLink = async () => {
    const btn = document.getElementById('btn-connect-plaid');
    const originalContent = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        <span>Opening Plaid Link...</span>
      `;
    }

    try {
      const res = await apiFetch('/plaid/link-token', { method: 'POST' });
      const linkToken = res?.link_token;
      const isConfigured = res?.is_configured !== false;

      if (!isConfigured) {
        document.getElementById('plaid-connected-panel')?.classList.add('hidden');
        document.getElementById('plaid-unconfigured-panel')?.classList.remove('hidden');
        return;
      }

      if (!linkToken) {
        throw new Error('No link token returned by server.');
      }

      if (typeof window.Plaid === 'undefined' || !window.Plaid.create) {
        throw new Error('Plaid Link SDK is loading or blocked by your browser. Please check your internet connection.');
      }

      const handler = window.Plaid.create({
        token: linkToken,
        onSuccess: async (public_token, metadata) => {
          try {
            const instName = metadata?.institution?.name || 'Connected Brokerage';
            await apiFetch('/plaid/exchange-token', {
              method: 'POST',
              body: JSON.stringify({
                public_token: public_token,
                institution_name: instName
              })
            });
            document.getElementById('modal-add-account')?.classList.add('hidden');
            alert(`Plaid connection to ${instName} created successfully!`);
            window.dispatchEvent(new CustomEvent('invest:refresh-all-data'));
          } catch (err) {
            alert(`Error exchanging Plaid token: ${err.message}`);
          }
        },
        onExit: (err, metadata) => {
          if (err) {
            console.warn('Plaid Link exited with error:', err);
            alert(`Plaid Link error: ${err.message || err.display_message || 'Connection cancelled'}`);
          }
        }
      });
      handler.open();
    } catch (err) {
      console.error('Plaid connection error:', err);
      if (err.message && (err.message.includes('not configured') || err.message.includes('credentials') || err.message.includes('Client ID'))) {
        document.getElementById('plaid-connected-panel')?.classList.add('hidden');
        document.getElementById('plaid-unconfigured-panel')?.classList.remove('hidden');
      } else {
        alert(`Plaid connection failed: ${err.message}`);
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalContent;
      }
    }
  };

  document.getElementById('btn-connect-plaid')?.addEventListener('click', launchPlaidLink);
  document.getElementById('btn-connect-plaid-demo')?.addEventListener('click', launchPlaidLink);
}

export function populateLinkedAssetDropdowns() {
  const accounts = state.accounts || [];

  // 1. Populate Debt Link Dropdown in Manual Asset Tab (show liabilities / debts)
  const debtSelect = document.getElementById('manual-account-linked-debt');
  if (debtSelect) {
    const currentVal = debtSelect.value;
    debtSelect.innerHTML = '<option value="">None (Unencumbered / Standalone)</option>';
    accounts.filter(a => a.account_class === 'liability' || a.type === 'DEBT' || a.type === 'loan').forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = `${a.name} (${formatCurrency(a.current_balance)})`;
      debtSelect.appendChild(opt);
    });
    if (currentVal) debtSelect.value = currentVal;
  }

  // 2. Populate Asset Link Dropdown in Debt Tab (show assets)
  const assetSelect = document.getElementById('debt-account-linked-asset');
  if (assetSelect) {
    const currentVal = assetSelect.value;
    assetSelect.innerHTML = '<option value="">None (Unsecured / Standalone)</option>';
    accounts.filter(a => a.account_class === 'asset').forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = `${a.name} (${a.subtype || a.type} - ${formatCurrency(a.current_balance)})`;
      assetSelect.appendChild(opt);
    });
    if (currentVal) assetSelect.value = currentVal;
  }
}
