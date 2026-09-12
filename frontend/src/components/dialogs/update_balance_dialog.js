/**
 * Update Balance Dialog Component (Valuation / Contribution Update)
 */
import { apiFetch } from '../../api.js';
import { formatCurrency } from '../../utils/formatters.js';

let currentModalPrevVal = 0.0;

export function getUpdateBalanceDialogHtml() {
  return `
    <!-- UPDATE BALANCE / LOAN PAYMENT MODAL -->
    <div id="modal-valuation" class="modal-backdrop hidden">
      <div class="modal-card glass-modal">
        <div class="modal-header">
          <h2 id="valuation-modal-title">Update Balance</h2>
          <button type="button" class="btn-close modal-close-btn">&times;</button>
        </div>

        <form id="form-valuation" class="modal-form">
          <input type="hidden" id="valuation-account-id">

          <div class="form-group">
            <label for="valuation-amount">New Valuation or Current Balance ($)</label>
            <input type="number" step="0.01" id="valuation-amount" class="form-input" required>
          </div>

          <div class="form-group" id="valuation-contribution-group">
            <label for="valuation-contribution">Net Contribution / Deposit ($)</label>
            <input type="number" step="0.01" id="valuation-contribution" class="form-input" placeholder="0.00" value="0.00">
            <span class="form-hint" style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.25rem; display: block;">
              External deposits or withdrawals in this update (excluded from gains and growth).
            </span>
          </div>

          <div class="form-group">
            <label for="valuation-date">Effective Date</label>
            <input type="date" id="valuation-date" class="form-input">
          </div>

          <div class="form-group">
            <label for="valuation-note">Note / Appraisal Reference</label>
            <input type="text" id="valuation-note" class="form-input" placeholder="e.g. Spring 2026 Home Appraisal, Monthly Paydown">
          </div>

          <!-- Live Breakdown Preview -->
          <div id="valuation-breakdown-card" class="glass-card" style="padding: 0.75rem 1rem; margin-bottom: 1rem; background: rgba(255,255,255,0.03); border-radius: var(--radius-sm);">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
              <span style="color: var(--text-muted);">Current Balance:</span>
              <span id="val-preview-prev" style="font-weight: 600;">$0.00</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.25rem;">
              <span style="color: var(--text-muted);">Net Contribution:</span>
              <span id="val-preview-contrib" style="font-weight: 600;">$0.00</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; border-top: 1px solid var(--border-glass); padding-top: 0.35rem; margin-top: 0.35rem;">
              <span style="color: var(--text-muted);">Implied Valuation Gain / Interest:</span>
              <span id="val-preview-gain" style="font-weight: 700; color: var(--accent-green);">+$0.00</span>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary modal-close-btn">Cancel</button>
            <button type="submit" class="btn btn-primary btn-glow">Log Update</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function openValuationModal(accountId, currentValue, title = 'Update Balance', accountClass = null) {
  const modal = document.getElementById('modal-valuation');
  if (!modal) return;

  currentModalPrevVal = parseFloat(currentValue) || 0.0;
  document.getElementById('valuation-modal-title').textContent = title;
  document.getElementById('valuation-account-id').value = accountId;
  document.getElementById('valuation-amount').value = currentValue || '';

  const contribInput = document.getElementById('valuation-contribution');
  if (contribInput) contribInput.value = '0.00';

  const contribGroup = document.getElementById('valuation-contribution-group');
  if (contribGroup) {
    const isLiability = accountClass === 'liability' || title.toLowerCase().includes('mortgage') || title.toLowerCase().includes('loan') || title.toLowerCase().includes('payment');
    contribGroup.style.display = isLiability ? 'none' : 'block';
  }

  document.getElementById('valuation-date').value = new Date().toISOString().split('T')[0];
  const noteEl = document.getElementById('valuation-note');
  if (noteEl) noteEl.value = '';

  updateValuationBreakdownPreview();
  modal.classList.remove('hidden');
}

function updateValuationBreakdownPreview() {
  const amountEl = document.getElementById('valuation-amount');
  const contribEl = document.getElementById('valuation-contribution');
  const prevEl = document.getElementById('val-preview-prev');
  const contribPreviewEl = document.getElementById('val-preview-contrib');
  const gainEl = document.getElementById('val-preview-gain');
  if (!prevEl || !gainEl) return;

  const newVal = parseFloat(amountEl?.value) || 0.0;
  const contribVal = parseFloat(contribEl?.value) || 0.0;
  const prevVal = currentModalPrevVal;

  prevEl.textContent = formatCurrency(prevVal);
  if (contribPreviewEl) contribPreviewEl.textContent = formatCurrency(contribVal);

  const totalDelta = newVal - prevVal;
  const impliedGain = totalDelta - contribVal;

  const sign = impliedGain >= 0 ? '+' : '';
  gainEl.textContent = `${sign}${formatCurrency(impliedGain)}`;
  gainEl.style.color = impliedGain >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
}

export function setupUpdateBalanceDialog() {
  document.getElementById('valuation-amount')?.addEventListener('input', updateValuationBreakdownPreview);
  document.getElementById('valuation-contribution')?.addEventListener('input', updateValuationBreakdownPreview);

  document.getElementById('form-valuation')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const accId = document.getElementById('valuation-account-id').value;
    const amount = parseFloat(document.getElementById('valuation-amount').value);
    const contrib = parseFloat(document.getElementById('valuation-contribution')?.value) || 0.0;
    const date = document.getElementById('valuation-date').value;
    const note = document.getElementById('valuation-note')?.value.trim() || null;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      let isoDate;
      if (!date || date === todayStr) {
        isoDate = new Date().toISOString();
      } else {
        isoDate = new Date(date + 'T12:00:00').toISOString();
      }

      await apiFetch('/accounts/valuations', {
        method: 'POST',
        body: JSON.stringify({
          account_id: accId,
          new_balance: amount,
          contribution: contrib,
          date: isoDate,
          note
        })
      });

      document.getElementById('modal-valuation')?.classList.add('hidden');
      window.dispatchEvent(new CustomEvent('invest:refresh-all-data'));
    } catch (err) {
      alert(`Error recording valuation: ${err.message}`);
    }
  });
}
