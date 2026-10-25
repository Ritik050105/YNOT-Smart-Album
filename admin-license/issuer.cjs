const fs = require('fs');
const { sign, createPublicKey, verify } = require('crypto');

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
function readIssuedLicense(file, publicKey) {
  if (!require('path').isAbsolute(file) || !/\.json$/i.test(file) || fs.statSync(file).size > 16384) throw new Error('Choose a valid license JSON file.');
  const envelope = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!envelope || typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string') throw new Error('Invalid license file.');
  const bytes = Buffer.from(envelope.payload, 'base64');
  if (!verify(null, bytes, publicKey, Buffer.from(envelope.signature, 'base64'))) throw new Error('License signature is invalid.');
  const data = JSON.parse(bytes.toString('utf8'));
  if (data.version !== 1 || data.product !== 'com.ynotphotography.albumstudio' || !/^[a-f0-9]{64}$/.test(data.deviceId) || typeof data.client !== 'string' || !data.client.trim() || data.client.length > 200 || typeof data.issuedAt !== 'string' || !Number.isFinite(Date.parse(data.issuedAt))) throw new Error('License details are invalid.');
  return { client: data.client, deviceId: data.deviceId, issuedAt: data.issuedAt, path: file };
}
module.exports = { readSigningKey, issueLicense, readIssuedLicense };
