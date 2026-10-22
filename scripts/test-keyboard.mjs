import assert from 'node:assert/strict'
import { build } from 'esbuild'
const effects=[]
globalThis.__keyboardEffects=effects
const result=await build({stdin:{contents:`export {default as KeyboardShortcuts} from './src/components/KeyboardShortcuts';export {useProjectStore} from './src/state/projectStore'`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'hooks',setup(build){
  build.onResolve({filter:/^react\/jsx-runtime$/},()=>({path:'jsx',namespace:'jsx-test'}))
  build.onLoad({filter:/.*/,namespace:'jsx-test'},()=>({contents:'export const jsx=()=>null;export const jsxs=()=>null;'}))
  build.onResolve({filter:/^react-dom$/},()=>({path:'portal',namespace:'portal'}))
  build.onLoad({filter:/.*/,namespace:'portal'},()=>({contents:'export const createPortal=()=>null;'}))
  build.onResolve({filter:/^react$/},()=>({path:'react',namespace:'test'}))
  build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`export const useRef=(current)=>({current});export const useState=(value)=>[value,()=>{}];export const useEffect=(effect)=>globalThis.__keyboardEffects.push(effect);export default {};`}))
}}]})
const {KeyboardShortcuts,useProjectStore}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const listeners=new Map()
globalThis.window={addEventListener:(key,value)=>listeners.set(key,value),removeEventListener:(key)=>listeners.delete(key)}
globalThis.document={querySelector:()=>null}
const calls=[]
useProjectStore.setState({selectedSpreadId:'spread',selectedPlaceholderId:'frame',multiSelectedPlaceholderIds:[],copyPlacement:(...args)=>calls.push(['copy',...args]),pastePlacement:(...args)=>calls.push(['paste',...args]),cutPlacement:(...args)=>calls.push(['cut',...args]),copyToneAdjustments:(...args)=>calls.push(['copy-tone',...args]),pasteToneAdjustments:(...args)=>calls.push(['paste-tone',...args])})
KeyboardShortcuts()
const cleanup=effects.map((effect)=>effect())
globalThis.HTMLElement=class {}
const key=(key,shiftKey=false,target=null)=>listeners.get('keydown')({key,shiftKey,ctrlKey:true,metaKey:false,target,preventDefault(){}})
key('c');key('v');key('x');key('C',true);key('V',true)
assert.deepEqual(calls,[['copy','spread','frame'],['paste','spread',['frame']],['cut','spread','frame'],['copy-tone','spread','frame'],['paste-tone','spread',['frame']]])
calls.length=0
globalThis.HTMLElement=class {tagName='INPUT';isContentEditable=false}
key('c',false,new HTMLElement())
assert.deepEqual(calls,[],'Text fields retain their native clipboard')
useProjectStore.setState({multiSelectedPlaceholderIds:['one','two'],selectedPlaceholderId:null})
key('v')
assert.deepEqual(calls,[['paste','spread',['one','two']]])
calls.length=0
useProjectStore.setState({selectedTextBoxId:'text',selectedPhotoIds:['photo']})
key('d')
assert.equal(useProjectStore.getState().selectedPlaceholderId,null)
assert.equal(useProjectStore.getState().selectedTextBoxId,null)
assert.deepEqual(useProjectStore.getState().selectedPhotoIds,[])
assert.deepEqual(useProjectStore.getState().multiSelectedPlaceholderIds,[])
const arrows=(key,extra={})=>listeners.get('keydown')({key,ctrlKey:false,metaKey:false,shiftKey:false,target:null,preventDefault(){},...extra})
const base=useProjectStore.getState().project
useProjectStore.setState({project:{...base,spreads:[{id:'two',order:2},{id:'cover',order:9,isCover:true},{id:'one',order:1}]},selectedSpreadId:'one',selectedPlaceholderId:null,selectedTextBoxId:null,multiSelectedPlaceholderIds:[],designerViewSpreadId:null,isDirty:false})
arrows('ArrowRight')
assert.equal(useProjectStore.getState().selectedSpreadId,'two')
arrows('ArrowRight')
assert.equal(useProjectStore.getState().selectedSpreadId,'two','Stop at the final spread')
arrows('ArrowLeft');arrows('ArrowLeft')
assert.equal(useProjectStore.getState().selectedSpreadId,'cover','Cover stays first regardless of its numeric order')
arrows('ArrowRight',{defaultPrevented:true})
assert.equal(useProjectStore.getState().selectedSpreadId,'cover','Dock keyboard handling wins over global navigation')
assert.equal(useProjectStore.getState().isDirty,false,'Selection never dirties the album')
useProjectStore.setState({designerViewSpreadId:'one',selectedSpreadId:'one'})
arrows('ArrowRight')
assert.equal(useProjectStore.getState().selectedSpreadId,'one','Designer canvas is not switched by overview navigation')
useProjectStore.setState({designerViewSpreadId:null,selectedSpreadId:'one',cycleSpreadTemplate:(...args)=>calls.push(['cycle',...args])})
arrows('ArrowDown');arrows('ArrowUp')
assert.deepEqual(calls,[['cycle','one',1],['cycle','one',-1]])
cleanup.forEach((fn)=>fn?.())
console.log('Keyboard checks passed: image cut/copy/paste, shifted tone clipboard, multiselection and text field isolation.')
