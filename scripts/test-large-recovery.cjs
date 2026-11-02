const assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
function load(file){const m={exports:{}};new Function('require','module','exports',buildSync({entryPoints:[file],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text)(require,m,m.exports);return m.exports}
const {serializeProjectFile,deserializeProjectFile}=load('src/engine/projectFile.ts');
global.FileReader=class {readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result=`data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;this.onload()}).catch(e=>this.onerror(e))}};
(async()=>{
 const src=URL.createObjectURL(new Blob(['original bytes'],{type:'image/png'}));
 const photos=Array.from({length:500},(_,i)=>({id:String(i),src,sourcePath:`C:\\Photos\\photo ${i} #100%.png`}));
 const project={photos,spreads:[],size:{},name:'Recovery'};
 const recovered=deserializeProjectFile(await serializeProjectFile(project,[],true));
 assert.equal(recovered.project.photos.length,500);
 assert.equal(recovered.project.photos[0].src,'file:///C:/Photos/photo%200%20%23100%25.png');
 assert.ok(JSON.stringify(recovered).length<150000);
 assert.equal(await serializeProjectFile(recovered.project,[],true),JSON.stringify(recovered));
 const saved=JSON.parse(await serializeProjectFile({...project,photos:photos.slice(0,1)},[]));
 assert.equal(saved.project.photos[0].src,'data:image/png;base64,b3JpZ2luYWwgYnl0ZXM=');
 const edited=JSON.parse(await serializeProjectFile({...project,photos:[{...photos[0],src:'data:image/png;base64,ZWRpdGVk'}]},[],true));
 assert.equal(edited.project.photos[0].src,'data:image/png;base64,ZWRpdGVk');
 URL.revokeObjectURL(src);
 console.log('PASS recovery: 500 linked originals, escaped paths, repeated checkpoints, portable save and edited pixels preserved');
})().catch(e=>{console.error(e);process.exitCode=1});
