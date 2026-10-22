import assert from 'node:assert/strict'
import { build } from 'esbuild'
const saved=new Map()
globalThis.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)}
const bundle=await build({stdin:{contents:`export {useProjectStore} from './src/state/projectStore';export * from './src/engine/templates';export * from './src/engine/autoLayout'`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false})
const {useProjectStore:store,setUserTemplateRegistry,retemplateSpread,createBlankSpread}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const template={id:'assignment-test',name:'Assignment',photoCount:2,placeholders:[{id:'left',x:0,y:0,width:0.25,height:1},{id:'right',x:0.25,y:0,width:0.75,height:1}],pageSide:'spread',isBuiltIn:false,thumbnailColor:'#fff'}
setUserTemplateRegistry([template])
const photos=[{id:'landscape',width:900,height:600},{id:'portrait',width:300,height:600}]
const spread={...createBlankSpread(0,{backgroundColor:'#fff',marginPx:0,gapPx:0,borderWidth:0,borderColor:'#fff'}),id:'s',placements:[{placeholderId:'a',photoId:'landscape',zoom:2,focalX:0.1,flipHorizontal:true},{placeholderId:'b',photoId:'portrait',zoom:3,focalY:0.8}]}
store.setState(s=>({project:{...s.project,size:{...s.project.size,widthIn:24,heightIn:12},spreads:[spread],photos,enabledTemplateIds:['assignment-test']},selectedSpreadId:'s',history:[],future:[],isDirty:false}))
const original=store.getState().project
store.getState().openMatchingTemplates('s')
store.getState().previewMatchingTemplate('assignment-test',false)
assert.equal(store.getState().project,original,'Hover never changes the saved project')
assert.equal(store.getState().history.length,0)
assert.equal(store.getState().isDirty,false)
assert.deepEqual(store.getState().templatePreview.placements.map(p=>p.photoId),['portrait','landscape'],'Rearrange optimizes photo/frame assignment')
assert.equal(store.getState().templatePreview.placements[1].zoom,2)
assert.equal(store.getState().templatePreview.placements[1].flipHorizontal,true)
store.getState().previewMatchingTemplate('assignment-test',true)
assert.deepEqual(store.getState().templatePreview.placements.map(p=>p.photoId),['landscape','portrait'],'Match Timeline Order retains sequence')
store.getState().closeMatchingTemplates()
assert.equal(store.getState().templatePreview,null)
assert.equal(store.getState().project,original)
store.getState().toggleTemplateFavorite('assignment-test')
assert.ok(saved.get('albumstudio.templateFavorites').includes('assignment-test'))
assert.equal(store.getState().isDirty,false)
store.getState().applyTemplateToSpread('s','assignment-test',false)
assert.equal(store.getState().history.length,1)
assert.deepEqual(store.getState().project.spreads[0].placements.map(p=>p.photoId),['portrait','landscape'])
store.getState().undo();assert.equal(store.getState().project,original)
store.getState().redo();assert.equal(store.getState().project.spreads[0].templateId,'assignment-test')
store.getState().openMatchingTemplates('s');store.getState().previewMatchingTemplate('full-bleed')
assert.equal(store.getState().templatePreview,null,'Preview cannot bypass a restricted library')
store.getState().selectSpread(null);assert.equal(store.getState().matchingTemplatesOpen,false)
const duplicate={...spread,placements:spread.placements.map((p,i)=>({...p,photoId:'landscape',zoom:i+2}))}
assert.deepEqual(retemplateSpread(duplicate,'assignment-test',photos,2,false).placements.map(p=>p.zoom).sort(),[2,3],'Repeated uses of the same photo keep their distinct edits')
const history=store.getState().history.length
store.getState().applyTemplateToSpread('s','unknown-template')
assert.equal(store.getState().history.length,history,'Invalid template IDs must not create Undo entries')
console.log('Matching template checks passed: non-destructive preview/cancel, two assignment modes, edit preservation, duplicate photos, favorites, strict library, one-step Undo/Redo and invalid-template safety.')
