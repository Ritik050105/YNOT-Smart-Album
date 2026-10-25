const form = document.getElementById('form'), employee = document.getElementById('employee'), device = document.getElementById('device'), generate = document.getElementById('generate'), choose = document.getElementById('choose'), status = document.getElementById('status'), reveal = document.getElementById('reveal');
let ready = false, busy = false;
function update() { generate.disabled = busy || !ready || !employee.value.trim() || !/^[a-f0-9]{64}$/i.test(device.value.trim()); choose.disabled = busy; document.getElementById('add-existing').disabled = busy; document.getElementById('backup').disabled = busy; document.getElementById('restore').disabled = busy; }
function show(message, kind = '') { status.textContent = message; status.className = kind; }
function applyKey(result) { ready = result.ready; document.getElementById('key-status').textContent = ready ? 'Signing key ready' : 'Signing key needed'; document.getElementById('key-path').textContent = result.path; if (result.error) show(result.error, 'error'); update(); }
form.addEventListener('input', update);
choose.addEventListener('click', async () => { busy = true; update(); try { show(''); applyKey(await window.licenseAdmin.chooseKey()); } catch { show('Unable to choose the signing key.', 'error'); } finally { busy = false; update(); } });
form.addEventListener('submit', async event => {
  event.preventDefault(); if (generate.disabled) return;
  busy = true; update(); reveal.hidden = true; show('');
  try { const result = await window.licenseAdmin.issue({ client: employee.value, deviceId: device.value }); if (result.error) show(result.error, 'error'); else if (result.canceled) show('Save canceled. No license was created.'); else { show(result.warning || 'License saved: ' + result.path, result.warning ? 'error' : 'success'); reveal.hidden = false; } }
  catch { show('Unable to generate the license. Please try again.', 'error'); }
  finally { busy = false; update(); await loadHistory(); }
});
reveal.addEventListener('click', () => window.licenseAdmin.reveal());
window.licenseAdmin.keyStatus().then(applyKey).catch(() => show('Unable to read the signing key.', 'error'));

let historyRows = [];
const historyList = document.getElementById('history-list'), historyStatus = document.getElementById('history-status'), historySearch = document.getElementById('history-search');
function renderHistory() {
  historyList.replaceChildren();
  const search = historySearch.value.trim().toLowerCase();
  const rows = historyRows.filter(row => (row.client + ' ' + row.deviceId).toLowerCase().includes(search));
  historyStatus.textContent = rows.length ? `${rows.length} saved license${rows.length === 1 ? '' : 's'}` : historyRows.length ? 'No matching licenses.' : 'No licenses recorded yet. Add earlier license files to include them here.';
  for (const row of rows) {
    const article = document.createElement('article'); article.className = 'history-row';
    const name = document.createElement('h3'); name.textContent = row.client;
    const id = document.createElement('code'); id.textContent = row.deviceId;
    const date = document.createElement('p'); date.textContent = 'Issued: ' + new Date(row.issuedAt).toLocaleString();
    const file = document.createElement('p'); file.textContent = (row.missing ? 'File missing: ' : '') + row.path; if (row.missing) file.className = 'missing';
    const actions = document.createElement('div'); actions.className = 'history-actions';
    for (const [label, reveal] of [['Open license', false], ['Show in folder', true]]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.disabled = row.missing;
      button.addEventListener('click', async () => {
        try { const result = await window.licenseAdmin.historyFile(row.deviceId, reveal); if (result.error) show(result.error, 'error'); }
        catch { show('Could not open the saved license.', 'error'); }
        await loadHistory();
      }); actions.append(button);
    }
    article.append(name, id, date, file, actions); historyList.append(article);
  }
}
async function loadHistory() {
  try {
    const result = await window.licenseAdmin.history();
    if (result.error) { historyStatus.textContent = result.error; return; }
    historyRows = result.rows; renderHistory();
  } catch { historyStatus.textContent = 'Could not load license history.'; }
}
historySearch.addEventListener('input', renderHistory);
document.getElementById('add-existing').addEventListener('click', async () => {
  busy = true; update();
  try { const result = await window.licenseAdmin.addExisting(); if (result.error) show(result.error, 'error'); else if (!result.canceled) show('Existing license added to history.', 'success'); await loadHistory(); }
  catch { show('Could not add the existing license.', 'error'); }
  finally { busy = false; update(); }
});
loadHistory();

