import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib'

const require = createRequire(import.meta.url)
const { createCanvas, Image, ImageData } = require(process.argv[2] || '@napi-rs/canvas')
globalThis.Image = Image
globalThis.ImageData = ImageData
const canvases = []
globalThis.document = { createElement(tag) {
  assert.equal(tag, 'canvas')
  const canvas = createCanvas(1, 1)
  canvas.toBlob = (callback, mime) => callback(new Blob([canvas.toBuffer(mime)]))
  canvases.push(canvas)
  return canvas
} }
const saved = []
globalThis.window = { albumStudio: { isElectron: true,
  pickDirectory: async () => ({ dirPath: 'test-output' }),
  writeFileInDir: async (file) => { saved.push(file) },
} }
const result = await build({ stdin: {
  contents: `export * from './src/engine/autoLayout'; export * from './src/engine/layoutMath'; export * from './src/engine/renderSpread'; export * from './src/engine/exportAlbum'; export * from './src/engine/exportUtil'; export * from './src/engine/exportPreflight'; export * from './src/engine/projectFile'; export * from './src/engine/importWorkflow'; export * from './src/engine/patterns'; export { buildSpreadPsdBytes } from './src/engine/exportPsd'; export { initializeCanvas, readPsd } from 'ag-psd'`,
  resolveDir: process.cwd(),
}, bundle: true, platform: 'node', format: 'esm', write: false, loader: { '.png': 'dataurl', '.icc': 'dataurl' } })
const engine = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
engine.initializeCanvas(createCanvas)
const catalogueBundle=await build({stdin:{contents:`export * from './src/engine/templates'; export { GENERATED_TEMPLATES } from './src/engine/templateGenerator'; export { geometrySignature } from './src/engine/templateLayout'`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false})
const catalogue=await import(`data:text/javascript;base64,${Buffer.from(catalogueBundle.outputFiles[0].text).toString('base64')}`)
assert.equal(catalogue.uniqueTemplates(catalogue.BUILT_IN_TEMPLATES).length,catalogue.BUILT_IN_TEMPLATES.length)
const hidden=catalogue.GENERATED_TEMPLATES.find(t=>!catalogue.BUILT_IN_TEMPLATES.some(u=>u.id===t.id))
assert.ok(hidden,'Duplicate generated layouts must be removed from browsing')
assert.deepEqual(catalogue.findTemplate(hidden.id),hidden,'Old album template IDs must still resolve')
assert.deepEqual(catalogue.templatesForCount(hidden.photoCount,[hidden.id]),[hidden],'Old enabled-template lists must still work')
const first=catalogue.BUILT_IN_TEMPLATES[0]
assert.equal(catalogue.uniqueTemplates([first,{...first,id:'duplicate',placeholders:[...first.placeholders].reverse()}]).length,1)
console.log(`Template checks passed: ${catalogue.BUILT_IN_TEMPLATES.length} unique layouts; legacy album IDs and enabled lists preserved.`)

const source = createCanvas(60, 40)
const sourceCtx = source.getContext('2d')
sourceCtx.fillStyle = '#f02030'; sourceCtx.fillRect(0, 0, 30, 40)
sourceCtx.fillStyle = '#1050e0'; sourceCtx.fillRect(30, 0, 30, 40)
const photos = new Map([['photo', { id: 'photo', src: source.toDataURL(), fileName: 'split.png' }]])
const spread = engine.createBlankSpread(0, { backgroundColor: '#ffffff', marginPx: 30, gapPx: 8, borderWidth: 4, borderColor: '#00ff00' })
spread.placements[0].photoId = 'photo'
spread.placements[0].flipHorizontal = true
spread.textBoxes.push({ id:'text', text:'Album', x:0.1, y:0.1, width:0.4, height:0.12, fontSize:32,
  fontFamily:'Arial', color:'#000000', bold:true, italic:false, align:'left' })
const size = { widthIn: 12, heightIn: 8, dpi: 75 }
const preview = await engine.renderSpreadToCanvas(spread, photos, size, 75)
const print = await engine.renderSpreadToCanvas(spread, photos, size, 150)
const boxes = engine.computePlaceholderBoxes(spread, 900, 600)
const largeBoxes = engine.computePlaceholderBoxes(spread, 1800, 1200)
for (const key of ['x','y','width','height']) assert.equal(largeBoxes[0][key], boxes[0][key] * 2)
const normalized = createCanvas(900, 600)
normalized.getContext('2d').drawImage(print, 0, 0, 900, 600)
const smallPixels = preview.getContext('2d').getImageData(0, 0, 900, 600).data
const largePixels = normalized.getContext('2d').getImageData(0, 0, 900, 600).data
let difference = 0
for (let i = 0; i < smallPixels.length; i++) difference += Math.abs(smallPixels[i] - largePixels[i])
assert.ok(difference / smallPixels.length < 1, 'Print and preview geometry or text differ')

const pages = engine.singlePageCanvases(preview, spread)
assert.deepEqual(pages.map((p) => [p.width,p.height]), [[450,600],[450,600]])
assert.equal(engine.singlePageCanvases(preview, {...spread,isCover:true}).length, 1)
assert.equal(engine.singlePageCanvases(preview, {...spread,pageSide:'single'}).length, 1)
assert.deepEqual(engine.parseSpreadRange('1-999999999999, 2.5, -1, 2, 3e0', 3), [0,1,2])
const project = { name:'Test', clientName:'', size, photos:[...photos.values()], spreads:[{...spread,id:'cover',isCover:true,order:-1},{...spread,id:'s2',order:1},spread] }
assert.deepEqual(engine.selectSpreads(project,[0],false).map((s)=>s.id),[spread.id])
assert.deepEqual(engine.selectSpreads(project,[1],true).map((s)=>s.id),['cover','s2'])
await engine.exportAlbumToPdfPages(project, [0], false)
assert.equal(saved.length,2)
for (const file of saved) {
  const pdf = await PDFDocument.load(file.data)
  assert.equal(pdf.getPageCount(),1)
  assert.deepEqual(pdf.getPage(0).getSize(),{width:432,height:576})
}

const psdBytes = await engine.buildSpreadPsdBytes(spread, photos, size, 75)
const psd = engine.readPsd(psdBytes, { useImageData: true })
assert.equal(psd.children.length,3)
assert.equal(psd.width,900)
assert.deepEqual(psd.children.map((layer)=>layer.name),['Background','split.png','Album'])
assert.equal(psd.children[2].text.text,'Album')
assert.equal(psd.children[2].text.style.font.name,'ArialMT')
assert.equal(psd.children[2].text.style.fontSize,32)
assert.equal(psd.children[2].text.style.fauxBold,true)
assert.equal(psd.children[2].text.shapeType,'box')
assert.equal(psd.children[2].text.paragraphStyle.justification,'left')
assert.deepEqual(psd.children[2].text.transform,[1,0,0,1,90,60])
const merged = createCanvas(900,600)
for (const layer of psd.children) {
  const canvas = createCanvas(layer.imageData.width,layer.imageData.height)
  canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(layer.imageData.data),layer.imageData.width,layer.imageData.height),0,0)
  merged.getContext('2d').drawImage(canvas,layer.left,layer.top)
}
const mergedPixels = merged.getContext('2d').getImageData(0,0,900,600).data
let layerDifference = 0
for (let i=0;i<smallPixels.length;i++) layerDifference += Math.abs(smallPixels[i]-mergedPixels[i])
assert.ok(layerDifference/smallPixels.length < 1, 'PSD layers differ from the design')
saved.length = 0
const customCover = { ...spread, id: 'wide-cover', isCover: true, order: -1,
  textBoxes: [{...spread.textBoxes[0],text:'First\nSecond',align:'center',italic:true,color:'#c05040'}],
  size: { ...size, widthIn: 14, heightIn: 9 }, coverDetails: { wrapIn: 0.2, spineIn: 0.4, reviewedPageCount: 99 },
  customBoxes: [{ id: spread.placements[0].placeholderId, x: 0.2, y: 0.1, width: 0.4, height: 0.6, preferredOrientation: 'any' }] }
