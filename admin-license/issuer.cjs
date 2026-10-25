const fs = require('fs');
const { sign, createPublicKey } = require('crypto');

function readSigningKey(keyPath, publicKey) {
  if (fs.statSync(keyPath).size > 16384) throw new Error('Invalid signing key file.');
  const key = fs.readFileSync(keyPath, 'utf8');
  if (createPublicKey(key).export({ type: 'spki', format: 'pem' }) !== publicKey) throw new Error('This key does not match the client app. Choose the original signing key.');
  return key;
}
function issueLicense(deviceId, client, output, keyPath, publicKey) {
  if (typeof deviceId !== 'string' || !/^[a-f0-9]{64}$/i.test(deviceId.trim())) throw new Error('Paste the complete 64-character PC ID from the client app.');
  if (typeof client !== 'string' || !client.trim() || client.trim().length > 200) throw new Error('Enter a client name of 1–200 characters.');
  const key = readSigningKey(keyPath, publicKey);
  const bytes = Buffer.from(JSON.stringify({ version: 1, product: 'com.ynotphotography.albumstudio', deviceId: deviceId.trim().toLowerCase(), client: client.trim(), issuedAt: new Date().toISOString() }));
  fs.writeFileSync(output, JSON.stringify({ payload: bytes.toString('base64'), signature: sign(null, bytes, key).toString('base64') }, null, 2), { flag: 'wx' });
}
module.exports = { readSigningKey, issueLicense };
