const fs = require('fs'), path = require('path'), { randomUUID } = require('crypto');
function readHistory(file) {
  try {
    if (fs.statSync(file).size > 5 * 1024 * 1024) throw new Error('History file is too large.');
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row.client !== 'string' || !row.client.trim() || typeof row.deviceId !== 'string' || !/^[a-f0-9]{64}$/.test(row.deviceId) || typeof row.issuedAt !== 'string' || !Number.isFinite(Date.parse(row.issuedAt)) || typeof row.path !== 'string' || !path.isAbsolute(row.path) || !/\.json$/i.test(row.path))) throw new Error('History file is invalid.');
    return rows;
  } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
function rememberLicense(file, record) {
  const rows = readHistory(file).filter(row => row.deviceId !== record.deviceId);
  rows.unshift(record);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify(rows, null, 2), { flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
module.exports = { readHistory, rememberLicense };
