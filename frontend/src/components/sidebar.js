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
    state.selectedCategories.clear();
    state.selectedAccountId = null;
    router.navigate('/overview');
    closeSidebarMobile();
  });

  // "All Accounts" Filter Row
  const allCheckbox = document.getElementById('filter-all-checkbox');

  const navigatePerformance = () => {
    const params = new URLSearchParams();
    if (state.selectedCategories && state.selectedCategories.size > 0) {
      params.set('categories', Array.from(state.selectedCategories).join(','));
    }
    if (state.selectedAccountId) {
      params.set('accounts', state.selectedAccountId);
    }
    if (state.metricUnit && state.metricUnit !== 'pct') {
      params.set('unit', state.metricUnit);
    }
    if (state.activeTimeframe && state.activeTimeframe !== '1Y') {
      params.set('timeframe', state.activeTimeframe);
    }
    const qs = params.toString();
    router.navigate(`/performance${qs ? `?${qs}` : ''}`);
    closeSidebarMobile();
  };

  const handleAllClick = () => {
    if (allCheckbox) {
      allCheckbox.checked = true;
    }
    document.querySelectorAll('.filter-cat-checkbox').forEach(cb => {
      cb.checked = false;
    });
    state.selectedCategories.clear();
    state.selectedAccountId = null;
    navigatePerformance();
  };

  allCheckbox?.addEventListener('change', handleAllClick);

  // Category Checkboxes
  document.querySelectorAll('.filter-cat-checkbox').forEach(cb => {
    const handleCategoryToggle = () => {
      state.selectedAccountId = null;
      const checkedBoxes = document.querySelectorAll('.filter-cat-checkbox:checked');
      const selectedSet = new Set();
      checkedBoxes.forEach(box => selectedSet.add(box.value));
      state.selectedCategories = selectedSet;

      // If Real Estate is the only selected category, route to /real-estate
      if (state.selectedCategories.size === 1 && state.selectedCategories.has('Real Estate')) {
        router.navigate('/real-estate');
        closeSidebarMobile();
      } else {
        navigatePerformance();
      }
    };

    cb.addEventListener('change', handleCategoryToggle);
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
  renderSidebarFilters();
  renderSidebarAccountsList();
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

  // 3. Filter category checkboxes sync
  const catParam = params.get('categories');
  const activeCats = new Set(catParam ? catParam.split(',').filter(Boolean) : []);
  if (isRealEstate) activeCats.add('Real Estate');

  const allCheckbox = document.getElementById('filter-all-checkbox');
  const isAll = (path === '/performance' && activeCats.size === 0 && !params.get('accounts'));
  if (allCheckbox) allCheckbox.checked = isAll;

  const allRow = document.querySelector('.filter-item-row[data-filter="all"]');
  if (allRow) allRow.classList.toggle('active', isAll);

  document.querySelectorAll('.filter-cat-checkbox').forEach(cb => {
    const val = cb.value;
    const isChecked = activeCats.has(val);
    cb.checked = isChecked;
    cb.closest('.filter-item-row')?.classList.toggle('active', isChecked);
  });

  // 4. Active account in list
  const activeAccId = params.get('id') || params.get('accounts');
  document.querySelectorAll('.sidebar-account-item').forEach(item => {
    const accId = item.getAttribute('data-account-id');
    item.classList.toggle('active', accId === activeAccId);
  });
}

export function renderSidebarFilters() {
  const counts = {
    'Retirement': 0,
    'Taxable Brokerage': 0,
    'IRAs': 0,
    'Emergency Savings': 0,
    'Real Estate': 0,
    'Debt': 0
  };

  (state.accounts || []).forEach(a => {
    const cat = a.category_group;
    if (counts[cat] !== undefined) {
      counts[cat]++;
    } else if (cat === 'Debt' || cat === 'Mortgages' || a.account_class === 'liability') {
      counts['Debt']++;
    }
  });

  const elRet = document.getElementById('count-Retirement');
  if (elRet) elRet.textContent = counts['Retirement'];

  const elBrok = document.getElementById('count-Taxable-Brokerage');
  if (elBrok) elBrok.textContent = counts['Taxable Brokerage'];

  const elIra = document.getElementById('count-IRAs');
  if (elIra) elIra.textContent = counts['IRAs'];

  const elEmg = document.getElementById('count-Emergency-Savings');
  if (elEmg) elEmg.textContent = counts['Emergency Savings'];

  const elRe = document.getElementById('count-Real-Estate');
  if (elRe) elRe.textContent = counts['Real Estate'];

  const elDebt = document.getElementById('count-Debt');
  if (elDebt) elDebt.textContent = counts['Debt'];
}

export function renderSidebarAccountsList() {
  const container = document.getElementById('sidebar-accounts-list');
  const countBadge = document.getElementById('sidebar-accounts-count');

  if (countBadge) countBadge.textContent = (state.accounts || []).length;
  if (!container) return;

  if (!state.accounts || state.accounts.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 1.5rem 0.5rem; color: var(--text-dim); font-size: 0.8rem;">
        No accounts added yet.<br>Click below to connect or add an account.
      </div>
    `;
    return;
  }

  container.innerHTML = state.accounts.map(a => {
    const isLiability = a.account_class === 'liability';

    return `
      <div class="sidebar-account-item" data-account-id="${a.id}" onclick="window.dispatchEvent(new CustomEvent('invest:navigate-account', { detail: { accountId: '${a.id}' } }))">
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
}
