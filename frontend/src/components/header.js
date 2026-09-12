/**
 * Header Component for InvestTracker
 */
import { state, setToken, setUser } from '../state.js';
import { apiFetch } from '../api.js';
import { router } from '../router.js';

export function initHeader() {
  // Brand click -> navigate to /account
  document.getElementById('brand-logo-btn')?.addEventListener('click', () => {
    router.navigate('/account');
  });

  // Seed Demo Portfolio Button
  document.getElementById('btn-seed-demo')?.addEventListener('click', async () => {
    if (confirm('Load realistic sample investment portfolio, IRAs, real estate, mortgage, and emergency savings?')) {
      try {
        await apiFetch('/seed/demo-portfolio', { method: 'POST' });
        alert('Demo portfolio loaded successfully!');
        window.dispatchEvent(new CustomEvent('invest:refresh-all-data'));
      } catch (err) {
        alert(`Error seeding demo: ${err.message}`);
      }
    }
  });

  // User Dropdown
  const userBtn = document.getElementById('user-menu-btn');
  const userDropdown = document.getElementById('user-dropdown');

  userBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown?.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    userDropdown?.classList.add('hidden');
  });

  // Settings & Backup modal trigger
  document.getElementById('btn-open-settings')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('invest:open-settings-modal'));
  });

  // Logout button
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    setToken(null);
    setUser(null);
    window.dispatchEvent(new CustomEvent('invest:show-auth-modal'));
  });

  updateUserDisplay();
}

export function updateUserDisplay() {
  if (state.user) {
    const nameEl = document.getElementById('user-display-name');
    if (nameEl) nameEl.textContent = state.user.username;

    const dropUser = document.getElementById('dropdown-username');
    if (dropUser) dropUser.textContent = state.user.username;

    const avatarEl = document.getElementById('user-avatar');
    if (avatarEl) avatarEl.textContent = state.user.username.charAt(0).toUpperCase();
  }
}

let syncDismissTimeout = null;
let syncFadeTimeout = null;

export function showSyncing() {
  clearTimeout(syncDismissTimeout);
  clearTimeout(syncFadeTimeout);

  const container = document.getElementById('header-sync-status');
  const spinner = document.getElementById('sync-spinner');
  const text = document.getElementById('sync-status-text');

  if (!container || !spinner || !text) return;

  container.classList.remove('hidden', 'fade-out', 'complete', 'error');
  container.classList.add('syncing');
  spinner.style.display = 'inline-block';
  text.textContent = 'Syncing Accounts';
}

export function showSyncComplete() {
  clearTimeout(syncDismissTimeout);
  clearTimeout(syncFadeTimeout);

  const container = document.getElementById('header-sync-status');
  const spinner = document.getElementById('sync-spinner');
  const text = document.getElementById('sync-status-text');

  if (!container || !spinner || !text) return;

  container.classList.remove('hidden', 'fade-out', 'syncing', 'error');
  container.classList.add('complete');
  spinner.style.display = 'none';
  text.textContent = 'Sync Complete';

  // Remain for 10 seconds, then fade away
  syncDismissTimeout = setTimeout(() => {
    container.classList.add('fade-out');
    syncFadeTimeout = setTimeout(() => {
      container.classList.add('hidden');
      container.classList.remove('fade-out', 'complete');
    }, 500);
  }, 10000);
}

export function showSyncError(errorMessage = '') {
  clearTimeout(syncDismissTimeout);
  clearTimeout(syncFadeTimeout);

  const container = document.getElementById('header-sync-status');
  const spinner = document.getElementById('sync-spinner');
  const text = document.getElementById('sync-status-text');

  if (!container || !spinner || !text) return;

  container.classList.remove('hidden', 'fade-out', 'syncing', 'complete');
  container.classList.add('error');
  spinner.style.display = 'none';
  text.textContent = 'Sync Error';

  // Remain for 10 seconds, then fade away
  syncDismissTimeout = setTimeout(() => {
    container.classList.add('fade-out');
    syncFadeTimeout = setTimeout(() => {
      container.classList.add('hidden');
      container.classList.remove('fade-out', 'error');
    }, 500);
  }, 10000);
}

