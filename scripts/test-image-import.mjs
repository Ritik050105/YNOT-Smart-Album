import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'

const require = createRequire(import.meta.url)
const { createCanvas, Image, ImageData } = require(process.argv[2] || '@napi-rs/canvas')
const sharp = require('sharp')
const { decodeTiff } = require('../dist-electron/images.js')
globalThis.Image = Image
globalThis.ImageData = ImageData
globalThis.document = { createElement: () => createCanvas(1, 1) }
globalThis.window = { albumStudio: { decodeTiff } }
const bundle = await build({ stdin: { contents: `export * from './src/engine/imageSource'; export * from './src/engine/colorProfile'; export {initializeCanvas,writePsdUint8Array} from 'ag-psd'`, resolveDir:process.cwd() }, bundle:true,platform:'node',format:'esm',write:false })
const engine = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
engine.initializeCanvas(createCanvas)
const canvas = createCanvas(64,32)
canvas.getContext('2d').fillStyle = '#408050'
canvas.getContext('2d').fillRect(0,0,64,32)
const tiff = await sharp(canvas.toBuffer('image/png')).toColourspace('rgb16').tiff({compression:'lzw'}).toBuffer()
const tiffFile = new File([tiff], 'test.tif', {type:'image/tiff'})
assert.ok(engine.isImageFile(tiffFile))
const tiffSource = await engine.imageFileSource(tiffFile)
const decoded = new Image()
await new Promise((resolve,reject)=>{decoded.onload=resolve;decoded.onerror=reject;decoded.src=tiffSource})
assert.deepEqual([decoded.width,decoded.height], [64,32])
const psd = engine.writePsdUint8Array({width:64,height:32,canvas})
const psdFile = new File([psd], 'test.psd', {type:''})
assert.ok(engine.isImageFile(psdFile))
const psdSource = await engine.imageFileSource(psdFile)
const decodedPsd = new Image()
await new Promise((resolve,reject)=>{decodedPsd.onload=resolve;decodedPsd.onerror=reject;decodedPsd.src=psdSource})
assert.deepEqual([decodedPsd.width,decodedPsd.height], [64,32])
const taggedTiff = await sharp(canvas.toBuffer('image/png')).withIccProfile('srgb').tiff().toBuffer()
assert.equal(await engine.hasColorProfile(new File([taggedTiff],'tagged.tif')),true)
assert.equal(await engine.hasColorProfile(tiffFile),false)
assert.equal(await engine.hasColorProfile(psdFile),false)
const profile = await readFile('src/assets/sRGB2014.icc')
const resourcesAt = 30 + Buffer.from(psd).readUInt32BE(26)
const oldResourcesLength = Buffer.from(psd).readUInt32BE(resourcesAt)
const resource = Buffer.alloc(12+profile.length+(profile.length%2))
resource.write('8BIM',0); resource.writeUInt16BE(1039,4); resource.writeUInt32BE(profile.length,8); profile.copy(resource,12)
const resourcesSize = Buffer.alloc(4); resourcesSize.writeUInt32BE(oldResourcesLength+resource.length)
const taggedPsd = Buffer.concat([psd.slice(0,resourcesAt),resourcesSize,resource,psd.slice(resourcesAt+4)])
assert.equal(await engine.hasColorProfile(new File([taggedPsd],'tagged.psd')),true)
assert.equal(await engine.hasColorProfile(new File(['broken'],'bad.tif')),false)
assert.equal(await engine.hasColorProfile(new File(['broken'],'bad.psd')),false)
if (process.argv[3]) {
  await writeFile(`${process.argv[3]}/synthetic-16bit.tif`,tiff)
  await writeFile(`${process.argv[3]}/synthetic-composite.psd`,taggedPsd)
}
assert.equal(engine.isImageFile(new File(['text'],'readme.txt',{type:'text/plain'})),false)
await assert.rejects(()=>engine.imageFileSource(new File(['broken'],'bad.psd')))
await assert.rejects(()=>decodeTiff(new Uint8Array([1,2,3])))
await assert.rejects(()=>decodeTiff(canvas.toBuffer('image/png')))
console.log('Image import checks passed: TIFF, PSD composites, dimensions, extension detection and corrupt/incorrect file rejection.')
