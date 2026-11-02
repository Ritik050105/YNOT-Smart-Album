const {build}=require('esbuild'),assert=require('node:assert/strict');
(async()=>{
 const code=await build({entryPoints:['src/engine/importWorkflow.ts'],bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'unused-import-decoder',setup(b){b.onResolve({filter:/^\.\/importPhotos$/},()=>({path:'decoder',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export function importPhotoFiles(){throw new Error("not used")}'}))}}]});
 const m={exports:{}};new Function('require','module','exports',code.outputFiles[0].text)(require,m,m.exports);
 const {dedupeImportedAssets}=m.exports;
 const photo=(id,text)=>({id,fileName:'same.jpg',width:10,height:10,src:URL.createObjectURL(new Blob([text]))});
 const a=photo('a','one'),b=photo('b','two'),c=photo('c','one');
 const result=await dedupeImportedAssets([b,c],[a]);assert.deepEqual(result.newAssets.map(p=>p.id),['b']);assert.equal(result.matchedAssets[1].id,'a');
 await dedupeImportedAssets([{...a,id:'shared'}],[a]);assert.equal(await(await fetch(a.src)).text(),'one');
 const failed={...a,id:'bad',src:'blob:missing'};assert.equal((await dedupeImportedAssets([failed],[a])).newAssets.length,1);
 for(const p of [a,b,c])URL.revokeObjectURL(p.src);
 console.log('PASS dedupe: different pixels retained, identical pixels deduplicated, shared source retained, failed reads not discarded');
})().catch(e=>{console.error(e);process.exitCode=1});
