// Imported templates: frame tracing from flattened artwork, and the review screen every import now
// goes through — including a layered PSD, whose text, rounded corners and background plate the
// review has to report before the designer accepts it.
const {app,BrowserWindow}=require('electron'),{build}=require('esbuild'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const fixture=`
import'./src/styles/app.css';import'./src/styles/editor.css';
import{detectTemplateFrames,detectCornerRadius,vectorMaskGeometry}from'./src/engine/templateGeometry';
import{importTemplateGeometry}from'./src/components/ImportTemplateGeometry';
import{importEditedPsd}from'./src/engine/importEditedPsd';
import{writePsdUint8Array}from'ag-psd';
import{createRoot}from'react-dom/client';
import TemplateThumb from'./src/components/TemplatePreview';
const summary=t=>t&&{photoCount:t.photoCount,kind:t.kind,textCount:t.textBoxes?.length??0,textContent:t.textBoxes?.[0]?.text,textColor:t.textBoxes?.[0]?.color,textAlign:t.textBoxes?.[0]?.align,radii:t.placeholders.map(p=>p.cornerRadiusPx??0),boxes:t.placeholders.map(p=>({x:p.x,y:p.y,width:p.width,height:p.height})),background:t.backgroundColor??null};
/** A filled rounded rectangle, so the corner-radius probe has transparent corners to measure. */
function roundedLayer(w,h,r){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.beginPath();x.roundRect(0,0,w,h,r);x.fill();return c}
window.run=async()=>{
 const c=document.createElement('canvas');c.width=600;c.height=400;const ctx=c.getContext('2d');
 ctx.fillStyle='white';ctx.fillRect(0,0,600,400);
 const blank=detectTemplateFrames(ctx.getImageData(0,0,600,400).data,600,400);
 ctx.fillStyle='red';for(const [x,y]of[[20,20],[310,20],[20,210],[310,210]])ctx.fillRect(x,y,270,170);
 const frames=detectTemplateFrames(ctx.getImageData(0,0,600,400).data,600,400);
 const square=document.createElement('canvas');square.width=80;square.height=60;square.getContext('2d').fillRect(0,0,80,60);
 const png=await new Promise(r=>c.toBlob(r));
 window.pngFile=new File([png],'layout.png',{type:'image/png'});
 const textLayer=document.createElement('canvas');textLayer.width=120;textLayer.height=30;
 const bg=document.createElement('canvas');bg.width=600;bg.height=400;const bgx=bg.getContext('2d');bgx.fillStyle='#204080';bgx.fillRect(0,0,600,400);
 // Plates first, the way Photoshop orders children bottom-up, and inside the group designers
 // actually use — which is what marks them as paper rather than a full-bleed photo.
 const psd=writePsdUint8Array({width:600,height:400,canvas:c,children:[
  {name:'Background',opened:true,children:[
   {name:'page',left:0,top:0,canvas:bg},
   {name:'Scenic Plate',left:0,top:0,canvas:bg},
  ]},
  {name:'one',left:20,top:30,canvas:roundedLayer(80,60,12)},
  // Starts off the left edge, the way an oversized cover photo does: the visible part is the only
  // part that is a frame, and it must not slide to the page edge on the way there.
  {name:'overhang',left:-60,top:120,canvas:roundedLayer(140,90,0)},
  {name:'two',left:310,top:210,canvas:square,hidden:true},
  {name:'title',left:40,top:360,canvas:textLayer,text:{text:'Hello Album',style:{fontSize:20,fillColor:{r:255,g:0,b:0}},paragraphStyle:{justification:'center'}}},
 ]});
 window.psdFile=new File([psd],'layered.psd',{type:'image/vnd.adobe.photoshop'});
 // A spread whose whole design is one full-bleed photo over two named page plates. The photo covers
 // the canvas, so an area rule alone reads it as more paper and the import finds no photo at all.
 const half=document.createElement('canvas');half.width=300;half.height=400;const hx=half.getContext('2d');hx.fillStyle='#101820';hx.fillRect(0,0,300,400);
 const full=document.createElement('canvas');full.width=600;full.height=400;const fx=full.getContext('2d');fx.fillStyle='#c08040';fx.fillRect(0,0,600,400);
 const bleed=writePsdUint8Array({width:600,height:400,canvas:c,children:[
  {name:'Background',opened:true,children:[{name:'BG left page',left:0,top:0,canvas:half},{name:'BG right page',left:300,top:0,canvas:half}]},
  {name:'Images',opened:true,children:[{name:'hero',left:0,top:0,canvas:full}]},
 ]});
 window.bleedFile=new File([bleed],'full-bleed.psd',{type:'image/vnd.adobe.photoshop'});
 const imported=await importEditedPsd(psd);
 return {blank,frames,squareRadius:detectCornerRadius(square),roundedRadius:detectCornerRadius(roundedLayer(80,60,12)),
  layers:imported.map(l=>({name:l.photo.fileName,hidden:l.hidden,frame:l.frame,width:l.photo.width}))};
};
window.start=which=>{window.error=null;window.result=importTemplateGeometry(which==='psd'?window.psdFile:which==='bleed'?window.bleedFile:window.pngFile).then(summary,e=>{window.error=String(e&&e.stack||e);return 'ERROR'})};
/** Renders a template thumbnail and reports where each cell actually landed, as a fraction. */
window.thumbCells=async template=>{
 const host=document.createElement('div');host.style.width='400px';document.body.append(host)
 createRoot(host).render(<TemplateThumb template={template} aspect={2} marginPx={40} gapPx={30}/>)
 await new Promise(r=>setTimeout(r,120))
 const box=host.querySelector('.template-thumb').getBoundingClientRect()
 const cells=[...host.querySelectorAll('.gallery-cell')].map(c=>{const r=c.getBoundingClientRect();return {x:(r.left-box.left)/box.width,width:r.width/box.width,radius:parseFloat(getComputedStyle(c).borderRadius),thumbWidth:box.width}})
 host.remove();return cells
};
window.vectorMaskGeometry=vectorMaskGeometry;
window.press=label=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label);if(!b)throw new Error('No button '+label+' in: '+[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).join(' | '));b.click()};
`;
app.disableHardwareAcceleration();app.whenReady().then(async()=>{
 const out=await fs.mkdtemp(path.join(app.getPath('temp'),'ynot-geometry-'));
 const result=await build({stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx',sourcefile:'fixture.tsx'},bundle:true,write:false,outdir:out,platform:'browser',jsx:'automatic',loader:{'.ttf':'dataurl','.png':'dataurl'}});
 await fs.writeFile(path.join(out,'fixture.js'),result.outputFiles.find(f=>f.path.endsWith('.js')).text);
 await fs.writeFile(path.join(out,'fixture.css'),result.outputFiles.find(f=>f.path.endsWith('.css'))?.text??'');
 await fs.writeFile(path.join(out,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="fixture.css"></head><body><script src="fixture.js"></script></body></html>');
 const win=new BrowserWindow({show:false,webPreferences:{backgroundThrottling:false}});await win.loadFile(path.join(out,'index.html'));
 const js=code=>win.webContents.executeJavaScript(code);
 /** The review mounts after an off-thread image decode, so poll rather than guess a delay. */
 const settle=async(label='Review imported template')=>{
  for(let i=0;i<60;i++){if((await js('document.body.textContent')).includes(label))return;await new Promise(r=>setTimeout(r,100))}
  throw new Error(`Review screen never appeared (${label}); last error: ${await js('window.error')}`)
 };

 const r=await js('run()');
 assert.equal(r.blank.length,0,'a blank reference yields no frames');
 assert.equal(r.frames.length,4,'four painted blocks yield four frames');
 assert.ok(Math.abs(r.frames[0].width-.45)<.001,'traced frame keeps its width');
 assert.equal(r.layers.length,6,'every PSD layer is readable');
 // By name, not index: the fixture's layer order is part of what it is testing.
 const layer=n=>r.layers.find(l=>(l.name??'').includes(n));
 assert.equal(layer('two')?.hidden,true,'a hidden layer is reported hidden');
 assert.equal(layer('one')?.width,80,'a layer keeps its own pixel width');
 assert.equal(r.squareRadius,0,'a square layer reports no corner radius');
 assert.ok(Math.abs(r.roundedRadius-12)<=4,`a 12px rounded layer measures close to 12 (got ${r.roundedRadius})`);

 // Knots copied from a real magazine PSD's shape layer: Photoshop puts an anchor on every square
 // corner, and two anchors `r` along the edges of a rounded one. The layer's own pixels are a plain
 // rectangle, so only the path knows the artwork rounds its top-left corner by 150px.
 const topLeftRounded=await js(`vectorMaskGeometry(${JSON.stringify([
  {points:[586.157,309.0,669.0,309.0,669.0,309.0]},
  {points:[2142.0,309.0,2142.0,309.0,2142.0,309.0]},
  {points:[2142.0,2746.0,2142.0,2746.0,2142.0,2746.0]},
  {points:[519.0,2746.0,519.0,2746.0,519.0,2746.0]},
  {points:[519.0,459.0,519.0,459.0,519.0,376.157]},
 ])})`);
 assert.deepEqual(topLeftRounded.radii,[150,0,0,0],`only the top-left corner is rounded (got ${JSON.stringify(topLeftRounded.radii)})`);
 assert.ok(Math.abs(topLeftRounded.x-519)<1&&Math.abs(topLeftRounded.width-1623)<1,'the path bounds give the frame box');
 // A shape that is not a rectangle has no corner radius to report.
 assert.equal(await js(`vectorMaskGeometry(${JSON.stringify([
  {points:[0,0,0,0,0,0]},{points:[100,50,100,50,100,50]},{points:[50,40,50,40,50,40]},{points:[0,100,0,100,0,100]},
 ])})`),null,'a non-rectangular path reports no radii');

 // A layered PSD now gets the same review screen as a flattened image, reporting what it found.
 await js(`start('psd')`);await settle();
 const body=await js('document.body.textContent');
 assert.ok(body.includes('Review imported template'),'the PSD import opens the review screen');
 assert.ok(body.includes('2 photo frames'),`the review reports both photo frames: ${body}`);
 assert.ok(body.includes('Hello Album'),'the review lists the detected text layer');
 assert.ok(body.includes('Background #204080'),`the review reports the detected page colour: ${body}`);
 await js(`press('Add mixed template')`);
 const psd=await js('result');
 assert.equal(psd.photoCount,2,'the page-sized plates are background, not photo frames');
 // -60 + 140 = 80 wide once the off-canvas part is cut, at x=0, y=120 of a 600x400 page.
 const overhang=psd.boxes.find(b=>Math.abs(b.y-120/400)<0.01);
 assert.ok(overhang,`the off-canvas layer is kept: ${JSON.stringify(psd.boxes)}`);
 assert.ok(Math.abs(overhang.x-0)<0.005,`it starts at the page edge (got ${overhang.x})`);
 assert.ok(Math.abs(overhang.width-80/600)<0.01,`only its visible 80px is the frame (got ${overhang.width*600})`);
 assert.equal(psd.kind,'mixed');assert.equal(psd.textCount,1);assert.equal(psd.textContent,'Hello Album');
 assert.equal(psd.textColor,'#ff0000','the text layer keeps its Photoshop fill colour');
 assert.equal(psd.textAlign,'center','the text layer keeps its Photoshop alignment');
 assert.ok(psd.radii[0]>0,'the rounded photo layer carries its corner radius into the frame');
 assert.equal(psd.background,'#204080','the background plate becomes the template page colour');

 // The full-bleed spread: its one photo must survive as a frame, not vanish into the background.
 await js(`start('bleed')`);await settle();
 await js(`press('Add image template')`);
 const bleed=await js('result');
 assert.equal(bleed.photoCount,1,`a full-bleed photo over named page plates stays a photo frame (got ${bleed.photoCount})`);
 assert.deepEqual(bleed.radii,[0],'a plain full-bleed photo has no corner radius');

 // Flattened artwork still offers the traced frames, and cancelling still resolves to null.
 await js(`start('png')`);await settle();
 const pngBody=await js('document.body.textContent');
 assert.ok(pngBody.includes('Add image template'),`a flattened import is offered as an image template: body=[${pngBody}] error=${await js('window.error')}`);
 await js(`press('Cancel')`);
 assert.equal(await js('result'),null,'cancelling the review imports nothing');
 // An imported design is absolute: its preview must place frames exactly where the artwork has them,
 // while an ordinary template is still re-flowed to the album's own margin and gap.
 const design={id:'psd-preview',name:'psd',photoCount:1,pageSide:'spread',isBuiltIn:false,absoluteFrames:true,
  createdAt:new Date(0).toISOString(),thumbnailColor:'#fff',placeholders:[{id:'f0',x:.25,y:.25,width:.5,height:.5,preferredOrientation:'any',cornerRadiusPx:90}]};
 const [absolute]=await js(`thumbCells(${JSON.stringify(design)})`);
 assert.ok(Math.abs(absolute.x-.25)<.005,`an imported design keeps its frame at x=0.25 (got ${absolute.x})`);
 assert.ok(Math.abs(absolute.width-.5)<.005,`an imported design keeps its frame width (got ${absolute.width})`);
 // The radius is authored in the 900px design space and drawn in cqw, so it must come out as that
 // same fraction of the thumbnail — if .template-thumb stops being the query container it resolves
 // against the viewport instead and balloons.
 assert.ok(Math.abs(absolute.radius - absolute.thumbWidth * 90 / 900) < 1,
  `a 90px design-space radius previews as 10% of the ${absolute.thumbWidth}px thumbnail (got ${absolute.radius}px)`);
 const [relative]=await js(`thumbCells(${JSON.stringify({...design,absoluteFrames:false,placeholders:[{...design.placeholders[0],cornerRadiusPx:undefined}]})})`);
 assert.ok(Math.abs(relative.x-.25)>.005,`an ordinary template is re-flowed to the album gap (got ${relative.x})`);

 console.log('PASS: frame tracing, corner-radius probe, PSD review with text colour/alignment/background/rounded corners, review cancellation, and absolute-vs-reflowed preview geometry');app.quit();
}).catch(e=>{console.error(e);app.exit(1)});