for (const operation of ['backup', 'restore']) {
  document.getElementById(operation).addEventListener('click', async () => {
    if (busy) return;
    busy = true; update();
    const transferStatus = document.getElementById('transfer-status');
    transferStatus.textContent = '';
    try {
      const result = await window.licenseAdmin[operation]();
      if (result.preview) openRestorePreview(result.preview);
      else transferStatus.textContent = result.error || (result.canceled ? 'Canceled. No files or history changed.' : result.message);
      transferStatus.className = result.error ? 'missing' : '';
      await loadHistory();
    } catch { transferStatus.textContent = 'The operation could not be completed. Please try again.'; }
    finally { busy = document.getElementById('restore-preview').open; update(); }
  });
}

const previewDialog = document.getElementById('restore-preview'), previewApply = document.getElementById('preview-apply'), previewCancel = document.getElementById('preview-cancel');
const previewFilter = document.getElementById('preview-attention-only'), previewSearch = document.getElementById('preview-search');
function filterRestorePreview() {
  const rows = document.querySelectorAll('#preview-list .preview-row');
  document.getElementById('preview-clear-search').disabled = previewSearch.value.length === 0;
  document.getElementById('preview-reset-filters').disabled = !previewSearch.value.length && !previewFilter.checked;
  const query = previewSearch.value.trim().toLowerCase();
  let visible = 0;
  for (const row of rows) {
    row.hidden = (previewFilter.checked && !['new', 'conflict'].includes(row.dataset.status)) || !row.dataset.search.includes(query);
    if (!row.hidden) visible++;
  }
  document.getElementById('preview-visible-count').textContent = visible ? `Showing ${visible} of ${rows.length} records` : query ? 'No records match this search and filter. Clear the search or uncheck the filter.' : previewFilter.checked ? 'No new or conflicting records. Uncheck the filter to see all records.' : 'No records in this backup.';
}
previewFilter.addEventListener('change', filterRestorePreview);
previewSearch.addEventListener('input', filterRestorePreview);
document.getElementById('preview-clear-search').addEventListener('click', () => {
  previewSearch.value = '';
  filterRestorePreview();
  previewSearch.focus();
});
document.getElementById('preview-reset-filters').addEventListener('click', () => {
  previewSearch.value = '';
  previewFilter.checked = false;
  filterRestorePreview();
  previewSearch.focus();
});
function openRestorePreview(preview) {
  previewFilter.checked = false;
  previewSearch.value = '';
  document.getElementById('preview-summary').textContent = `${preview.added} new · ${preview.unchanged + preview.repaired} already present (${preview.repaired} missing files) · ${preview.conflicts} conflicting`;
  document.getElementById('preview-error').textContent = preview.conflicts ? 'Restore is blocked until conflicting records are resolved. Cancel to keep your current history unchanged.' : '';
  const list = document.getElementById('preview-list'); list.replaceChildren();
  for (const row of preview.rows) {
    const article = document.createElement('article'); article.className = 'preview-row'; article.dataset.status = row.status; article.dataset.search = (row.client + ' ' + row.deviceId + ' ' + (row.current?.client || '')).toLowerCase();
    const label = document.createElement('span'); label.className = 'preview-label'; label.textContent = {new:'New',present:'Already present',repair:'Already present · restore missing file',conflict:'Conflicting'}[row.status];
    const name = document.createElement('strong'); name.textContent = row.client;
    const pc = document.createElement('code'); pc.textContent = row.deviceId;
    const date = document.createElement('p'); date.textContent = 'Issued: ' + new Date(row.issuedAt).toLocaleString();
    article.append(label, name, pc, date);
    if (row.reason) { const reason = document.createElement('p'); reason.textContent = row.reason; article.append(reason); }
    if (row.status === 'conflict' && row.current) { const current = document.createElement('p'); current.textContent = `Current: ${row.current.client} · Issued: ${new Date(row.current.issuedAt).toLocaleString()}`; article.append(current); }
    list.append(article);
  }
  filterRestorePreview();
  previewApply.disabled = preview.conflicts > 0;
  previewDialog.showModal(); previewCancel.focus();
}
async function finishRestore(apply) {
  previewApply.disabled = true; previewCancel.disabled = true;
  try {
    const result = await window.licenseAdmin.finishRestore(apply);
    const status = document.getElementById('transfer-status'); status.textContent = result.error || (result.canceled ? 'Canceled. No files or history changed.' : result.message); status.className = result.error ? 'missing' : '';
    previewDialog.close(); await loadHistory();
  } catch { document.getElementById('preview-error').textContent = 'Could not finish restoring. Cancel and reopen the preview to try again.'; }
  finally { previewCancel.disabled = false; busy = previewDialog.open; update(); if (!busy) document.getElementById('restore').focus(); }
}
previewApply.addEventListener('click', () => finishRestore(true));
previewCancel.addEventListener('click', () => finishRestore(false));
previewDialog.addEventListener('cancel', event => { event.preventDefault(); if (!previewCancel.disabled) finishRestore(false); });
