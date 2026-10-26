const assert = require('assert/strict');
const {generateKeyPairSync,sign} = require('crypto');
const {validateLicense,deviceId} = require('../dist-electron/license');
const keys=generateKeyPairSync('ed25519');
const pub=keys.publicKey.export({type:'spki',format:'pem'});
const device='a'.repeat(64);
const payload={version:1,product:'com.ynotphotography.albumstudio',deviceId:device,client:'Test client'};
const envelope=(data,key=keys.privateKey)=>{const bytes=Buffer.from(JSON.stringify(data));return JSON.stringify({payload:bytes.toString('base64'),signature:sign(null,bytes,key).toString('base64')})};
const good=envelope(payload);
assert.doesNotThrow(()=>validateLicense(good,device,pub));
assert.throws(()=>validateLicense(good,'b'.repeat(64),pub));
assert.throws(()=>validateLicense(envelope({...payload,product:'other'}),device,pub));
assert.throws(()=>validateLicense(envelope({...payload,version:2}),device,pub));
assert.throws(()=>validateLicense(envelope({...payload,client:''}),device,pub));
assert.throws(()=>validateLicense(envelope(payload,generateKeyPairSync('ed25519').privateKey),device,pub));
const tampered=JSON.parse(good);tampered.payload=Buffer.from(JSON.stringify({...payload,client:'Tampered'})).toString('base64');
assert.throws(()=>validateLicense(JSON.stringify(tampered),device,pub));
for(const raw of ['{','null','{}','x'.repeat(16385)])assert.throws(()=>validateLicense(raw,device,pub));
if(process.platform==='win32'){const id=deviceId();assert.match(id,/^[a-f0-9]{64}$/);assert.equal(deviceId(),id)}
console.log('Offline license: valid signature accepted; wrong PC, wrong issuer, tampering, invalid input rejected; device identity stable.');

const {macDeviceId}=require('../dist-electron/license');
const macUUID='12345678-1234-1234-1234-123456789abc';
assert.equal(macDeviceId('"IOPlatformUUID" = "'+macUUID+'"'),macDeviceId('"IOPlatformUUID" = "'+macUUID.toUpperCase()+'"'));
assert.notEqual(macDeviceId('"IOPlatformUUID" = "'+macUUID+'"'),macDeviceId('"IOPlatformUUID" = "22345678-1234-1234-1234-123456789abc"'));
for(const value of ['', '"IOPlatformUUID" = "00000000-0000-0000-0000-000000000000"','"IOPlatformUUID" = "invalid"'])assert.throws(()=>macDeviceId(value));
console.log('Mac identity parser: stable case-independent ID, different Macs isolated, invalid identities rejected');
