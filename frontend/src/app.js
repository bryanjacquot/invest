/**
 * InvestTracker — Main Modular SPA Entry Point
 */
import { state, setToken, setUser, setAccounts } from './state.js';
import { apiFetch } from './api.js';
import { router } from './router.js';

// Views
import overviewView from './views/overview.js';
import performanceView from './views/performance.js';
import accountView from './views/account.js';
import realEstateView from './views/real_estate.js';

// Components
import { initSidebar, renderSidebarFilters, renderSidebarAccountsList } from './components/sidebar.js';
import { initHeader, updateUserDisplay } from './components/header.js';
import { initModals, showAuthModal, populateLinkedAssetDropdowns } from './components/modals.js';

// Register application routes
router.register('/overview', overviewView);
router.register('/performance', performanceView);
router.register('/account', accountView);
router.register('/real-estate', realEstateView);

// Global event handlers for decoupled navigation & data refresh
window.addEventListener('invest:refresh-all-data', async () => {
  await loadAccounts();
  await router.handleRoute();
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
  router.navigate('/overview');
});

async function loadAccounts() {
  try {
    const accs = await apiFetch('/accounts');
    setAccounts(accs);
    renderSidebarFilters();
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
}

document.addEventListener('DOMContentLoaded', initApp);