const coverCanvas = await engine.renderSpreadToCanvas(customCover, photos, size, 75)
assert.deepEqual([coverCanvas.width, coverCanvas.height], [1050, 675])
const coverPsd = engine.readPsd(await engine.buildSpreadPsdBytes(customCover, photos, size, 75), { skipLayerImageData: true, skipCompositeImageData: true })
assert.deepEqual([coverPsd.width, coverPsd.height], [1050, 675])
const editableCoverText=coverPsd.children.find((layer)=>layer.text)?.text
assert.equal(editableCoverText.text,'First\nSecond')
assert.equal(editableCoverText.paragraphStyle.justification,'center')
assert.equal(editableCoverText.style.fauxItalic,true)
for (const [channel,value] of Object.entries({r:192,g:80,b:64})) assert.ok(Math.abs(editableCoverText.style.fillColor[channel]-value)<0.01)
assert.ok(Math.abs(editableCoverText.style.fontSize-32*1050/900)<0.001)
await engine.exportAlbumToPdfPages({ ...project, spreads: [customCover] }, [], true)
const coverPdf = await PDFDocument.load(saved[0].data)
assert.deepEqual(coverPdf.getPage(0).getSize(), { width: 1008, height: 648 })
const checks = engine.exportPreflight({ ...project, photos: [{ ...photos.get('photo'), width: 60, height: 40 }], spreads: [customCover, spread] }, undefined, true)
assert.ok(checks.coverNeedsReview)
assert.equal(checks.lowResolution.length, 2)
const lines = []
await engine.drawTextBox({ save(){}, restore(){}, measureText:()=>({width:20}), fillText:(text,x,y)=>lines.push({text,y}) }, { ...spread.textBoxes[0], text: 'First\n\nThird' }, 900, 600)
assert.deepEqual(lines.map((line)=>line.text), ['First','Third'])
assert.equal(lines[1].y-lines[0].y,64)
assert.throws(()=>engine.deserializeProjectFile('{"formatVersion":1,"project":{}}'))
const savedProject = { ...project, photos: [...photos.values()] }
await engine.saveProjectToFile(savedProject, [], 'C:\\test\\album.ablm.json')
assert.equal(saved.at(-1).dirPath,'C:\\test')
assert.equal(saved.at(-1).fileName,'album.ablm.json')
assert.deepEqual(engine.deserializeProjectFile(new TextDecoder().decode(saved.at(-1).data)).project, savedProject)
console.log('Rendering checks passed: preview/print scale, crops, flipped images, borders, multiline text, PSD layers, single pages, ranges, custom covers, export warnings and project save/reopen.')
const pattern = engine.builtInPatterns()[0]
assert.equal(engine.readDraggedPattern({getData:()=>JSON.stringify(pattern)}).name,pattern.name)
assert.equal(engine.readDraggedPattern({getData:()=>JSON.stringify({...pattern,src:'https://example.com/image.png'})}),null)
assert.equal(engine.readDraggedPattern({getData:()=>JSON.stringify({...pattern,tileSizePx:NaN})}),null)
const patterned = {...spread, placements:[],textBoxes:[],backgroundPattern:pattern}
const patternedCanvas = await engine.renderSpreadToCanvas(patterned,photos,size,75)
const patternedPsd = engine.readPsd(await engine.buildSpreadPsdBytes(patterned,photos,size,75),{useImageData:true})
assert.equal(patternedPsd.children.length,1)
const patternPixels = patternedCanvas.getContext('2d').getImageData(0,0,900,600).data
assert.deepEqual(new Uint8ClampedArray(patternedPsd.children[0].imageData.data),patternPixels)
assert.ok(patternPixels.some((v,i)=>i%4!==3 && v!==255),'Pattern must be rendered')
console.log('Pattern checks passed: safe drag payloads and matching preview, PSD background and print rendering.')
const fixed = {...spread, placements:[], textBoxes:[], backgroundPattern:{name:'Photo background',src:source.toDataURL(),tileSizePx:900,mode:'cover',width:60,height:40}}
const fixedCanvas = await engine.renderSpreadToCanvas(fixed,photos,size,75)
assert.deepEqual([...fixedCanvas.getContext('2d').getImageData(100,300,1,1).data],[240,32,48,255])
assert.deepEqual([...fixedCanvas.getContext('2d').getImageData(800,300,1,1).data],[16,80,224,255])
const fixedPsd = engine.readPsd(await engine.buildSpreadPsdBytes(fixed,photos,size,75),{useImageData:true})
assert.deepEqual(new Uint8ClampedArray(fixedPsd.children[0].imageData.data),fixedCanvas.getContext('2d').getImageData(0,0,900,600).data)
assert.deepEqual(engine.retemplateSpread(fixed,'full-bleed').backgroundPattern,fixed.backgroundPattern)
assert.deepEqual(engine.buildSpreadFromPlacements(spread.placements,'spread',fixed).backgroundPattern,fixed.backgroundPattern)
assert.deepEqual(engine.deserializeProjectFile(await engine.serializeProjectFile({...project,spreads:[fixed]},[])).project.spreads[0].backgroundPattern,fixed.backgroundPattern)
assert.deepEqual(engine.exportPreflight({...project,spreads:[fixed]}).lowResolution,[fixed.id])
console.log('Fixed photo background: aspect-preserving render, PSD pixels, layout retention, save/reopen and low-resolution warning passed.')
const edits = {...spread.placements[0], zoom:1.7, focalX:0.3, focalY:0.6, rotationDeg:25, opacity:0.65, brightness:18, flipHorizontal:true}
const editedBackground = {...fixed, backgroundPattern:{...fixed.backgroundPattern, edits}}
const editedCanvas = await engine.renderSpreadToCanvas(editedBackground,photos,size,75)
const expectedBackground = createCanvas(900,600)
const expectedCtx = expectedBackground.getContext('2d')
expectedCtx.imageSmoothingQuality='high'
expectedCtx.fillStyle=spread.backgroundColor; expectedCtx.fillRect(0,0,900,600)
await engine.drawPlacement(expectedCtx,{x:0,y:0,width:900,height:600},edits,photos.get('photo'),1)
const editedPixels=Buffer.from(editedCanvas.getContext('2d').getImageData(0,0,900,600).data)
assert.ok(editedPixels.equals(Buffer.from(expectedCtx.getImageData(0,0,900,600).data)), 'Background must retain all image edits')
const editedPsd=engine.readPsd(await engine.buildSpreadPsdBytes(editedBackground,photos,size,75),{useImageData:true})
assert.ok(editedPixels.equals(Buffer.from(editedPsd.children[0].imageData.data)), 'PSD must retain background edits')
assert.deepEqual(engine.deserializeProjectFile(await engine.serializeProjectFile({...project,spreads:[editedBackground]},[])).project.spreads[0].backgroundPattern.edits,edits)
console.log('Edited backgrounds: crop, scale, angle, opacity, tone, flips, PSD and save/reopen passed.')
window.albumStudio.saveFile = async (file) => { saved.push(file); return {canceled:false,filePath:'test-output/album.pdf'} }
await engine.exportAlbumToPdf(project, [0], false, {pdfX:true})
const pdfXBytes = saved.at(-1).data
assert.equal(new TextDecoder().decode(pdfXBytes.slice(0,8)), '%PDF-1.3')
const pdfX = await PDFDocument.load(pdfXBytes,{updateMetadata:false})
const info = pdfX.context.lookup(pdfX.context.trailerInfo.Info,PDFDict)
assert.equal(info.lookup(PDFName.of('GTS_PDFXVersion')).decodeText(),'PDF/X-3:2002')
assert.equal(info.lookup(PDFName.of('Trapped')).toString(),'/False')
assert.equal(pdfX.context.trailerInfo.ID.size(),2)
const intent = pdfX.catalog.lookup(PDFName.of('OutputIntents'),PDFArray).lookup(0,PDFDict)
assert.equal(intent.lookup(PDFName.of('S')).toString(),'/GTS_PDFX')
const profile = pdfX.context.lookup(intent.get(PDFName.of('DestOutputProfile')),PDFRawStream)
assert.equal(profile.dict.lookup(PDFName.of('N')).asNumber(),3)
assert.equal(new TextDecoder().decode(decodePDFRawStream(profile).decode().slice(36,40)),'acsp')
assert.deepEqual(pdfX.getPage(0).getTrimBox(),{x:0,y:0,width:864,height:576})
console.log('PDF/X-3 checks passed: PDF 1.3, metadata, trapping flag, document IDs, embedded RGB ICC output intent and trim boxes.')
const gray = createCanvas(20,20)
gray.getContext('2d').fillStyle = '#808080'
gray.getContext('2d').fillRect(0,0,20,20)
const tonePlacement = {...spread.placements[0], frameStyle:'none',borderWidth:0,rotationDeg:0,brightness:-50,contrast:0,saturation:0,warmth:0,relightIntensity:0,opacity:1}
const toneOutput = createCanvas(20,20)
const toneCtx = toneOutput.getContext('2d')
await engine.drawPlacement(toneCtx,{x:0,y:0,width:20,height:20},tonePlacement,{src:gray.toDataURL()},1)
assert.ok(Math.abs(toneCtx.getImageData(10,10,1,1).data[0]-64)<=1,'Brightness must multiply RGB values consistently')
tonePlacement.brightness=0; tonePlacement.warmth=70
await engine.drawPlacement(toneCtx,{x:0,y:0,width:20,height:20},tonePlacement,{src:gray.toDataURL()},1)
const warmPixel=toneCtx.getImageData(10,10,1,1).data
assert.ok(warmPixel[0]>warmPixel[2],'Warmth must tint the rendered photo')
console.log('Tone checks passed: multiplicative brightness and visible warmth.')
const originalPhoto={id:'original',fileName:'CAM0001.jpg',src:'data:image/jpeg;base64,AAAA',width:100,height:100}
const samePhoto={...originalPhoto,id:'same'}
const differentPhoto={...originalPhoto,id:'different',src:'data:image/jpeg;base64,BBBB'}
const deduped=await engine.dedupeImportedAssets([samePhoto,differentPhoto,{...differentPhoto,id:'batch-repeat'}],[originalPhoto])
assert.deepEqual(deduped.newAssets,[differentPhoto])
assert.deepEqual(deduped.matchedAssets,[originalPhoto,differentPhoto,differentPhoto])
console.log('Import collision checks passed: identical content is reused, different same-name photos survive, and batch duplicates map to one asset.')
const writeSequence=[]
window.albumStudio.pickDirectory=async()=>{writeSequence.push('choose');return {dirPath:'test-output'}}
window.albumStudio.writeFileInDir=async(file)=>{writeSequence.push(`write:${file.fileName}`)}
async function* streamedFiles() {
  writeSequence.push('render:1');yield {fileName:'1.psd',bytes:new Uint8Array([1]),mime:'image/vnd.adobe.photoshop'}
  assert.equal(writeSequence.at(-1),'write:1.psd','Write each spread before rendering the next')
  writeSequence.push('render:2');yield {fileName:'2.psd',bytes:new Uint8Array([2]),mime:'image/vnd.adobe.photoshop'}
}
await engine.saveManyFiles(streamedFiles())
assert.deepEqual(writeSequence,['choose','render:1','write:1.psd','render:2','write:2.psd'])
window.albumStudio.pickDirectory=async()=>({canceled:true})
assert.deepEqual(await engine.saveManyFiles((async function*(){throw new Error('Cancelled exports must not render')})()),{saved:false})
console.log('PSD checks passed: editable text/style round-trips, cached previews and sequential export without rendering on cancellation.')

