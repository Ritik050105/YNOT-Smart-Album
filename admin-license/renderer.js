const form = document.getElementById('form'), client = document.getElementById('client'), device = document.getElementById('device'), generate = document.getElementById('generate'), choose = document.getElementById('choose'), status = document.getElementById('status'), reveal = document.getElementById('reveal');
let ready = false, busy = false;
function update() { generate.disabled = busy || !ready || !client.value.trim() || !/^[a-f0-9]{64}$/i.test(device.value.trim()); choose.disabled = busy; document.getElementById('add-existing').disabled = busy; }
function show(message, kind = '') { status.textContent = message; status.className = kind; }
function applyKey(result) { ready = result.ready; document.getElementById('key-status').textContent = ready ? 'Signing key ready' : 'Signing key needed'; document.getElementById('key-path').textContent = result.path; if (result.error) show(result.error, 'error'); update(); }
form.addEventListener('input', update);
choose.addEventListener('click', async () => { busy = true; update(); try { show(''); applyKey(await window.licenseAdmin.chooseKey()); } catch { show('Unable to choose the signing key.', 'error'); } finally { busy = false; update(); } });
form.addEventListener('submit', async event => {
  event.preventDefault(); if (generate.disabled) return;
  busy = true; update(); reveal.hidden = true; show('');
  try { const result = await window.licenseAdmin.issue({ client: client.value, deviceId: device.value }); if (result.error) show(result.error, 'error'); else if (result.canceled) show('Save canceled. No license was created.'); else { show(result.warning || 'License saved: ' + result.path, result.warning ? 'error' : 'success'); reveal.hidden = false; } }
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
