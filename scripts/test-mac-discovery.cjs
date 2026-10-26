const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {findMacEditor}=require('../dist-electron/externalEdits');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ynot-mac-discovery-'));
 for(const bundle of ['Canva.app','Adobe Photoshop 2026/Adobe Photoshop 2026.app']){
  const target=path.join(root,bundle);await fs.mkdir(path.join(target,'Contents'),{recursive:true});await fs.writeFile(path.join(target,'Contents','Info.plist'),'<plist/>');
  const editor=bundle.startsWith('Canva')?'Canva':'Photoshop';assert.equal(await findMacEditor(editor,'',[root]),target);assert.equal(await findMacEditor(editor,target,[]),target);
 }
 await assert.rejects(findMacEditor('Canva',path.join(root,'Missing.app'),[]));
 console.log('Mac bundle discovery passed: standard, versioned Adobe folder, configured bundle and missing-app rejection. Bundles were fixtures, not launched.');
})().catch(e=>{console.error(e);process.exitCode=1});
