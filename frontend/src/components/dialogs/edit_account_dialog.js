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
          </div>
          <button type="button" class="btn-close modal-close-btn">&times;</button>
        </div>

        <form id="form-edit-account" style="display: flex; flex-direction: column; gap: 1rem; margin-top: 0.5rem;">
          <input type="hidden" id="edit-acc-id">

          <div class="form-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label class="form-label" for="edit-acc-name">Account Name</label>
              <input type="text" id="edit-acc-name" class="form-input" required>
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-acc-institution">Institution</label>
              <input type="text" id="edit-acc-institution" class="form-input" placeholder="e.g. Chase, Fidelity">
            </div>
          </div>

          <div class="form-row" id="edit-acc-type-target-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group" id="edit-acc-type-group">
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

            <div class="form-group" id="edit-acc-target-group">
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

          <!-- Monthly Payment for Mortgage / Debt Accounts (editable for extra principal) -->
          <div class="form-group hidden" id="edit-acc-payment-group">
            <label class="form-label" for="edit-acc-payment">Monthly Payment ($)</label>
            <input type="number" id="edit-acc-payment" class="form-input" step="0.01" placeholder="e.g. 1500.00">
            <p class="subtext" style="font-size: 0.75rem; margin-top: 0.2rem;">Adjust payment amount when applying extra principal.</p>
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
  const institutionInput = document.getElementById('edit-acc-institution');
  const typeSelect = document.getElementById('edit-acc-type');
  const targetInput = document.getElementById('edit-acc-target');
  const specsList = document.getElementById('edit-acc-specs-list');
  const errPill = document.getElementById('edit-acc-error');
  const successPill = document.getElementById('edit-acc-success');

  if (idInput) idInput.value = account.id;
  if (nameInput) nameInput.value = account.name;
  if (institutionInput) {
    institutionInput.value = account.institution_name || account.manual_detail?.institution_name || '';
    if (account.source_type === 'plaid') {
      institutionInput.setAttribute('disabled', 'disabled');
      institutionInput.title = 'Institution managed automatically via Plaid';
    } else {
      institutionInput.removeAttribute('disabled');
      institutionInput.removeAttribute('title');
    }
  }
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

  // Check if debt account (liability, DEBT, loan, Debt category, or Mortgage/Other debt type)
  const isDebt = account.account_class === 'liability' ||
                 account.type === 'DEBT' ||
                 account.type === 'loan' ||
                 account.category_group === 'Debt' ||
                 (typeSelect?.value && MANUAL_ACCOUNT_TYPES[typeSelect.value]?.type === 'DEBT');

  const targetGroup = document.getElementById('edit-acc-target-group');
  const typeTargetRow = document.getElementById('edit-acc-type-target-row');
  if (targetGroup) {
    targetGroup.classList.toggle('hidden', isDebt);
  }
  if (typeTargetRow) {
    typeTargetRow.style.gridTemplateColumns = isDebt ? '1fr' : '1fr 1fr';
  }
  if (targetInput) {
    if (isDebt) {
      targetInput.removeAttribute('required');
      targetInput.value = account.target_annual_return_rate ?? 0.0;
    } else {
      targetInput.setAttribute('required', 'required');
      targetInput.value = account.target_annual_return_rate ?? 7.0;
    }
  }

  // Monthly Payment for Mortgage / Debt accounts
  const isMortgage = (account.subtype?.toLowerCase() === 'mortgage') ||
                     (account.type === 'DEBT' && (account.subtype === 'Mortgage' || typeSelect?.value === 'Mortgage')) ||
                     (typeSelect?.value === 'Mortgage');
  const paymentGroup = document.getElementById('edit-acc-payment-group');
  const paymentInput = document.getElementById('edit-acc-payment');
  if (paymentGroup) {
    paymentGroup.classList.toggle('hidden', !isMortgage);
  }
  if (paymentInput) {
    paymentInput.value = account.manual_detail?.monthly_payment ?? '';
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
    `;
  }

  document.getElementById('modal-edit-account')?.classList.remove('hidden');
}

export function setupEditAccountDialog() {
  const typeSelect = document.getElementById('edit-acc-type');
  const targetInput = document.getElementById('edit-acc-target');
  typeSelect?.addEventListener('change', () => {
    const selectedKey = typeSelect.value;
    const cfg = MANUAL_ACCOUNT_TYPES[selectedKey];
    const isDebt = cfg?.type === 'DEBT';
    const isMortgage = selectedKey === 'Mortgage';

    const targetGroup = document.getElementById('edit-acc-target-group');
    const typeTargetRow = document.getElementById('edit-acc-type-target-row');
    if (targetGroup) {
      targetGroup.classList.toggle('hidden', isDebt);
    }
    if (typeTargetRow) {
      typeTargetRow.style.gridTemplateColumns = isDebt ? '1fr' : '1fr 1fr';
    }
    if (targetInput) {
      if (isDebt) {
        targetInput.removeAttribute('required');
        targetInput.value = 0.0;
      } else {
        targetInput.setAttribute('required', 'required');
        if (cfg && cfg.defaultTarget !== undefined) {
          targetInput.value = cfg.defaultTarget;
        }
      }
    }

    const paymentGroup = document.getElementById('edit-acc-payment-group');
    if (paymentGroup) {
      paymentGroup.classList.toggle('hidden', !isMortgage);
    }
  });

  document.getElementById('form-edit-account')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const accountId = document.getElementById('edit-acc-id').value;
    const name = document.getElementById('edit-acc-name').value.trim();
    const institutionInput = document.getElementById('edit-acc-institution');
    const institutionName = institutionInput ? institutionInput.value.trim() : undefined;
    const selectedTypeKey = document.getElementById('edit-acc-type')?.value;
    const typeConfig = MANUAL_ACCOUNT_TYPES[selectedTypeKey];
    const targetGroup = document.getElementById('edit-acc-target-group');
    const isTargetHidden = targetGroup?.classList.contains('hidden');
    const targetRate = isTargetHidden ? 0.0 : (parseFloat(targetInput?.value) || 0.0);
    const linkedAssetId = document.getElementById('edit-acc-linked-account')?.value ?? undefined;
    const paymentGroup = document.getElementById('edit-acc-payment-group');
    const paymentInput = document.getElementById('edit-acc-payment');

    const errPill = document.getElementById('edit-acc-error');
    const successPill = document.getElementById('edit-acc-success');
    errPill?.classList.add('hidden');
    successPill?.classList.add('hidden');

    try {
      const payload = {
        name,
        target_annual_return_rate: targetRate
      };
      if (institutionName !== undefined) {
        payload.institution_name = institutionName;
      }
      if (typeConfig) {
        payload.type = typeConfig.type;
        payload.subtype = typeConfig.subtype;
        payload.category_group = typeConfig.category_group;
      }
      if (linkedAssetId !== undefined) {
        payload.linked_asset_id = linkedAssetId;
      }
      if (paymentGroup && !paymentGroup.classList.contains('hidden') && paymentInput) {
        const pVal = paymentInput.value.trim();
        payload.monthly_payment = pVal === '' ? null : parseFloat(pVal);
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
