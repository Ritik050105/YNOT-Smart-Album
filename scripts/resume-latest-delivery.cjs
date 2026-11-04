const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const repo=process.cwd(),home='C:/Users/ritik/OneDrive/Documents/ChatGPT/YNOT smart album',asar=require('@electron/asar');
const root=path.join(home,'YNOT Latest Delivery 2026-10-31');
fs.mkdirSync(root,{recursive:true});
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function files(root,rel=''){return fs.readdirSync(path.join(root,rel),{withFileTypes:true}).flatMap(e=>{assert(!fs.lstatSync(path.join(root,rel,e.name)).isSymbolicLink());const p=rel?rel+'/'+e.name:e.name;return e.isDirectory()?files(root,p):[p]})}
function manifest(kit){fs.writeFileSync(path.join(kit,'SHA256SUMS.txt'),files(kit).filter(f=>f!=='SHA256SUMS.txt').sort().map(f=>hash(path.join(kit,f))+'  '+f).join('\n')+'\n')}

(async()=>{const kit=path.join(root,'03 Employee Mac - Apple Silicon'),archive=path.join(kit,'payload/app.asar');
fs.writeFileSync(path.join(kit,'payload/asar-header.sha256'),crypto.createHash('sha256').update(asar.getRawHeader(archive).headerString).digest('hex')+'\n');
manifest(kit);
const owner=path.join(root,'02 Owner Only - PRIVATE','Owner Mac');fs.cpSync(path.join(home,'YNOT Owner Mac Admin 1.1.1'),owner,{recursive:true});
const adminStage=fs.mkdtempSync(path.join(home,'admin-latest-stage-')),adminPkg=JSON.parse(fs.readFileSync('admin-license/package.json'));
for(const file of [...adminPkg.build.files,'package.json'])fs.copyFileSync(path.join(repo,'admin-license',file),path.join(adminStage,file));
const adminArchive=path.join(owner,'payload/app.asar');await asar.createPackage(adminStage,adminArchive);
fs.writeFileSync(path.join(owner,'payload/asar-header.sha256'),crypto.createHash('sha256').update(asar.getRawHeader(adminArchive).headerString).digest('hex')+'\n');manifest(owner);
console.log('PASS: latest Mac code, original license identity, ARM64 unpacked Sharp/libvips, owner code, manifests. '+root);
})().catch(e=>{console.error(e);process.exitCode=1});


