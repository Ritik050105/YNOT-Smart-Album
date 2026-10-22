import assert from 'node:assert/strict'
import { build } from 'esbuild'
const state={project:{id:'test',name:'Test',size:{id:'test',label:'Test'},spreads:[],photos:[]},userTemplates:[],isDirty:true,currentFilePath:'test.json',history:[],future:[],markSaved(){state.isDirty=false},setCurrentFilePath(path){state.currentFilePath=path}}
globalThis.__saveState=state
let closeRequest,closes=0,clears=0,alerts=[]
globalThis.__clearRecovery=()=>clears++
globalThis.alert=(message)=>alerts.push(message)
globalThis.localStorage={getItem:()=>null}
globalThis.HTMLElement=class {blur(){}}
globalThis.document={activeElement:new HTMLElement()}
globalThis.window={addEventListener(){},removeEventListener(){},albumStudio:{onSaveBeforeClose(fn){closeRequest=fn;return ()=>{}},async closeCurrentWindow(){closes++}}}
const effects=[]
globalThis.__saveEffects=effects
const result=await build({entryPoints:['src/components/TopBar.tsx'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'save-flow',setup(build){
  const stub=(filter,namespace,contents)=>{build.onResolve({filter},()=>({path:namespace,namespace}));build.onLoad({filter:/.*/,namespace},()=>({contents}))}
  stub(/^react$/,'react','export const useState=(value)=>[typeof value==="function"?value():value,()=>{}];export const useEffect=(fn)=>globalThis.__saveEffects.push(fn);')
  stub(/^react\/jsx-runtime$/,'jsx','export const jsx=()=>null;export const jsxs=jsx;export const Fragment="fragment";')
  stub(/^@\/state\/projectStore$/,'store','export const useProjectStore=(selector)=>selector(globalThis.__saveState);useProjectStore.getState=()=>globalThis.__saveState;')
  stub(/^@\/engine\/projectFile$/,'files','export const saveProjectToFile=(...args)=>globalThis.__saveFile(...args);export const openProjectFromFile=()=>null;')
  stub(/^@\/engine\/sessionMarker$/,'session','export const clearOpenSession=()=>globalThis.__clearRecovery();')
  stub(/^@\/engine\/recentProjects$/,'recent','export const recordRecentProject=()=>{};')
  stub(/^\.\/(Icon|Modal|ExportModal|CustomSizeModal|NewProjectWizard|ProjectInfoPanel)$/,'component','export default function Component(){}')
}}]})
const {default:TopBar}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
TopBar({});effects.forEach((fn)=>fn())
const flush=()=>new Promise((resolve)=>setImmediate(resolve))
globalThis.__saveFile=async()=>({saved:false})
closeRequest();await flush()
assert.equal(closes,0);assert.equal(state.isDirty,true);assert.equal(clears,0)
globalThis.__saveFile=async()=>{throw new Error('Disk full')}
closeRequest();await flush()
assert.equal(closes,0);assert.equal(state.isDirty,true);assert.match(alerts.pop(),/Disk full/)
let resolveSave
globalThis.__saveFile=()=>new Promise((resolve)=>{resolveSave=resolve})
closeRequest();state.project={...state.project,name:'New edit'};resolveSave({saved:true,filePath:'test.json'});await flush()
assert.equal(closes,0);assert.equal(state.isDirty,true);assert.equal(clears,0,'Saving an older snapshot must retain current recovery')
assert.match(alerts.pop(),/changed while saving/)
globalThis.__saveFile=async()=>({saved:true,filePath:'saved.json'})
closeRequest();await flush()
assert.equal(closes,1);assert.equal(state.isDirty,false);assert.equal(state.currentFilePath,'saved.json');assert.equal(clears,1)
console.log('Save-on-close checks passed: successful save closes, cancelled/failed saves stay open, and concurrent edits retain dirty state and recovery.')

