// Administrator-only tool. Never distribute the private signing key to clients.
const path = require('path');
const [deviceId, client, output, keyPath] = process.argv.slice(2);
if (!/^[a-f0-9]{64}$/.test(deviceId || '') || !client?.trim() || !output || !keyPath) {
  console.error('Usage: node scripts/issue-client-license.cjs <PC-ID> "Employee name" <new-license.json> <private-key.pem>');
  process.exit(1);
}
const { licensePublicKey } = require('../dist-electron/licensePublicKey');
require('../admin-license/issuer.cjs').issueLicense(deviceId, client, path.resolve(output), keyPath, licensePublicKey);
console.log('Signed license saved: '+path.resolve(output));
