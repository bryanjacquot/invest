/**
 * Modals Component for InvestTracker
 */
import { state, setToken, setUser } from '../state.js';
import { apiFetch } from '../api.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { escapeHtml } from '../utils/dom.js';

export function initModals() {
  // Generic close buttons
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-backdrop');
      if (modal) modal.classList.add('hidden');
    });
  });

  // Global custom events
  window.addEventListener('invest:show-auth-modal', () => showAuthModal());
  window.addEventListener('invest:open-add-account', (e) => openAddAccountModal(e.detail?.tab));
  window.addEventListener('invest:open-edit-account', (e) => openEditAccountModal(e.detail?.accountId));
  window.addEventListener('invest:open-valuation-modal', (e) => {
    const { accountId, currentValue, title, accountClass } = e.detail || {};
    openValuationModal(accountId, currentValue, title, accountClass);
  });
  window.addEventListener('invest:open-settings-modal', () => openSettingsModal());

  setupAuthModal();
  setupAddAccountModal();
  setupEditAccountModal();
  setupValuationModal();
  setupSettingsModal();
}

// 1. Auth Modal
export function showAuthModal() {
  document.getElementById('modal-auth')?.classList.remove('hidden');
}

export function hideAuthModal() {
  document.getElementById('modal-auth')?.classList.add('hidden');
}

function setupAuthModal() {
  const toggleBtn = document.getElementById('btn-toggle-auth-mode');
  toggleBtn?.addEventListener('click', () => {
    state.isAuthRegisterMode = !state.isAuthRegisterMode;
    const title = document.getElementById('auth-modal-title');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchPrompt = document.getElementById('auth-switch-prompt');

    if (state.isAuthRegisterMode) {
      if (title) title.textContent = 'Create Master Account';
      if (submitBtn) submitBtn.textContent = 'Register & Initialize';
      if (switchPrompt) switchPrompt.textContent = 'Already have an account?';
      if (toggleBtn) toggleBtn.textContent = 'Sign In';
    } else {
      if (title) title.textContent = 'Sign In to InvestTracker';
      if (submitBtn) submitBtn.textContent = 'Sign In';
      if (switchPrompt) switchPrompt.textContent = "Don't have an account?";
      if (toggleBtn) toggleBtn.textContent = 'Create one';
    }
  });

  document.getElementById('form-auth')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value;
    const errBanner = document.getElementById('auth-error-msg');
    errBanner?.classList.add('hidden');

    const endpoint = state.isAuthRegisterMode ? '/auth/register' : '/auth/login';

    try {
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username: u, password: p })
      });

      setToken(data.access_token);
      state.user = await apiFetch('/auth/me');
      setUser(state.user);
      hideAuthModal();

      window.dispatchEvent(new CustomEvent('invest:refresh-all-data'));
    } catch (err) {
      if (errBanner) {
        errBanner.textContent = err.message || 'Authentication failed';
        errBanner.classList.remove('hidden');
      }
    }
  });
}

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

// 2. Add Account Modal (3 Tabs)
export function openAddAccountModal(activeTab = 'plaid') {
  const modal = document.getElementById('modal-add-account');
  if (!modal) return;

  populateLinkedAssetDropdowns();
  modal.classList.remove('hidden');
  switchAddAccountTab(activeTab);
}