const densePhotos=Array.from({length:30},(_,i)=>{
  const width=[180,120,140,320,80][i%5],height=[120,180,140,80,240][i%5]
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d'),color=[40+i*5,50+i*3,200-i*4]
  ctx.fillStyle=`rgb(${color.join(',')})`;ctx.fillRect(0,0,width,height)
  return {id:`dense-${i}`,width,height,src:canvas.toDataURL(),color}
})
for(const count of [20,25,30]) for(const aspect of [1.5,3]) {
  const photos=densePhotos.slice(0,count),byId=new Map(photos.map(p=>[p.id,p]))
  const spread=engine.buildSpreadsFromGroups([photos],{backgroundColor:'#fffdfa',marginPx:24,gapPx:40,borderWidth:0,borderColor:'#fff'},null,{aspect,start:'spread',end:'spread',includeFullSpreadTemplates:true},false)[0]
  spread.placements.forEach((p,i)=>Object.assign(p,{zoom:i%3+1,focalX:i%3/2,focalY:1-i%3/2,flipHorizontal:i%2===0,flipVertical:i%3===0}))
  for(const dpi of [75,150]) {
    const rendered=await engine.renderSpreadToCanvas(spread,byId,{widthIn:12,heightIn:12/aspect,dpi},dpi)
    const boxes=engine.computePlaceholderBoxes(spread,rendered.width,rendered.height)
    boxes.forEach(box=>{
      const placement=spread.placements.find(p=>p.placeholderId===box.placeholderId),photo=byId.get(placement.photoId)
      const pixel=rendered.getContext('2d').getImageData(Math.floor(box.x+box.width/2),Math.floor(box.y+box.height/2),1,1).data
      photo.color.forEach((value,i)=>assert.ok(Math.abs(pixel[i]-value)<=2,`Missing/distorted dense photo ${placement.photoId} (${count}, ${aspect}, ${dpi})`))
    })
    if(count===30&&aspect===3&&dpi===150) await fs.writeFile(path.join(os.tmpdir(),'ynot-dense-30-export.png'),rendered.toBuffer('image/png'))
  }
}
console.log('Dense raster checks passed: all 20/25/30 mixed photos visibly render at two aspect ratios and two export resolutions with zoom, focal points and flips.')
