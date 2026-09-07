/**
 * Sidebar Component for InvestTracker
 */
import { state, setSidebarOpen } from '../state.js';
import { router } from '../router.js';
import { formatCurrency } from '../utils/formatters.js';
import { escapeHtml } from '../utils/dom.js';

export function initSidebar() {
  // Sidebar Toggle
  document.getElementById('btn-toggle-sidebar')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeSidebarMobile);

  // Overview Navigation Button
  document.getElementById('sidebar-nav-overview')?.addEventListener('click', () => {
    state.selectedAccountIds.clear();
    router.navigate('/overview');
    closeSidebarMobile();
  });

  // "All Accounts" Selector Row
  document.getElementById('sidebar-account-all')?.addEventListener('click', () => {
    state.selectedAccountIds.clear();
    navigateAccountView();
    closeSidebarMobile();
  });

  // Add Account button
  document.getElementById('btn-sidebar-add-account')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('invest:open-add-account'));
    closeSidebarMobile();
  });

  // React to route changed events
  window.addEventListener('invest:route-changed', (e) => {
    renderSidebarState(e.detail.path, e.detail.params);
  });

  applySidebarState();
  renderSidebarAccountsList();
}

export function navigateAccountView(accountIds = null) {
  const params = new URLSearchParams();
  if (accountIds && accountIds.length === 1) {
    params.set('id', accountIds[0]);
  } else if (accountIds && accountIds.length > 1) {
    params.set('accounts', accountIds.join(','));
  }

  if (state.metricUnit && state.metricUnit !== 'pct') {
    params.set('unit', state.metricUnit);
  }
  if (state.activeTimeframe && state.activeTimeframe !== '1Y') {
    params.set('timeframe', state.activeTimeframe);
  }

  const qs = params.toString();
  router.navigate(`/account${qs ? `?${qs}` : ''}`);
}

export function toggleSidebar() {
  setSidebarOpen(!state.sidebarOpen);
  applySidebarState();
}

export function closeSidebarMobile() {
  if (window.innerWidth <= 1024) {
    setSidebarOpen(false);
    applySidebarState();
  }
}

export function applySidebarState() {
  const app = document.getElementById('app');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (state.sidebarOpen) {
    app?.classList.remove('sidebar-collapsed');
    if (window.innerWidth <= 1024) backdrop?.classList.remove('hidden');
  } else {
    app?.classList.add('sidebar-collapsed');
    backdrop?.classList.add('hidden');
  }
}

export function renderSidebarState(path, params) {
  // 1. Overview active state
  const isOverview = path === '/overview' || path === '/';
  document.getElementById('sidebar-nav-overview')?.classList.toggle('active', isOverview);

  // 2. Real Estate active state
  const isRealEstate = path === '/real-estate';

  // 3. Account selection state
  const allRow = document.getElementById('sidebar-account-all');
  const idParam = params ? params.get('id') : null;
  const accountsParam = params ? params.get('accounts') : null;

  if (path === '/account' || path === '/performance') {
    if (idParam) {
      allRow?.classList.remove('active');
      document.querySelectorAll('.sidebar-account-item[data-account-id]').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-account-id') === idParam);
      });
    } else if (accountsParam) {
      const selectedSet = new Set(accountsParam.split(',').filter(Boolean));
      if (selectedSet.size === 0 || (state.accounts && selectedSet.size === state.accounts.length)) {
        allRow?.classList.add('active');
        document.querySelectorAll('.sidebar-account-item[data-account-id]').forEach(item => {
          item.classList.remove('active');
        });
      } else {
        allRow?.classList.remove('active');
        document.querySelectorAll('.sidebar-account-item[data-account-id]').forEach(item => {
          const accId = item.getAttribute('data-account-id');
          item.classList.toggle('active', selectedSet.has(accId));
        });
      }
    } else {
      // Default: All Accounts active
      allRow?.classList.add('active');
      document.querySelectorAll('.sidebar-account-item[data-account-id]').forEach(item => {
        item.classList.remove('active');
      });
    }
  } else {
    // Non-account path (e.g. overview or real-estate)
    allRow?.classList.remove('active');
    document.querySelectorAll('.sidebar-account-item[data-account-id]').forEach(item => {
      item.classList.remove('active');
    });
  }
}

export function renderSidebarAccountsList() {
  const container = document.getElementById('sidebar-accounts-list');
  const countBadge = document.getElementById('sidebar-accounts-count');
  const allBalEl = document.getElementById('sidebar-all-balance');

  const accounts = state.accounts || [];
  if (countBadge) countBadge.textContent = accounts.length;

  // Calculate total balance
  let totalBal = 0;
  accounts.forEach(a => {
    if (a.account_class === 'liability') {
      totalBal -= a.current_balance;
    } else {
      totalBal += a.current_balance;
    }
  });
  if (allBalEl) allBalEl.textContent = formatCurrency(totalBal);

  if (!container) return;

  if (accounts.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 1.5rem 0.5rem; color: var(--text-dim); font-size: 0.8rem;">
        No accounts added yet.<br>Click below to add an account.
      </div>
    `;
    return;
  }

  container.innerHTML = accounts.map(a => {
    const isLiability = a.account_class === 'liability';

    return `
      <div class="sidebar-account-item" data-account-id="${a.id}">
        <div class="account-item-left">
          <div class="account-item-name" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</div>
        </div>
        <div class="account-item-right">
          <div class="account-item-bal ${isLiability ? 'kpi-change negative' : ''}">
            ${formatCurrency(a.current_balance)}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach click and multi-select handlers to each item
  container.querySelectorAll('.sidebar-account-item[data-account-id]').forEach(item => {
    item.addEventListener('click', (e) => {
      const accId = item.getAttribute('data-account-id');
      if (!accId) return;

      const isMultiModifier = e.metaKey || e.ctrlKey || e.shiftKey;

      if (isMultiModifier) {
        // Multi-select toggle
        if (state.selectedAccountIds.has(accId)) {
          state.selectedAccountIds.delete(accId);
        } else {
          state.selectedAccountIds.add(accId);
        }

        const selectedArr = Array.from(state.selectedAccountIds);
        if (selectedArr.length === 0) {
          navigateAccountView(null);
        } else {
          navigateAccountView(selectedArr);
        }
      } else {
        // Single selection
        state.selectedAccountIds = new Set([accId]);
        navigateAccountView([accId]);
      }
      closeSidebarMobile();
    });
  });

  // Re-sync active highlighting with current route
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const currentParams = new URLSearchParams(window.location.search);
  renderSidebarState(currentPath === '/' ? '/overview' : currentPath, currentParams);
}