function switchAddAccountTab(tabName) {
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

function setupAddAccountModal() {
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
      // 1. Request Link Token from backend
      const res = await apiFetch('/plaid/link-token', { method: 'POST' });
      const linkToken = res?.link_token;
      const isConfigured = res?.is_configured !== false;

      if (!isConfigured) {
        // Switch to unconfigured notice panel
        document.getElementById('plaid-connected-panel')?.classList.add('hidden');
        document.getElementById('plaid-unconfigured-panel')?.classList.remove('hidden');
        return;
      }

      if (!linkToken) {
        throw new Error('No link token returned by server.');
      }

      // 2. Check if Plaid JS SDK is loaded
      if (typeof window.Plaid === 'undefined' || !window.Plaid.create) {
        throw new Error('Plaid Link SDK is loading or blocked by your browser. Please check your internet connection.');
      }

      // 3. Open official Plaid Link UI
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
      // If error indicates unconfigured credentials, switch to notice panel
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

// 3. Valuation Modal
let currentModalPrevVal = 0.0;

export function openValuationModal(accountId, currentValue, title = 'Update Balance', accountClass = null) {
  const modal = document.getElementById('modal-valuation');
  if (!modal) return;

  currentModalPrevVal = parseFloat(currentValue) || 0.0;
  document.getElementById('valuation-modal-title').textContent = title;
  document.getElementById('valuation-account-id').value = accountId;
  document.getElementById('valuation-amount').value = currentValue || '';

  const contribInput = document.getElementById('valuation-contribution');
  if (contribInput) contribInput.value = '0.00';

  const contribGroup = document.getElementById('valuation-contribution-group');
  if (contribGroup) {
    const isLiability = accountClass === 'liability' || title.toLowerCase().includes('mortgage') || title.toLowerCase().includes('loan') || title.toLowerCase().includes('payment');
    contribGroup.style.display = isLiability ? 'none' : 'block';
  }

  document.getElementById('valuation-date').value = new Date().toISOString().split('T')[0];
  const noteEl = document.getElementById('valuation-note');
  if (noteEl) noteEl.value = '';

  updateValuationBreakdownPreview();
  modal.classList.remove('hidden');
}

function updateValuationBreakdownPreview() {
  const amountEl = document.getElementById('valuation-amount');
  const contribEl = document.getElementById('valuation-contribution');
  const prevEl = document.getElementById('val-preview-prev');
  const contribPreviewEl = document.getElementById('val-preview-contrib');
  const gainEl = document.getElementById('val-preview-gain');
  if (!prevEl || !gainEl) return;

  const newVal = parseFloat(amountEl?.value) || 0.0;
  const contribVal = parseFloat(contribEl?.value) || 0.0;
  const prevVal = currentModalPrevVal;

  prevEl.textContent = formatCurrency(prevVal);
  if (contribPreviewEl) contribPreviewEl.textContent = formatCurrency(contribVal);

  const totalDelta = newVal - prevVal;
  const impliedGain = totalDelta - contribVal;

  const sign = impliedGain >= 0 ? '+' : '';
  gainEl.textContent = `${sign}${formatCurrency(impliedGain)}`;
  gainEl.style.color = impliedGain >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
}

function setupValuationModal() {
  document.getElementById('valuation-amount')?.addEventListener('input', updateValuationBreakdownPreview);
  document.getElementById('valuation-contribution')?.addEventListener('input', updateValuationBreakdownPreview);

  document.getElementById('form-valuation')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const accId = document.getElementById('valuation-account-id').value;
    const amount = parseFloat(document.getElementById('valuation-amount').value);
    const contrib = parseFloat(document.getElementById('valuation-contribution')?.value) || 0.0;
    const date = document.getElementById('valuation-date').value;
    const note = document.getElementById('valuation-note')?.value.trim() || null;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      let isoDate;
      if (!date || date === todayStr) {
        isoDate = new Date().toISOString();
      } else {
        isoDate = new Date(date + 'T12:00:00').toISOString();
      }

      await apiFetch('/accounts/valuations', {
        method: 'POST',
        body: JSON.stringify({
          account_id: accId,
          new_balance: amount,
          contribution: contrib,
          date: isoDate,
          note
        })
      });

      document.getElementById('modal-valuation')?.classList.add('hidden');
      window.dispatchEvent(new CustomEvent('invest:refresh-all-data'));
    } catch (err) {
      alert(`Error recording valuation: ${err.message}`);
    }
  });
}

// 4. Settings & Backup Modal
export function openSettingsModal() {
  document.getElementById('modal-settings')?.classList.remove('hidden');
}

