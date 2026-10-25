const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert/strict');
const { generateKeyPairSync } = require('crypto');
const { issueLicense, readIssuedLicense } = require('../admin-license/issuer.cjs');
const { readHistory, rememberLicense } = require('../admin-license/history.cjs');
const { exportBackup, prepareRestore, restoreBackup } = require('../admin-license/backup.cjs');
const { validateLicense } = require('../dist-electron/license');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ynot-backup-test-'));
const keys = generateKeyPairSync('ed25519'), pub = keys.publicKey.export({type:'spki',format:'pem'});
const key = path.join(root,'key.pem');fs.writeFileSync(key,keys.privateKey.export({type:'pkcs8',format:'pem'}));
const sourceHistory=path.join(root,'source','history.json'), targetHistory=path.join(root,'target','history.json'), backup=path.join(root,'backup.json');
function issue(id, client) { const file=path.join(root,id+'.json');issueLicense(id.repeat(64),client,file,key,pub);return readIssuedLicense(file,pub); }
try {
  const a=issue('a','Studio A'), b=issue('b','Studio B'), c=issue('c','Studio C');
  const extraLicense=fs.readFileSync(c.path,'utf8');
  rememberLicense(sourceHistory,a);rememberLicense(sourceHistory,b);
  assert.equal(exportBackup(sourceHistory,backup,pub),2);
  assert(!fs.readFileSync(backup,'utf8').includes('PRIVATE KEY'));
  assert.throws(()=>exportBackup(sourceHistory,backup,pub),/EEXIST/);
  // Transfer succeeds without original license paths or the signing key.
  fs.unlinkSync(a.path);fs.unlinkSync(b.path);fs.unlinkSync(key);
  let plan=prepareRestore(targetHistory,backup,pub);assert.equal(plan.added,2);restoreBackup(targetHistory,plan);
  let rows=readHistory(targetHistory);assert.equal(rows.length,2);
  for(const row of rows){validateLicense(fs.readFileSync(row.path,'utf8'),row.deviceId,pub);assert(row.path.startsWith(path.dirname(targetHistory)));}
  plan=prepareRestore(targetHistory,backup,pub);assert.equal(plan.unchanged,2);restoreBackup(targetHistory,plan);assert.equal(readHistory(targetHistory).length,2);
  fs.unlinkSync(rows[0].path);plan=prepareRestore(targetHistory,backup,pub);assert.equal(plan.repaired,1);restoreBackup(targetHistory,plan);
  const before=fs.readFileSync(targetHistory,'utf8');
  const broken=path.join(root,'broken.json'), archive=JSON.parse(fs.readFileSync(backup,'utf8'));
  const env=JSON.parse(archive.licenses[0]);env.signature='AAAA';
  fs.writeFileSync(broken,JSON.stringify({...archive,licenses:[JSON.stringify(env)]}));assert.throws(()=>prepareRestore(targetHistory,broken,pub));assert.equal(fs.readFileSync(targetHistory,'utf8'),before);
  fs.writeFileSync(broken,JSON.stringify({...archive,licenses:[archive.licenses[0],archive.licenses[0]]}));const duplicatePlan=prepareRestore(targetHistory,broken,pub);assert.equal(duplicatePlan.conflicts,2);assert(duplicatePlan.rows.every(row=>row.status==='conflict'));assert.throws(()=>restoreBackup(targetHistory,duplicatePlan),/Conflicting/);
  const conflict=readHistory(targetHistory);conflict[0].client='Another client';fs.writeFileSync(targetHistory,JSON.stringify(conflict));fs.writeFileSync(broken,JSON.stringify({...archive,licenses:[...archive.licenses,extraLicense]}));const conflictPlan=prepareRestore(targetHistory,broken,pub);assert.deepEqual(conflictPlan.rows.map(row=>row.status).sort(),['conflict','new','present']);assert.equal(conflictPlan.rows.find(row=>row.status==='conflict').current.client,'Another client');assert.throws(()=>restoreBackup(targetHistory,conflictPlan),/Conflicting/);fs.writeFileSync(targetHistory,before);
  const wrong=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'});assert.throws(()=>prepareRestore(path.join(root,'other.json'),backup,wrong));
  fs.writeFileSync(broken,'{');assert.throws(()=>prepareRestore(targetHistory,broken,pub));
  fs.writeFileSync(targetHistory,'corrupt');assert.throws(()=>prepareRestore(targetHistory,backup,pub));assert.equal(fs.readFileSync(targetHistory,'utf8'),'corrupt');fs.writeFileSync(targetHistory,before);
  plan=prepareRestore(path.join(root,'rollback','history.json'),backup,pub);
  const rename=fs.renameSync;fs.renameSync=()=>{throw new Error('Simulated disk error')};
  try { assert.throws(()=>restoreBackup(path.join(root,'rollback','history.json'),plan),/Simulated/); } finally { fs.renameSync=rename; }
  assert(!fs.existsSync(path.join(root,'rollback','history.json')));assert.equal(fs.readdirSync(path.join(root,'rollback','restored-licenses')).length,0);
  const stale=prepareRestore(targetHistory,backup,pub);fs.writeFileSync(targetHistory,JSON.stringify([...stale.current,{...stale.current[0],deviceId:'c'.repeat(64)}]));assert.throws(()=>restoreBackup(targetHistory,stale),/History changed/);fs.writeFileSync(targetHistory,before);
  rows=readHistory(targetHistory);fs.unlinkSync(rows[0].path);assert.throws(()=>exportBackup(targetHistory,path.join(root,'incomplete.json'),pub),/Cannot back up/);assert(!fs.existsSync(path.join(root,'incomplete.json')));
  console.log('Backup tests passed: transfer without key/source files, signed validation, merge, repeat restore, missing-file repair, tampering/duplicate/conflict rejection, corruption preservation and disk-failure rollback.');
} finally { fs.rmSync(root,{recursive:true,force:true}); }
