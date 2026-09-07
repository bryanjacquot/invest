/**
 * Central State Store for InvestTracker
 */

export const state = {
  token: localStorage.getItem('invest_token') || null,
  user: null,
  accounts: [],
  selectedAccountIds: new Set(),
  activeTimeframe: '1Y',
  viewFormat: 'chart',
  isAuthRegisterMode: false,
  sidebarOpen: localStorage.getItem('invest_sidebar_open') !== 'false',
  metricUnit: localStorage.getItem('invest_metric_unit') || 'pct',
  activeRoute: '/overview',
  subTab: 'performance',
  charts: {
    performance: null,
    allocation: null
  }
};

const listeners = new Set();

export function subscribeState(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyStateChange(changedKeys = []) {
  listeners.forEach(fn => fn(state, changedKeys));
}

export function setToken(token) {
  state.token = token;
  if (token) {
    localStorage.setItem('invest_token', token);
  } else {
    localStorage.removeItem('invest_token');
  }
  notifyStateChange(['token']);
}

export function setUser(user) {
  state.user = user;
  notifyStateChange(['user']);
}

export function setAccounts(accounts) {
  state.accounts = accounts;
  notifyStateChange(['accounts']);
}

export function setSidebarOpen(isOpen) {
  state.sidebarOpen = isOpen;
  localStorage.setItem('invest_sidebar_open', isOpen ? 'true' : 'false');
  notifyStateChange(['sidebarOpen']);
}

export function setMetricUnit(unit) {
  state.metricUnit = unit;
  localStorage.setItem('invest_metric_unit', unit);
  notifyStateChange(['metricUnit']);
}
