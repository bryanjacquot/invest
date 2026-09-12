/**
 * Modals Component Orchestrator for InvestTracker
 * Mounts dialog templates and initializes event listeners for modular dialog components.
 */
import {
  getAuthDialogHtml,
  showAuthModal,
  hideAuthModal,
  setupAuthDialog
} from './dialogs/auth_dialog.js';

import {
  getAddAccountDialogHtml,
  openAddAccountModal,
  setupAddAccountDialog,
  populateLinkedAssetDropdowns,
  MANUAL_ACCOUNT_TYPES
} from './dialogs/add_account_dialog.js';

import {
  getUpdateBalanceDialogHtml,
  openValuationModal,
  setupUpdateBalanceDialog
} from './dialogs/update_balance_dialog.js';

import {
  getSettingsDialogHtml,
  openSettingsModal,
  setupSettingsDialog
} from './dialogs/settings_dialog.js';

import {
  getEditAccountDialogHtml,
  openEditAccountModal,
  setupEditAccountDialog
} from './dialogs/edit_account_dialog.js';

import {
  getDeleteAccountDialogsHtml,
  setupDeleteAccountDialogs
} from './dialogs/delete_account_dialog.js';

export function initModals() {
  // Mount dialog HTML into modals-container
  const container = document.getElementById('modals-container');
  if (container) {
    container.innerHTML = [
      getAuthDialogHtml(),
      getAddAccountDialogHtml(),
      getUpdateBalanceDialogHtml(),
      getSettingsDialogHtml(),
      getEditAccountDialogHtml(),
      getDeleteAccountDialogsHtml()
    ].join('\n');
  }

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

  // Initialize individual dialog lifecycle listeners
  setupAuthDialog();
  setupAddAccountDialog();
  setupUpdateBalanceDialog();
  setupSettingsDialog();
  setupEditAccountDialog();
  setupDeleteAccountDialogs();
}

// Re-export dialog methods and constants for backward compatibility
export {
  showAuthModal,
  hideAuthModal,
  MANUAL_ACCOUNT_TYPES,
  openAddAccountModal,
  populateLinkedAssetDropdowns,
  openValuationModal,
  openSettingsModal,
  openEditAccountModal
};
