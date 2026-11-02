const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {ExternalEditFiles}=require('../dist-electron/externalEdits');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ynot-download-sync-')),downloads=path.join(dir,'Downloads');await fs.mkdir(downloads);
 const file=path.join(dir,'unique-session-spread.png');await fs.writeFile(file,'original');const old=new Date(Date.now()-5000);await fs.utimes(file,old,old);
 const watch=new ExternalEditFiles();await watch.register(file,7,downloads);await fs.writeFile(path.join(downloads,'unrelated.png'),'wrong');assert.equal(await watch.read(file,7),null);
 const saved=path.join(downloads,'unique-session-spread (1).png');await fs.writeFile(saved,'edited');assert.equal(await watch.read(file,7),null);await new Promise(r=>setTimeout(r,800));
 const result=await watch.read(file,7);assert.equal(Buffer.from(result.data).toString(),'edited');assert.equal(result.sourcePath,saved);assert.equal(await watch.read(file,7,result.revision),null);await assert.rejects(watch.read(file,8));
 const next=path.join(downloads,'unique-session-spread (2).png');await fs.writeFile(next,'edited again');await new Promise(r=>setTimeout(r,800));assert.equal(Buffer.from((await watch.read(file,7,result.revision)).data).toString(),'edited again');
 console.log('PASS Canva Downloads: numbered saves, unrelated files ignored, stability, ownership and revisions');
})().catch(e=>{console.error(e);process.exitCode=1});
