/**
 * Delete Account Dialogs Component (Confirmation, Success, and Error Dialogs)
 */
import { apiFetch } from '../../api.js';

let currentDeletingAccountId = null;
let currentDeletingAccountName = '';

export function getDeleteAccountDialogsHtml() {
  return `
    <!-- CONFIRM DELETE ACCOUNT MODAL -->
    <div id="modal-confirm-delete-account" class="modal-backdrop hidden">
      <div class="modal-card glass-modal" style="max-width: 480px;">
        <div class="modal-header">
          <div>
            <h2 style="color: var(--accent-red); display: flex; align-items: center; gap: 0.5rem;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Delete Account
            </h2>
          </div>
          <button type="button" class="btn-close modal-close-btn">&times;</button>
        </div>
        <div style="padding: 1rem 0; line-height: 1.6;">
          <p style="margin-bottom: 0.75rem;">
            Are you sure you want to delete <strong id="delete-confirm-account-name" style="color: var(--text-main);"></strong>?
          </p>
          <div class="badge-pill red" style="display: block; padding: 0.65rem 0.85rem; font-size: 0.85rem; line-height: 1.4; text-align: left;">
            ⚠️ <strong>Warning:</strong> All historical performance records, asset holdings, valuation snapshots, and linked debt mappings will be permanently deleted. This action is irreversible.
          </div>
        </div>
        <div class="form-actions" style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
          <button type="button" class="btn btn-secondary modal-close-btn" id="btn-cancel-delete-account">Cancel</button>
          <button type="button" class="btn btn-danger" id="btn-confirm-delete-account">Yes, Delete Account</button>
        </div>
      </div>
    </div>

    <!-- DELETE ACCOUNT SUCCESS MODAL -->
    <div id="modal-delete-account-success" class="modal-backdrop hidden">
      <div class="modal-card glass-modal" style="max-width: 440px; text-align: center;">
        <div class="modal-header" style="justify-content: center; border-bottom: none; padding-bottom: 0.5rem;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); display: flex; align-items: center; justify-content: center; color: var(--accent-green); margin: 0 auto 0.5rem;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        </div>
        <h3 id="delete-success-modal-title" style="margin-bottom: 0.5rem; font-size: 1.15rem;">Account Deleted</h3>
        <p class="subtext" style="margin-bottom: 1.5rem; font-size: 0.95rem; color: var(--text-main);">
          <strong id="delete-success-account-name"></strong> successfully deleted.
        </p>
        <div class="form-actions" style="display: flex; justify-content: center;">
          <button type="button" class="btn btn-primary btn-glow" id="btn-close-delete-success" style="min-width: 120px;">Close</button>
        </div>
      </div>
    </div>

    <!-- DELETE ACCOUNT ERROR MODAL -->
    <div id="modal-delete-account-error" class="modal-backdrop hidden">
      <div class="modal-card glass-modal" style="max-width: 460px; text-align: center;">
        <div class="modal-header" style="justify-content: center; border-bottom: none; padding-bottom: 0.5rem;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); display: flex; align-items: center; justify-content: center; color: var(--accent-red); margin: 0 auto 0.5rem;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
        </div>
        <h3 style="margin-bottom: 0.5rem; font-size: 1.15rem; color: var(--accent-red);">Delete Failed</h3>
        <p id="delete-error-message" class="subtext" style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-main); line-height: 1.5;">
          An error occurred while deleting the account.
        </p>
        <div class="form-actions" style="display: flex; justify-content: center;">
          <button type="button" class="btn btn-secondary" id="btn-close-delete-error" style="min-width: 120px;">Close</button>
        </div>
      </div>
    </div>
  `;
}

export function openDeleteConfirmModal(accountId, accountName) {
  currentDeletingAccountId = accountId;
  currentDeletingAccountName = accountName;

  const confirmName = document.getElementById('delete-confirm-account-name');
  if (confirmName) confirmName.textContent = accountName;

  document.getElementById('modal-confirm-delete-account')?.classList.remove('hidden');
}

export function setupDeleteAccountDialogs() {
  const confirmModal = document.getElementById('modal-confirm-delete-account');
  const confirmBtn = document.getElementById('btn-confirm-delete-account');

  const successModal = document.getElementById('modal-delete-account-success');
  const successName = document.getElementById('delete-success-account-name');
  const closeSuccessBtn = document.getElementById('btn-close-delete-success');

  const errorModal = document.getElementById('modal-delete-account-error');
  const errorMsg = document.getElementById('delete-error-message');
  const closeErrorBtn = document.getElementById('btn-close-delete-error');

  // Wire up "Delete Account" button in edit account form
  document.getElementById('btn-delete-account')?.addEventListener('click', () => {
    const accountId = document.getElementById('edit-acc-id')?.value;
    const accountName = document.getElementById('edit-acc-name')?.value || 'this account';
    openDeleteConfirmModal(accountId, accountName);
  });

  // Execute deletion upon confirmation
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

  // Handle success modal Close button click
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

  // Handle error modal Close button click
  closeErrorBtn?.addEventListener('click', () => {
    errorModal?.classList.add('hidden');
  });
}
