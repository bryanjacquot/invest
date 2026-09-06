/**
 * API Service for InvestTracker
 */
import { state, setToken, setUser } from './state.js';

// Route API calls: use port 3011 directly for local dev or relative /api behind Synology / Nginx
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? `${window.location.protocol}//${window.location.hostname}:3011/api`
  : '/api';

export async function apiFetch(endpoint, options = {}) {
  const headers = options.headers || {};
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Request failed with status ${res.status}`);
    }

    // Return blob if file download
    if (res.headers.get('content-type')?.includes('application/x-sqlite3')) {
      return res.blob();
    }

    return res.json();
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

function handleUnauthorized() {
  setToken(null);
  setUser(null);
  window.dispatchEvent(new CustomEvent('invest:show-auth-modal'));
}
