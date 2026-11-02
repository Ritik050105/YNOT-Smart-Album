const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{pathToFileURL,fileURLToPath}=require('node:url');
const {buildSync}=require('esbuild');
const m={exports:{}};new Function('require','module','exports',buildSync({entryPoints:['electron/projectPackage.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text)(require,m,m.exports);
const {saveProjectPackage,readProjectPackage,copyProjectPackage}=m.exports;
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ynot-package-'));
 try {
  const source=path.join(dir,'original #100%.png');await fs.writeFile(source,Buffer.from('original image bytes'));
  const target=path.join(dir,'Album.ynot');
  const project={formatVersion:1,project:{photos:Array.from({length:500},(_,i)=>({id:String(i),fileName:'original #100%.png',src:pathToFileURL(source).href,sourcePath:source})),spreads:[{backgroundPattern:{src:pathToFileURL(source).href}}]},userTemplates:[]};
  await saveProjectPackage(target,JSON.stringify(project));
  assert.equal((await fs.readdir(target+'.assets')).length,1);
  assert.ok((await fs.stat(target)).size<150000);
  const opened=await readProjectPackage(target);assert.equal(JSON.parse(opened).project.spreads[0].backgroundPattern.src,JSON.parse(opened).project.photos[0].src);
  await saveProjectPackage(target,opened);assert.equal((await fs.readdir(target+'.assets')).length,1,'reopening and saving must reuse assets');
  assert.deepEqual(await fs.readFile(fileURLToPath(JSON.parse(opened).project.photos[0].src)),await fs.readFile(source));
  const second=path.join(dir,'Save As.ynot');await saveProjectPackage(second,opened);
  await fs.unlink(source);
  const moved=path.join(dir,'Moved.ynot');await fs.rename(second,moved);await fs.rename(second+'.assets',moved+'.assets');
  const relocated=JSON.parse(await readProjectPackage(moved));assert.equal((await fs.readFile(fileURLToPath(relocated.project.photos[0].src))).toString(),'original image bytes');
  const copy = await copyProjectPackage(dir, 'Summer / Wedding.ynot', opened);
  const copy2 = await copyProjectPackage(dir, 'Summer / Wedding.ynot', opened);
  assert.notEqual(copy, copy2, 'repeated copies must never overwrite');
  const copied = JSON.parse(await readProjectPackage(copy));
  assert.equal((await fs.readFile(fileURLToPath(copied.project.photos[0].src))).toString(), 'original image bytes');
  assert.ok(await fs.stat(path.join(path.dirname(copy), 'OPEN PROJECT.txt')));
  const foldersBefore = (await fs.readdir(dir)).sort();
  await assert.rejects(copyProjectPackage(dir, 'Failed copy', JSON.stringify(project)));
  assert.deepEqual((await fs.readdir(dir)).sort(), foldersBefore, 'failed copies leave no incomplete album folder');
  const before=await fs.readFile(target,'utf8');await assert.rejects(saveProjectPackage(target,JSON.stringify(project)));assert.equal(await fs.readFile(target,'utf8'),before,'failed save must retain previous metadata');
  relocated.project.photos[0].src='ynot-asset:../outside.png';await fs.writeFile(moved,JSON.stringify(relocated));await assert.rejects(readProjectPackage(moved));
  const legacy=path.join(dir,'legacy.ynot');const embedded={...project,project:{photos:[{src:'data:image/png;base64,YQ=='}],spreads:[]}};await fs.writeFile(legacy,JSON.stringify(embedded));assert.deepEqual(JSON.parse(await readProjectPackage(legacy)),embedded);
  console.log('PASS: 500 photo references, byte preservation, repeat save, Save As, relocation, failed-save preservation, traversal rejection and legacy projects');
 } finally {await fs.rm(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
