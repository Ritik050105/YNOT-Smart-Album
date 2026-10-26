const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict'),{spawnSync}=require('child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ynot-offline-installer-test-'));
fs.mkdirSync(path.join(root,'mock'));fs.mkdirSync(path.join(root,'home'));
fs.copyFileSync('offline-mac/INSTALL.command',path.join(root,'INSTALL.command'));
for(const [name,value] of [['uname','Darwin'],['sysctl','1']])fs.writeFileSync(path.join(root,'mock',name),'#!/bin/bash\necho '+value+'\n',{mode:0o755});
const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/bin/bash';
for(const role of ['owner','employee']){
 fs.writeFileSync(path.join(root,'INSTALL-ROLE.txt'),role+'\n');
 const r=spawnSync(bash,['-c','export PATH="$PWD/mock:$PATH"; export HOME="$PWD/home"; bash INSTALL.command </dev/null'],{cwd:root,encoding:'utf8'});
 assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/Missing offline Mac package/);assert.match(r.stderr,/No downloads will be attempted/);assert.equal(fs.readdirSync(path.join(root,'home')).length,0);
}
for(const file of ['offline-mac/INSTALL.command','offline-mac/PREPARE-OFFLINE-PACKAGES.command'])assert.equal(spawnSync(bash,['-n',file]).status,0);
console.log('PASS: both installer roles stop on missing local payload without changing applications; shell syntax valid.');
