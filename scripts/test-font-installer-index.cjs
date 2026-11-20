// The installer finds the fonts already on the computer (scripts/scan-local-fonts.cjs, run in the installer window) and the app adopts that list at its first start, together
// with the font files shipped inside the installer, so nothing needs scanning by hand: the scan script writes a whole list or none, the app keeps only fonts still on
// disk, the bundled folder is listed without a scan, and a running manual scan answers its status polls with a count.
const {build}=require('esbuild'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process')
;(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ynot-font-installer-'))
 await build({entryPoints:['electron/fontDiscovery.ts'],bundle:true,platform:'node',format:'cjs',outdir:dir})
 const {FontDiscovery}=require(path.join(dir,'fontDiscovery.js'))
 const sample='src/assets/google-fonts/bangers/Bangers-Regular.ttf'
 // Fonts "on the computer": one in a client folder, one inside a node_modules folder (skipped), one far too large (skipped).
 const client=path.join(dir,'client fonts'),junk=path.join(dir,'client fonts','node_modules','pkg')
 await fs.mkdir(junk,{recursive:true});await fs.copyFile(sample,path.join(client,'Billionaire.ttf'));await fs.copyFile(sample,path.join(junk,'Hidden.ttf'))
 await fs.writeFile(path.join(client,'Huge.ttf'),Buffer.alloc(11*1024*1024,1))
 const index=path.join(dir,'appdata','YNOT Album Studio','local-fonts.json')
 execFileSync(process.execPath,['scripts/scan-local-fonts.cjs',index],{env:{...process.env,YNOT_FONT_SCAN_ROOTS:client},stdio:'pipe'})
 const rows=JSON.parse(await fs.readFile(index,'utf8'))
 assert.deepEqual(rows.map(r=>r.family),['Billionaire'],'the installer scan keeps the font in the client folder and skips node_modules and oversized files')
 await assert.rejects(()=>fs.stat(index+'.tmp'),'no half-written list is left behind')
 // The app adopts it, minus anything that has since been deleted.
 const discovery=new FontDiscovery(path.join(dir,'cache.json'));await discovery.load()
 await fs.writeFile(index,JSON.stringify([...rows,{family:'Gone',path:path.join(client,'Gone.ttf')}]))
 await discovery.adopt(index)
 assert.equal(discovery.status.fonts.length,1);assert.ok(discovery.has(path.join(client,'Billionaire.ttf')),'the scanned font is allowed and loads straight from disk')
 assert.match(await discovery.read(path.join(client,'Billionaire.ttf')),/^data:font\/ttf;base64,/)
 // The fonts shipped inside the installer are listed without any scan.
 const shipped=path.join(dir,'resources','fonts','Brand');await fs.mkdir(shipped,{recursive:true});await fs.copyFile(sample,path.join(shipped,'Brand-Regular.otf'));await fs.writeFile(path.join(shipped,'README.txt'),'not a font')
 await discovery.addFolder(path.join(dir,'resources','fonts'))
 assert.deepEqual(discovery.status.fonts.map(f=>f.family).sort(),['Billionaire','Brand-Regular'])
 await discovery.addFolder(path.join(dir,'resources','no-such-folder'))
 await discovery.adopt(path.join(dir,'no-such-index.json'))
 assert.equal(discovery.status.fonts.length,2,'a missing bundled folder or installer index changes nothing')
 // A manual scan skips junk folders too.
 await discovery.start([client]);assert.ok(![...discovery.status.fonts].some(f=>/node_modules/.test(f.path)),'the manual scan also skips node_modules')
 // Both installers run the step: the Windows one in its wizard (a page and a scan, skipped by a silent install), the Mac kit through its INSTALL UPDATE script.
 const nsis=await fs.readFile('build/installer.nsh','utf8'),kit=await fs.readFile('scripts/assemble-employee-mac-kit.cjs','utf8'),pkg=JSON.parse(await fs.readFile('package.json','utf8'))
 assert.ok(/RunFontScan == "1"/.test(nsis)&&/scan-local-fonts.cjs/.test(nsis)&&/local-fonts.json/.test(nsis),'the Windows installer runs the font scan')
 assert.ok(/scan-local-fonts.cjs/.test(kit)&&/INSTALL UPDATE.command/.test(kit)&&/BUILD UPDATE.command/.test(kit)&&/local-fonts.json/.test(kit),'the Mac kit assembler adds the font step to its install scripts')
 assert.ok(pkg.build.extraResources.some(r=>r.to==='scan-local-fonts.cjs')&&pkg.build.extraResources.some(r=>r.to==='fonts'),'the scan script and the fonts folder are packed into the Windows installer')
 await fs.rm(dir,{recursive:true,force:true})
 console.log('Font installer index checks passed: the installer scan finds client fonts, the app adopts them and the shipped fonts with no scan, and junk folders are skipped, and both the Windows and Mac installers run the font step.')
})().catch(e=>{console.error(e);process.exitCode=1})
