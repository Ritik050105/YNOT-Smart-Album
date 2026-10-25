const form = document.getElementById('form'), client = document.getElementById('client'), device = document.getElementById('device'), generate = document.getElementById('generate'), choose = document.getElementById('choose'), status = document.getElementById('status'), reveal = document.getElementById('reveal');
let ready = false, busy = false;
function update() { generate.disabled = busy || !ready || !client.value.trim() || !/^[a-f0-9]{64}$/i.test(device.value.trim()); choose.disabled = busy; }
function show(message, kind = '') { status.textContent = message; status.className = kind; }
function applyKey(result) { ready = result.ready; document.getElementById('key-status').textContent = ready ? 'Signing key ready' : 'Signing key needed'; document.getElementById('key-path').textContent = result.path; if (result.error) show(result.error, 'error'); update(); }
form.addEventListener('input', update);
choose.addEventListener('click', async () => { busy = true; update(); try { show(''); applyKey(await window.licenseAdmin.chooseKey()); } catch { show('Unable to choose the signing key.', 'error'); } finally { busy = false; update(); } });
form.addEventListener('submit', async event => {
  event.preventDefault(); if (generate.disabled) return;
  busy = true; update(); reveal.hidden = true; show('');
  try { const result = await window.licenseAdmin.issue({ client: client.value, deviceId: device.value }); if (result.error) show(result.error, 'error'); else if (result.canceled) show('Save canceled. No license was created.'); else { show('License saved: ' + result.path, 'success'); reveal.hidden = false; } }
  catch { show('Unable to generate the license. Please try again.', 'error'); }
  finally { busy = false; update(); }
});
reveal.addEventListener('click', () => window.licenseAdmin.reveal());
window.licenseAdmin.keyStatus().then(applyKey).catch(() => show('Unable to read the signing key.', 'error'));
