const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ynot-sharp-config-')),file=path.join(dir,'package.json');
const config=JSON.parse(fs.readFileSync('package.json'));
config.build.mac.target=[{target:'dmg',arch:['x64','arm64']}];delete config.build.asarUnpack;
fs.writeFileSync(file,JSON.stringify(config));const before=fs.readFileSync(file,'utf8');
for(let i=0;i<2;i++)execFileSync(process.execPath,['mac-repair/fix-config.cjs',file]);
const fixed=JSON.parse(fs.readFileSync(file));assert.deepEqual(fixed.build.mac.target,['dmg']);assert.deepEqual(fixed.build.asarUnpack,['node_modules/sharp/**/*','node_modules/@img/**/*']);assert.equal(fs.readFileSync(file+'.before-sharp-fix','utf8'),before);
fs.writeFileSync(file,'{"name":"other"}');assert.throws(()=>execFileSync(process.execPath,['mac-repair/fix-config.cjs',file],{stdio:'pipe'}));assert.equal(fs.readFileSync(file,'utf8'),'{"name":"other"}');
console.log('PASS: native-only targets, both Sharp directories unpacked, idempotent patch, backup preserved, unrelated projects rejected.');
