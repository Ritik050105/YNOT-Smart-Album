const fs = require('fs'), path = require('path'), { randomUUID } = require('crypto');
const { readHistory, writeHistory } = require('./history.cjs');
const { parseIssuedLicense } = require('./issuer.cjs');
const LIMIT = 64 * 1024 * 1024;
function sameRecord(a, b) { return a.deviceId === b.deviceId && a.client === b.client && a.issuedAt === b.issuedAt; }
function licenseAt(row, publicKey) {
  if (fs.statSync(row.path).size > 16384) throw new Error('License file is too large.');
  const raw = fs.readFileSync(row.path, 'utf8');
  if (!sameRecord(row, parseIssuedLicense(raw, publicKey))) throw new Error('A saved license no longer matches its history record.');
  return raw;
}
function exportBackup(historyFile, output, publicKey) {
  const rows = readHistory(historyFile);
  if (rows.length > 10000) throw new Error('Backup exceeds 10,000 records.');
  const seen = new Set();
  const licenses = rows.map(row => {
    if (seen.has(row.deviceId)) throw new Error('History contains duplicate PC records.');
    seen.add(row.deviceId);
    try { return licenseAt(row, publicKey); }
    catch { throw new Error('Cannot back up ' + row.client + ': locate its missing or changed license using Add existing license first.'); }
  });
  const data = JSON.stringify({ format: 'ynot-license-backup', version: 1, createdAt: new Date().toISOString(), licenses }, null, 2);
  if (Buffer.byteLength(data) > LIMIT) throw new Error('Backup exceeds the 64 MB limit.');
  const fd = fs.openSync(output, 'wx');
  try { fs.writeFileSync(fd, data); }
  catch (error) { fs.closeSync(fd); fs.unlinkSync(output); throw error; }
  fs.closeSync(fd);
  return licenses.length;
}
function prepareRestore(historyFile, source, publicKey) {
  if (fs.statSync(source).size > LIMIT) throw new Error('Backup exceeds the 64 MB limit.');
  const archive = JSON.parse(fs.readFileSync(source, 'utf8'));
  if (!archive || archive.format !== 'ynot-license-backup' || archive.version !== 1 || !Array.isArray(archive.licenses) || archive.licenses.length > 10000) throw new Error('This is not a supported YNOT license backup.');
  const current = readHistory(historyFile);
  const existing = new Map(current.map(row => [row.deviceId, row]));
  if (existing.size !== current.length) throw new Error('Current history contains duplicate PC records.');
  const parsed = archive.licenses.map(raw => ({ raw, record: parseIssuedLicense(raw, publicKey) }));
  const counts = new Map();
  for (const { record } of parsed) counts.set(record.deviceId, (counts.get(record.deviceId) || 0) + 1);
  const entries = [], rows = [];
  let added = 0, repaired = 0, unchanged = 0, conflicts = 0;
  for (const { raw, record } of parsed) {
    const old = existing.get(record.deviceId);
    let reason = counts.get(record.deviceId) > 1 ? 'This PC appears more than once in the backup.' : '';
    if (!reason && old && !sameRecord(old, record)) reason = 'Employee name or issue date differs from the current record.';
    if (!reason && old && fs.existsSync(old.path)) {
      try {
        const original = JSON.parse(licenseAt(old, publicKey)), incoming = JSON.parse(raw);
        if (original.payload !== incoming.payload || original.signature !== incoming.signature) reason = 'The signed license differs from the saved file.';
      } catch { reason = 'The current license file is changed or cannot be verified.'; }
    }
    let status;
    if (reason) { conflicts++; status = 'conflict'; }
    else if (old && fs.existsSync(old.path)) { unchanged++; status = 'present'; }
    else {
      entries.push({ record, raw });
      if (old) { repaired++; status = 'repair'; } else { added++; status = 'new'; }
    }
    rows.push({ ...record, status, reason, current: old ? { client: old.client, issuedAt: old.issuedAt } : null });
  }
  return { current, entries, rows, added, repaired, unchanged, conflicts };
}
function restoreBackup(historyFile, plan) {
  if (plan.conflicts) throw new Error('Conflicting records must be resolved before restoring.');
  if (JSON.stringify(readHistory(historyFile)) !== JSON.stringify(plan.current)) throw new Error('History changed during restore. Please try again.');
  // Files use local generated names; no paths supplied by the backup are trusted.
  if (!plan.entries.length) return;
  const directory = path.join(path.dirname(historyFile), 'restored-licenses', randomUUID());
  const created = [];
  try {
    fs.mkdirSync(directory, { recursive: true });
    const merged = new Map(plan.current.map(row => [row.deviceId, row]));
    for (const { record, raw } of plan.entries) {
      const file = path.join(directory, record.deviceId + '.json');
      const fd = fs.openSync(file, 'wx');
      created.push(file);
      try { fs.writeFileSync(fd, raw); } finally { fs.closeSync(fd); }
      merged.set(record.deviceId, { ...record, path: file });
    }
    writeHistory(historyFile, [...merged.values()]);
  } catch (error) {
    for (const file of created) { try { fs.unlinkSync(file); } catch {} }
    try { fs.rmdirSync(directory); } catch {}
    throw error;
  }
}
module.exports = { exportBackup, prepareRestore, restoreBackup };
