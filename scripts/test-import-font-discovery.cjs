const {build}=require('esbuild'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto'),sharp=require('sharp');
(async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ynot-import-check-'));
await build({entryPoints:['electron/images.ts','electron/fontDiscovery.ts'],bundle:true,platform:'node',format:'cjs',outdir:dir,external:['sharp']});
// Resolve the installed Sharp runtime without copying native dependencies.
const Module=require('module');process.env.NODE_PATH=path.join(process.cwd(),'node_modules');Module._initPaths();
const {imagePreview}=require(path.join(dir,'images.js')),{FontDiscovery}=require(path.join(dir,'fontDiscovery.js'));
const pixels=crypto.randomBytes(4000*3000*3),original=path.join(dir,'original.png');await sharp(pixels,{raw:{width:4000,height:3000,channels:3}}).png().toFile(original);
const before=crypto.createHash('sha256').update(await fs.readFile(original)).digest('hex');const start=Date.now();let done=0,previewBytes=0;
await Promise.all([0,1].map(async()=>{while(done<300){done++;const p=await imagePreview(original);assert.equal(p.width,4000);assert.equal(p.height,3000);const bytes=Buffer.from(p.src.split(',')[1],'base64');const meta=await sharp(bytes).metadata();assert.equal(meta.width,1600);previewBytes+=bytes.length}}));
assert.equal(crypto.createHash('sha256').update(await fs.readFile(original)).digest('hex'),before);await assert.rejects(()=>imagePreview('relative.jpg'));
const fonts=path.join(dir,'fonts');await fs.mkdir(fonts);await fs.copyFile('src/assets/google-fonts/bangers/Bangers-Regular.ttf',path.join(fonts,'Bangers.ttf'));
const discovery=new FontDiscovery(path.join(dir,'cache.json'));await discovery.start([fonts]);assert.equal(discovery.status.fonts.length,1);assert.match(await discovery.read(path.join(fonts,'Bangers.ttf')),/^data:font\/ttf;base64,/);await assert.rejects(()=>discovery.read(original));const restored=new FontDiscovery(path.join(dir,'cache.json'));await restored.load();assert.equal(restored.status.fonts.length,1);
console.log(JSON.stringify({passed:true,images:300,originalBytes:(await fs.stat(original)).size,seconds:(Date.now()-start)/1000,averagePreviewBytes:Math.round(previewBytes/300),originalUnchanged:true,fontScanAndCache:true}));
})().catch(e=>{console.error(e);process.exitCode=1});

