// Administrator-only tool. Never distribute the private signing key to clients.
const fs = require('fs');
const { sign, createPublicKey } = require('crypto');
const path = require('path');
const [deviceId, client, output, keyPath] = process.argv.slice(2);
if (!/^[a-f0-9]{64}$/.test(deviceId || '') || !client?.trim() || !output || !keyPath) {
  console.error('Usage: node scripts/issue-client-license.cjs <PC-ID> "Client name" <new-license.json> <private-key.pem>');
  process.exit(1);
}
const key = fs.readFileSync(keyPath, 'utf8');
const { licensePublicKey } = require('../dist-electron/licensePublicKey');
if (createPublicKey(key).export({type:'spki',format:'pem'}) !== licensePublicKey) throw new Error('Signing key does not match this app build.');
const bytes = Buffer.from(JSON.stringify({version:1,product:'com.ynotphotography.albumstudio',deviceId,client:client.trim(),issuedAt:new Date().toISOString()}));
fs.writeFileSync(path.resolve(output), JSON.stringify({payload:bytes.toString('base64'),signature:sign(null,bytes,key).toString('base64')},null,2), {flag:'wx'});
console.log('Signed license saved: '+path.resolve(output));
