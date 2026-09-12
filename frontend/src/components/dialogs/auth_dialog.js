/**
 * Auth Dialog Component (Sign In / Register)
 */
import { state, setToken, setUser } from '../../state.js';
import { apiFetch } from '../../api.js';

export function getAuthDialogHtml() {
  return `
    <!-- AUTH MODAL -->
    <div id="modal-auth" class="modal-backdrop hidden">
      <div class="modal-card glass-modal">
        <div class="modal-header">
          <div class="brand" style="margin-bottom: 0.5rem;">
            <div class="brand-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3v18h18" stroke-linecap="round"/>
                <path d="M18 9l-5 5-4-4-6 6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="brand-text">
              <span class="brand-title">INVEST<span class="highlight">TRACKER</span></span>
            </div>
          </div>
          <h2 id="auth-modal-title">Sign In to InvestTracker</h2>
          <p class="subtext">Access your private self-hosted portfolio intelligence</p>
        </div>

        <div id="auth-error-msg" class="badge-pill red hidden" style="margin-bottom: 1rem; width: 100%; text-align: center;"></div>

        <form id="form-auth" class="modal-form">
          <div class="form-group">
            <label for="auth-username">Username</label>
            <input type="text" id="auth-username" class="form-input" placeholder="admin" required autocomplete="username">
          </div>

          <div class="form-group">
            <label for="auth-password">Password</label>
            <input type="password" id="auth-password" class="form-input" placeholder="••••••••" required autocomplete="current-password">
          </div>

          <div class="form-actions">
            <button type="submit" id="auth-submit-btn" class="btn btn-primary btn-block btn-glow">Sign In</button>
          </div>
        </form>

        <div class="modal-footer">
          <span id="auth-switch-prompt">Don't have an account?</span>
          <button type="button" id="btn-toggle-auth-mode" class="link-btn">Create one</button>
        </div>
      </div>
    </div>
  `;
}

export function showAuthModal() {
  document.getElementById('modal-auth')?.classList.remove('hidden');
}

export function hideAuthModal() {
  document.getElementById('modal-auth')?.classList.add('hidden');
}

export function setupAuthDialog() {
  const toggleBtn = document.getElementById('btn-toggle-auth-mode');
  toggleBtn?.addEventListener('click', () => {
    state.isAuthRegisterMode = !state.isAuthRegisterMode;
    const title = document.getElementById('auth-modal-title');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchPrompt = document.getElementById('auth-switch-prompt');

    if (state.isAuthRegisterMode) {
      if (title) title.textContent = 'Create Master Account';
      if (submitBtn) submitBtn.textContent = 'Register & Initialize';
      if (switchPrompt) switchPrompt.textContent = 'Already have an account?';
      if (toggleBtn) toggleBtn.textContent = 'Sign In';
    } else {
      if (title) title.textContent = 'Sign In to InvestTracker';
      if (submitBtn) submitBtn.textContent = 'Sign In';
      if (switchPrompt) switchPrompt.textContent = "Don't have an account?";
      if (toggleBtn) toggleBtn.textContent = 'Create one';
    }
  });

  document.getElementById('form-auth')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('auth-username').value.trim();
    const p = document.getElementById('auth-password').value;
    const errBanner = document.getElementById('auth-error-msg');
    errBanner?.classList.add('hidden');

    const endpoint = state.isAuthRegisterMode ? '/auth/register' : '/auth/login';

    try {
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username: u, password: p })
      });

      setToken(data.access_token);
      state.user = await apiFetch('/auth/me');
      setUser(state.user);
      hideAuthModal();

      window.dispatchEvent(new CustomEvent('invest:refresh-all-data'));
    } catch (err) {
      if (errBanner) {
        errBanner.textContent = err.message || 'Authentication failed';
        errBanner.classList.remove('hidden');
      }
    }
  });
}
