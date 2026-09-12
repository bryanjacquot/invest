/**
 * Edit Account Settings Dialog Component
 */
import { state } from '../../state.js';
import { apiFetch } from '../../api.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { escapeHtml } from '../../utils/dom.js';
import { MANUAL_ACCOUNT_TYPES } from './add_account_dialog.js';

export function getEditAccountDialogHtml() {
  return `
    <!-- EDIT ACCOUNT MODAL -->
    <div id="modal-edit-account" class="modal-backdrop hidden">
      <div class="modal-card glass-modal" style="max-width: 580px;">
        <div class="modal-header">
          <div>
            <h2 id="edit-acc-modal-title">Edit Account Settings</h2>
            <p class="subtext">Configure target return rate and account properties.</p>
          </div>
          <button type="button" class="btn-close modal-close-btn">&times;</button>
        </div>

        <form id="form-edit-account" style="display: flex; flex-direction: column; gap: 1rem; margin-top: 0.5rem;">
          <input type="hidden" id="edit-acc-id">

          <div class="form-group">
            <label class="form-label" for="edit-acc-name">Account Name</label>
            <input type="text" id="edit-acc-name" class="form-input" required>
          </div>

          <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label class="form-label" for="edit-acc-type">Account Type</label>
              <select id="edit-acc-type" class="form-input custom-account-select" required>
                <optgroup label="TAXABLE">
                  <option value="Checking">Checking</option>
                  <option value="Investment">Investment</option>
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
                <optgroup label="DEBT">
                  <option value="Mortgage">Mortgage</option>
                  <option value="Other">Other</option>
                </optgroup>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-acc-target">Target Rate (% APR)</label>
              <input type="number" id="edit-acc-target" class="form-input" step="0.1" required>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="edit-acc-linked-account">Linked Asset / Debt Account</label>
            <select id="edit-acc-linked-account" class="form-select form-input">
              <option value="">None (Unlinked / Standalone)</option>
            </select>
          </div>

          <!-- Account Specifications Box -->
          <div class="glass-card" style="padding: 1rem; background: rgba(31, 41, 55, 0.4); margin-top: 0.25rem;">
            <h4 style="font-size: 0.85rem; margin-bottom: 0.5rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Specifications</h4>
            <div class="overview-stats-list" id="edit-acc-specs-list" style="font-size: 0.85rem; display: flex; flex-direction: column; gap: 0.4rem;">
              <!-- Dynamic specifications rendered on open -->
            </div>
          </div>

          <div id="edit-acc-error" class="badge-pill red hidden" style="text-align: center;"></div>
          <div id="edit-acc-success" class="badge-pill green hidden" style="text-align: center;">Settings Saved Successfully!</div>

          <div class="form-actions" style="margin-top: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
            <button type="button" class="btn btn-danger" id="btn-delete-account">Delete Account</button>
            <div style="display: flex; gap: 0.75rem;">
              <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
              <button type="submit" class="btn btn-primary btn-glow" id="btn-save-edit-account">Save Changes</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
}

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

export function setupEditAccountDialog() {
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
}
