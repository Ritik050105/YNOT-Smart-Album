import assert from 'node:assert/strict'
import fs from 'node:fs'
import {transform} from 'esbuild'
const {code}=await transform(fs.readFileSync('src/engine/templateTransfer.ts','utf8'),{loader:'ts',format:'esm'})
const {parseTemplateTransfer}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
const effect={enabled:true,color:'#123456',size:100,distance:100,opacity:1,angle:30,depth:1000,scale:400,highlightOpacity:0.5,shadowOpacity:0.5}
const template={name:'Effect roundtrip',pageSide:'spread',photoCount:1,placeholders:[{id:'p',x:0,y:0,width:1,height:1}],textBoxes:[{id:'t',text:'Test',fontFamily:'Arial',color:'#123456',x:0,y:0,width:.5,height:.2,fontSize:24,align:'left',effects:{bevel:effect}}]}
const parse=()=>parseTemplateTransfer(JSON.stringify({format:'ynot-templates',version:1,templates:[template]}))
assert.deepEqual(parse()[0].textBoxes[0].effects.bevel,effect)
for(const [key,value] of Object.entries({size:101,distance:101,opacity:2,depth:1001,scale:0,soften:31,spread:-1,noise:'5',highlightOpacity:null,offsetY:101})){
 const previous=effect[key];effect[key]=value
 assert.throws(parse,/Invalid text effect/,key)
 if(previous===undefined)delete effect[key];else effect[key]=previous
}
assert.deepEqual(parse()[0].textBoxes[0].effects.bevel,effect)
console.log('PASS: effect export/import limits and malformed advanced values')