function setupSettingsModal() {
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
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Backup download failed: ${err.message}`);
    }
  });

  document.getElementById('form-restore-backup')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('backup-file-input');
    if (!fileInput.files || fileInput.files.length === 0) return;

    if (!confirm('Restoring will overwrite current database records. Proceed?')) return;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
      await apiFetch('/backup/restore', {
        method: 'POST',
        body: formData
      });
      alert('Database restored successfully! Reloading...');
      window.location.reload();
    } catch (err) {
      alert(`Restore failed: ${err.message}`);
    }
  });
}

// 5. Edit Account Modal
export function openEditAccountModal(accountId) {
  const account = (state.accounts || []).find(a => a.id === accountId);
  if (!account) return;

  const idInput = document.getElementById('edit-acc-id');
  const nameInput = document.getElementById('edit-acc-name');
  const typeSelect = document.getElementById('edit-acc-type');
  const targetInput = document.getElementById('edit-acc-target');
  const specsList = document.getElementById('edit-acc-specs-list');
  const errPill = document.getElementById('edit-acc-error');
  const successPill = document.getElementById('edit-acc-success');

  if (idInput) idInput.value = account.id;
  if (nameInput) nameInput.value = account.name;
  if (targetInput) targetInput.value = account.target_annual_return_rate ?? 7.0;
  if (errPill) errPill.classList.add('hidden');
  if (successPill) successPill.classList.add('hidden');

  // Populate Account Type / Subtype Select
  if (typeSelect) {
    if (account.subtype && Array.from(typeSelect.options).some(o => o.value === account.subtype)) {
      typeSelect.value = account.subtype;
    } else if (account.type === 'DEBT') {
      typeSelect.value = 'Mortgage';
    } else {
      typeSelect.value = 'Investment';
    }
  }

  // Populate Linked Account Dropdown in Edit Modal
  const linkedSelect = document.getElementById('edit-acc-linked-account');
  if (linkedSelect) {
    linkedSelect.innerHTML = '<option value="">None (Unlinked / Standalone)</option>';
    const isAsset = account.account_class === 'asset';
    const compatible = (state.accounts || []).filter(a =>
      a.id !== account.id && (isAsset ? (a.account_class === 'liability' || a.type === 'DEBT' || a.type === 'loan') : (a.account_class === 'asset'))
    );
    compatible.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = `${a.name} (${a.subtype || a.type} - ${formatCurrency(a.current_balance)})`;
      linkedSelect.appendChild(opt);
    });
    linkedSelect.value = account.linked_asset_id || '';
  }

  if (specsList) {
    specsList.innerHTML = `
      <div class="overview-stat-row">
        <span class="overview-stat-label">Account ID</span>
        <span class="overview-stat-val" style="font-family: monospace; font-size: 0.75rem;">${account.id}</span>
      </div>
      <div class="overview-stat-row">
        <span class="overview-stat-label">Type</span>
        <span class="overview-stat-val"><strong>${escapeHtml(account.type || 'TAXABLE')}</strong></span>
      </div>
      <div class="overview-stat-row">
        <span class="overview-stat-label">Subtype</span>
        <span class="overview-stat-val">${escapeHtml(account.subtype || account.type)}</span>
      </div>
      <div class="overview-stat-row">
        <span class="overview-stat-label">Institution</span>
        <span class="overview-stat-val">${escapeHtml(account.institution_name || 'Manual')}</span>
      </div>
      <div class="overview-stat-row">
        <span class="overview-stat-label">Account Class</span>
        <span class="overview-stat-val">${account.account_class.toUpperCase()}</span>
      </div>
      <div class="overview-stat-row">
        <span class="overview-stat-label">Created Date</span>
        <span class="overview-stat-val">${formatDate(account.created_at)}</span>
      </div>
      ${account.linked_asset_name ? `
        <div class="overview-stat-row">
          <span class="overview-stat-label">Linked Account</span>
          <span class="overview-stat-val" style="color: var(--accent-blue); font-weight: 600;">${escapeHtml(account.linked_asset_name)}</span>
        </div>
      ` : ''}
      ${account.manual_detail?.interest_rate ? `
        <div class="overview-stat-row">
          <span class="overview-stat-label">Interest Rate</span>
          <span class="overview-stat-val">${account.manual_detail.interest_rate}%</span>
        </div>
      ` : ''}
      ${account.manual_detail?.monthly_payment ? `
        <div class="overview-stat-row">
          <span class="overview-stat-label">Monthly Payment</span>
          <span class="overview-stat-val">${formatCurrency(account.manual_detail.monthly_payment)}</span>
        </div>
      ` : ''}
    `;
  }

  document.getElementById('modal-edit-account')?.classList.remove('hidden');
}

function setupEditAccountModal() {
  const typeSelect = document.getElementById('edit-acc-type');
  const targetInput = document.getElementById('edit-acc-target');
  typeSelect?.addEventListener('change', () => {
    const cfg = MANUAL_ACCOUNT_TYPES[typeSelect.value];
    if (cfg && targetInput && cfg.defaultTarget !== undefined) {
      targetInput.value = cfg.defaultTarget;
    }
  });

  document.getElementById('form-edit-account')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const accountId = document.getElementById('edit-acc-id').value;
    const name = document.getElementById('edit-acc-name').value.trim();
    const selectedTypeKey = document.getElementById('edit-acc-type')?.value;
    const typeConfig = MANUAL_ACCOUNT_TYPES[selectedTypeKey];
    const targetRate = parseFloat(document.getElementById('edit-acc-target').value);
    const linkedAssetId = document.getElementById('edit-acc-linked-account')?.value ?? undefined;

    const errPill = document.getElementById('edit-acc-error');
    const successPill = document.getElementById('edit-acc-success');
    errPill?.classList.add('hidden');
    successPill?.classList.add('hidden');

    try {
      const payload = {
        name,
        target_annual_return_rate: targetRate
      };
      if (typeConfig) {
        payload.type = typeConfig.type;
        payload.subtype = typeConfig.subtype;
        payload.category_group = typeConfig.category_group;
      }
      if (linkedAssetId !== undefined) {
        payload.linked_asset_id = linkedAssetId;
      }

      await apiFetch(`/accounts/${accountId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (successPill) {
        successPill.classList.remove('hidden');
      }

      // Refresh data & UI
      window.dispatchEvent(new CustomEvent('invest:refresh-all-data'));

      setTimeout(() => {
        document.getElementById('modal-edit-account')?.classList.add('hidden');
      }, 700);
    } catch (err) {
      if (errPill) {
        errPill.textContent = `Failed to update account: ${err.message}`;
        errPill.classList.remove('hidden');
      }
    }
  });

  // Delete Account Confirmation & Execution Flow
  let currentDeletingAccountId = null;
  let currentDeletingAccountName = '';

  const deleteBtn = document.getElementById('btn-delete-account');
  const confirmModal = document.getElementById('modal-confirm-delete-account');
  const confirmName = document.getElementById('delete-confirm-account-name');
  const confirmBtn = document.getElementById('btn-confirm-delete-account');

  const successModal = document.getElementById('modal-delete-account-success');
  const successName = document.getElementById('delete-success-account-name');
  const closeSuccessBtn = document.getElementById('btn-close-delete-success');

  const errorModal = document.getElementById('modal-delete-account-error');
  const errorMsg = document.getElementById('delete-error-message');
  const closeErrorBtn = document.getElementById('btn-close-delete-error');

  // 1. Open confirmation modal on "Delete Account" button click
  deleteBtn?.addEventListener('click', () => {
    const accountId = document.getElementById('edit-acc-id')?.value;
    const accountName = document.getElementById('edit-acc-name')?.value || 'this account';
    currentDeletingAccountId = accountId;
    currentDeletingAccountName = accountName;

    if (confirmName) confirmName.textContent = accountName;
    confirmModal?.classList.remove('hidden');
  });

  // 2. Execute deletion upon confirmation
  confirmBtn?.addEventListener('click', async () => {
    if (!currentDeletingAccountId) return;
    const originalBtnContent = confirmBtn.innerHTML;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<span>Deleting...</span>`;

    try {
      const res = await apiFetch(`/accounts/${encodeURIComponent(currentDeletingAccountId)}`, {
        method: 'DELETE'
      });

      // Close confirmation dialog and edit dialog
      confirmModal?.classList.add('hidden');
      document.getElementById('modal-edit-account')?.classList.add('hidden');

      // Display "[account] successfully deleted" success dialog
      const displayName = res?.name || currentDeletingAccountName || 'Account';
      if (successName) successName.textContent = displayName;
      successModal?.classList.remove('hidden');
    } catch (err) {
      // Close confirmation dialog and show error dialog with API message
      confirmModal?.classList.add('hidden');
      if (errorMsg) {
        errorMsg.textContent = err.message || 'Failed to delete account. Please try again.';
      }
      errorModal?.classList.remove('hidden');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = originalBtnContent;
    }
  });

  // 3. Handle success modal Close button click
  closeSuccessBtn?.addEventListener('click', () => {
    successModal?.classList.add('hidden');

    // If currently viewing the deleted account URL, redirect to /account
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('id') === currentDeletingAccountId) {
      window.history.pushState({}, '', '/account');
    }

    // Refresh sidebar to no longer show the account
    window.dispatchEvent(new CustomEvent('invest:refresh-all-data'));
  });

  // 4. Handle error modal Close button click
  closeErrorBtn?.addEventListener('click', () => {
    errorModal?.classList.add('hidden');
  });
}
