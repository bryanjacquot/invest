/**
 * Settings & Database Backup Management Dialog Component
 */
import { apiFetch } from '../../api.js';

export function getSettingsDialogHtml() {
  return `
    <!-- DATABASE & BACKUP MODAL -->
    <div id="modal-settings" class="modal-backdrop hidden">
      <div class="modal-card glass-modal" style="max-width: 600px;">
        <div class="modal-header">
          <div>
            <h2>Database & Backup Management</h2>
            <p class="subtext">Export, snapshot, or restore your SQLite database</p>
          </div>
          <button type="button" class="btn-close modal-close-btn">&times;</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1.5rem; margin-top: 0.5rem;">
          <!-- Download Backup Box -->
          <div class="glass-card" style="padding: 1.25rem; background: rgba(31, 41, 55, 0.5);">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
              <div>
                <h4 style="font-size: 1rem; margin-bottom: 0.25rem;">Download Database Snapshot</h4>
                <p class="subtext">Generate an immediate, consistent .sqlite file of all your accounts and history.</p>
              </div>
              <button id="btn-download-backup" class="btn btn-primary btn-glow" type="button" style="white-space: nowrap;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download .sqlite
              </button>
            </div>
          </div>

          <!-- Restore Backup Box -->
          <div class="glass-card" style="padding: 1.25rem; background: rgba(31, 41, 55, 0.5);">
            <h4 style="font-size: 1rem; margin-bottom: 0.25rem;">Restore Database File</h4>
            <p class="subtext" style="margin-bottom: 1rem;">Upload a verified .sqlite backup file to restore complete portfolio state.</p>
            <form id="form-restore-backup" enctype="multipart/form-data">
              <div style="display: flex; gap: 0.75rem; align-items: center;">
                <input type="file" id="backup-file-input" accept=".sqlite,.db" required class="form-input" style="flex: 1;">
                <button type="submit" class="btn btn-secondary" style="white-space: nowrap;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Restore
                </button>
              </div>
            </form>
          </div>
        </div>

        <div class="form-actions" style="margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary modal-close-btn">Close</button>
        </div>
      </div>
    </div>
  `;
}

export function openSettingsModal() {
  document.getElementById('modal-settings')?.classList.remove('hidden');
}

export function setupSettingsDialog() {
  document.getElementById('btn-download-backup')?.addEventListener('click', async () => {
    try {
      const blob = await apiFetch('/backup/download');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invest_backup_${new Date().toISOString().slice(0, 10)}.sqlite`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Backup download failed: ${err.message}`);
    }
  });

  document.getElementById('form-restore-backup')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('backup-file-input');
    if (!fileInput.files || fileInput.files.length === 0) return;

    if (!confirm('Restoring will overwrite current database records. Proceed?')) return;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    try {
      await apiFetch('/backup/restore', {
        method: 'POST',
        body: formData
      });
      alert('Database restored successfully! Reloading...');
      window.location.reload();
    } catch (err) {
      alert(`Restore failed: ${err.message}`);
    }
  });
}
