/**
 * Modals Component for InvestTracker
 */
import { state, setToken, setUser } from '../state.js';
import { apiFetch } from '../api.js';

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
  window.addEventListener('invest:open-valuation-modal', (e) => {
    const { accountId, currentValue, title } = e.detail || {};
    openValuationModal(accountId, currentValue, title);
  });
  window.addEventListener('invest:open-settings-modal', () => openSettingsModal());

  setupAuthModal();
  setupAddAccountModal();
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

// 2. Add Account Modal (3 Tabs)
export function openAddAccountModal(activeTab = 'plaid') {
  const modal = document.getElementById('modal-add-account');
  if (!modal) return;

  modal.classList.remove('hidden');
  switchAddAccountTab(activeTab);
}

function switchAddAccountTab(tabName) {
  document.querySelectorAll('#modal-add-account .sub-nav-tabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });
  document.querySelectorAll('#modal-add-account .modal-tab-content').forEach(c => {
    c.classList.toggle('active', c.id === `add-tab-${tabName}`);
  });
}

function setupAddAccountModal() {
  document.querySelectorAll('#modal-add-account .sub-nav-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchAddAccountTab(btn.getAttribute('data-tab'));
    });
  });

  // Manual Asset Form
  document.getElementById('form-manual-asset')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('manual-asset-name').value.trim();
    const category = document.getElementById('manual-asset-category').value;
    const balance = parseFloat(document.getElementById('manual-asset-balance').value) || 0;
    const target = parseFloat(document.getElementById('manual-asset-target').value) || 7.0;
    const address = document.getElementById('manual-asset-address')?.value.trim() || null;
    const notes = document.getElementById('manual-asset-notes')?.value.trim() || null;

    let subtype = 'other';
    let type = 'investment';
    if (category === 'Real Estate') { subtype = 'property'; type = 'real_estate'; }
    else if (category === 'Retirement') { subtype = '401k'; }
    else if (category === 'IRAs') { subtype = 'ira'; }
    else if (category === 'Emergency Savings') { subtype = 'savings'; type = 'depository'; }
    else if (category === 'Taxable Brokerage') { subtype = 'brokerage'; }

    try {
      await apiFetch('/accounts/manual', {
        method: 'POST',
        body: JSON.stringify({
          name,
          type,
          subtype,
          category_group: category,
          account_class: 'asset',
          initial_balance: balance,
          target_annual_return_rate: target,
          property_address: address,
          notes
        })
      });

      document.getElementById('modal-add-account')?.classList.add('hidden');
      document.getElementById('form-manual-asset')?.reset();
      window.dispatchEvent(new CustomEvent('invest:refresh-all-data'));
    } catch (err) {
      alert(`Error creating asset: ${err.message}`);
    }
  });

  // Manual Loan Form
  document.getElementById('form-manual-loan')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('manual-loan-name').value.trim();
    const category = document.getElementById('manual-loan-category').value;
    const balance = parseFloat(document.getElementById('manual-loan-balance').value) || 0;
    const linkedAsset = document.getElementById('manual-loan-linked-asset')?.value || null;
    const interest = parseFloat(document.getElementById('manual-loan-interest')?.value) || null;
    const payment = parseFloat(document.getElementById('manual-loan-payment')?.value) || null;
    const notes = document.getElementById('manual-loan-notes')?.value.trim() || null;

    try {
      await apiFetch('/accounts/manual', {
        method: 'POST',
        body: JSON.stringify({
          name,
          type: 'loan',
          subtype: 'mortgage',
          category_group: category,
          account_class: 'liability',
          initial_balance: balance,
          target_annual_return_rate: 0.0,
          linked_asset_id: linkedAsset,
          interest_rate: interest,
          monthly_payment: payment,
          notes
        })
      });

      document.getElementById('modal-add-account')?.classList.add('hidden');
      document.getElementById('form-manual-loan')?.reset();
      window.dispatchEvent(new CustomEvent('invest:refresh-all-data'));
    } catch (err) {
      alert(`Error creating loan: ${err.message}`);
    }
  });

  // Plaid Mock Connect Form
  document.getElementById('btn-connect-plaid-demo')?.addEventListener('click', async () => {
    try {
      await apiFetch('/plaid/link/token', { method: 'POST' });
      // Exchange mock public token
      await apiFetch('/plaid/link/exchange', {
        method: 'POST',
        body: JSON.stringify({
          public_token: 'public-sandbox-mock-token',
          institution_name: 'Fidelity Investments (Mock)'
        })
      });
      document.getElementById('modal-add-account')?.classList.add('hidden');
      alert('Plaid sandbox connection created successfully!');
      window.dispatchEvent(new CustomEvent('invest:refresh-all-data'));
    } catch (err) {
      alert(`Plaid connection failed: ${err.message}`);
    }
  });
}

export function populateLinkedAssetDropdowns() {
  const assetSelect = document.getElementById('manual-loan-linked-asset');
  if (!assetSelect) return;

  const currentVal = assetSelect.value;
  assetSelect.innerHTML = '<option value="">None (Unsecured / Standalone)</option>';

  (state.accounts || []).filter(a => a.account_class === 'asset').forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.name} (${a.category_group})`;
    assetSelect.appendChild(opt);
  });

  if (currentVal) assetSelect.value = currentVal;
}

// 3. Valuation Modal
export function openValuationModal(accountId, currentValue, title = 'Valuation Update') {
  const modal = document.getElementById('modal-valuation');
  if (!modal) return;

  document.getElementById('valuation-modal-title').textContent = title;
  document.getElementById('valuation-account-id').value = accountId;
  document.getElementById('valuation-amount').value = currentValue || '';
  document.getElementById('valuation-date').value = new Date().toISOString().split('T')[0];

  modal.classList.remove('hidden');
}

function setupValuationModal() {
  document.getElementById('form-valuation')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const accId = document.getElementById('valuation-account-id').value;
    const amount = parseFloat(document.getElementById('valuation-amount').value);
    const date = document.getElementById('valuation-date').value;
    const note = document.getElementById('valuation-note')?.value.trim() || null;

    try {
      await apiFetch(`/accounts/${accId}/valuation`, {
        method: 'POST',
        body: JSON.stringify({
          account_id: accId,
          balance: amount,
          date: date || undefined,
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
