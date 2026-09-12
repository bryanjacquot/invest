/**
 * InvestTracker — Main Modular SPA Entry Point
 */
import { state, setToken, setUser, setAccounts } from './state.js';
import { apiFetch } from './api.js';
import { router } from './router.js';

// Views
import accountView from './views/account.js';
import realEstateView from './views/real_estate.js';

// Components
import { initSidebar, renderSidebarAccountsList } from './components/sidebar.js';
import { initHeader, updateUserDisplay, showSyncing, showSyncComplete, showSyncError } from './components/header.js';
import { initModals, showAuthModal, populateLinkedAssetDropdowns } from './components/modals.js';

// Register application routes
router.register('/account', accountView);
router.register('/real-estate', realEstateView);

// Global event handlers for decoupled navigation & data refresh
window.addEventListener('invest:refresh-all-data', async () => {
  await loadAccounts();
  await router.handleRoute();
  await checkAndRunDailySync();
});

window.addEventListener('invest:refresh-accounts', async () => {
  await loadAccounts();
});

window.addEventListener('invest:navigate-account', (e) => {
  const accId = e.detail?.accountId;
  if (accId) {
    router.navigate(`/account?id=${encodeURIComponent(accId)}`);
  } else {
    router.navigate('/account');
  }
});

window.addEventListener('invest:navigate-overview', () => {
  router.navigate('/account');
});

async function loadAccounts() {
  try {
    const accs = await apiFetch('/accounts');
    setAccounts(accs);
    renderSidebarAccountsList();
    populateLinkedAssetDropdowns();
  } catch (err) {
    console.error('Error loading accounts:', err);
  }
}

async function initApp() {
  // Initialize component shell
  initHeader();
  initSidebar();
  initModals();

  if (!state.token) {
    showAuthModal();
    return;
  }

  try {
    const user = await apiFetch('/auth/me');
    setUser(user);
    updateUserDisplay();
    await loadAccounts();
  } catch (err) {
    showAuthModal();
    return;
  }

  // Mount active route
  const viewContainer = document.getElementById('view-container');
  router.init(viewContainer);

  // Check and run daily Plaid sync if needed
  await checkAndRunDailySync();
}

let isSyncInProgress = false;

async function checkAndRunDailySync() {
  if (isSyncInProgress) return;

  const accounts = state.accounts || [];
  const plaidAccounts = accounts.filter(acc => acc.source_type === 'plaid');
  if (plaidAccounts.length === 0) {
    return;
  }

  const todayStr = new Date().toDateString();
  const needsSync = plaidAccounts.some(acc => {
    if (!acc.last_synced_at) return true;
    return new Date(acc.last_synced_at).toDateString() !== todayStr;
  });

  if (!needsSync) {
    return;
  }

  isSyncInProgress = true;
  showSyncing();

  try {
    const res = await apiFetch('/plaid/sync', { method: 'POST' });
    if (res && res.success === false) {
      showSyncError(res.message || 'Sync failed');
    } else {
      showSyncComplete();
    }
  } catch (err) {
    console.error('Daily sync error:', err);
    showSyncError(err.message || 'Sync failed');
  } finally {
    await loadAccounts();
    await router.handleRoute();
    isSyncInProgress = false;
  }
}

document.addEventListener('DOMContentLoaded', initApp);

