import assert from 'node:assert/strict'
import { build } from 'esbuild'
const storage = new Map()
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
const result = await build({entryPoints:['src/engine/sizePresets.ts'],bundle:true,platform:'node',format:'esm',write:false})
const {addSizePreset,loadSizePresets,deleteSizePreset} = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const size = {id:'qa',presetName:'QA',label:'QA',category:'Custom',widthIn:20,heightIn:10,dpi:300,trim:{leftRight:0,topBottom:0,inside:0},safeZone:{leftRight:0,topBottom:0,inside:0}}
addSizePreset({...size,units:'cm',layoutStart:'single',layoutEnd:'spread',includeFullSpreadTemplates:false})
assert.deepEqual(loadSizePresets()[0],{...size,units:'cm',layoutStart:'single',layoutEnd:'spread',includeFullSpreadTemplates:false})
addSizePreset({...size,widthIn:24})
assert.equal(loadSizePresets().length,1)
assert.equal(loadSizePresets()[0].widthIn,24)
assert.equal(loadSizePresets()[0].layoutStart,'single','Editing size through the existing size modal preserves wizard layout settings')
assert.equal(loadSizePresets()[0].includeFullSpreadTemplates,false)
assert.equal(deleteSizePreset('QA').length,0)
console.log('Custom preset round-trip, size-only updates and deletion passed.')
