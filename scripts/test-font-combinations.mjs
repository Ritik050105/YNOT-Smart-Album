import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {transform} from 'esbuild'
const source=fs.readFileSync('src/engine/fontCombinations.ts','utf8')
const {code}=await transform(source,{loader:'ts',format:'esm'})
const {fontCombinations}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
const families=new Set(JSON.parse(fs.readFileSync('src/assets/google-fonts/manifest.json','utf8')).map(f=>f.family))
for(const aspect of [0,NaN,0.5,1,2,3,8]){
 const items=fontCombinations(aspect)
 assert.equal(items.length,600)
 assert.equal(new Set(items.map(i=>i.name)).size,600,'Distinct catalog names')
 assert.equal(new Set(items.map(i=>JSON.stringify(i.boxes.map(({id,groupId,...b})=>b)))).size,600,'Distinct editable designs')
 assert.equal(new Set(items.map(i=>i.id)).size,600)
 for(const [i,item] of items.entries()){
  assert.equal(item.id,'ynot-combination-'+i)
  assert.ok(item.boxes.length)
  for(const box of item.boxes){
   assert.ok(box.text && box.fontFamily)
   assert.ok(families.has(box.fontFamily),'Bundled font: '+box.fontFamily)
   assert.equal(box.groupId,item.id)
   assert.equal(box.sourceArtwork,undefined,'Compositions remain editable text')
   for(const k of ['x','y','width','height','fontSize'])assert.ok(Number.isFinite(box[k]),k)
   assert.ok(box.y>=0 && box.y+box.height<=1,'Fits spread height')
   assert.ok(box.fontSize>0)
  }
 }
}
const first=fontCombinations(1),second=fontCombinations(1)
assert.equal(createHash('sha256').update(JSON.stringify(first.slice(0,300))).digest('hex'),'cbcd774398637c960cb119c3dbde3c877eddf5b4db5db006a3ca08d55d308dd2','Original 300 compositions stay unchanged')
first[0].boxes[0].text='Edited'
first[2].boxes[0].effects.stroke.color='#000000'
assert.equal(second[0].boxes[0].text,'SCARY')
assert.equal(second[2].boxes[0].effects.stroke.color,'#00acc1')
console.log('600 editable compositions: stable IDs, aspect fitting, isolated edits passed')
