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

  // Sync Button
  document.getElementById('btn-sync-now')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync-now');
    if (btn) btn.disabled = true;

    try {
      await apiFetch('/plaid/sync', { method: 'POST' });
      window.dispatchEvent(new CustomEvent('invest:refresh-all-data'));
    } catch (err) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
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
