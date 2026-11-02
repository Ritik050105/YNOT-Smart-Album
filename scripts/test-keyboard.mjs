import assert from 'node:assert/strict'
import { build } from 'esbuild'
const effects=[]
globalThis.__keyboardEffects=effects
const result=await build({stdin:{contents:`export {default as KeyboardShortcuts} from './src/components/KeyboardShortcuts';export {useProjectStore} from './src/state/projectStore'`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,loader:{'.ttf':'dataurl','.png':'dataurl','.icc':'dataurl'},plugins:[{name:'hooks',setup(build){
  build.onResolve({filter:/^react\/jsx-runtime$/},()=>({path:'jsx',namespace:'jsx-test'}))
  build.onLoad({filter:/.*/,namespace:'jsx-test'},()=>({contents:'export const Fragment=Symbol();export const jsx=()=>null;export const jsxs=()=>null;'}))
  build.onResolve({filter:/^react-dom$/},()=>({path:'portal',namespace:'portal'}))
  build.onLoad({filter:/.*/,namespace:'portal'},()=>({contents:'export const createPortal=()=>null;'}))
  build.onResolve({filter:/^react-dom\/client$/},()=>({path:'client',namespace:'client-test'}))
 build.onLoad({filter:/.*/,namespace:'client-test'},()=>({contents:'export const createRoot=()=>({render(){},unmount(){}});'}))
 build.onResolve({filter:/^react$/},()=>({path:'react',namespace:'test'}))
  build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`export const useMemo=(fn)=>fn();export const useCallback=(fn)=>fn;export const useSyncExternalStore=(sub,get)=>get();export const useRef=(current)=>({current});export const useState=(value)=>[value,()=>{}];export const useEffect=(effect)=>globalThis.__keyboardEffects.push(effect);export default {};`}))
}}]})
const {KeyboardShortcuts,useProjectStore}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const listeners=new Map()
globalThis.window={addEventListener:(key,value)=>listeners.set(key,value),removeEventListener:(key)=>listeners.delete(key)}
globalThis.document={querySelector:()=>null}
const calls=[]
const initial=useProjectStore.getState().project
useProjectStore.setState({project:{...initial,photos:[{id:'photo',src:'test',width:100,height:100}],spreads:[{id:'spread',order:0,placements:[{placeholderId:'frame',photoId:'photo'}],textBoxes:[],customBoxes:[{id:'frame',x:.1,y:.1,width:.4,height:.4,preferredOrientation:'any'}]}]},selectedSpreadId:'spread',selectedPlaceholderId:'frame',selectedLayerKeys:[],multiSelectedPlaceholderIds:[],copyPlacement:(...args)=>calls.push(['copy',...args]),updateSpread:(id,patch)=>calls.push(['paste',id,patch]),updateMultiplePlacements:(...args)=>calls.push(['delete',...args]),copyToneAdjustments:(...args)=>calls.push(['copy-tone',...args]),pasteToneAdjustments:(...args)=>calls.push(['paste-tone',...args])})
KeyboardShortcuts()
const cleanup=effects.map((effect)=>effect())
globalThis.HTMLElement=class {}
const key=(key,shiftKey=false,target=null)=>listeners.get('keydown')({key,shiftKey,ctrlKey:true,metaKey:false,target,preventDefault(){}})
key('c');key('v')
assert.equal(calls[0][0],'copy')
assert.equal(calls[1][0],'paste')
assert.equal(calls[1][2].placements.length,2,'Paste creates another image layer')
assert.notEqual(calls[1][2].placements[1].placeholderId,'frame')
useProjectStore.setState({selectedLayerKeys:[],selectedPlaceholderId:'frame'})
key('x');key('C',true);key('V',true)
assert.deepEqual(calls.slice(2,4),[['copy','spread','frame'],['delete','spread',['frame'],{photoId:null}]])
useProjectStore.setState({selectedLayerKeys:[],selectedPlaceholderId:'frame'})
key('C',true);key('V',true)
assert.deepEqual(calls.slice(-2),[['copy-tone','spread','frame'],['paste-tone','spread',['frame']]])
calls.length=0
listeners.get('keydown')({key:'c',shiftKey:false,ctrlKey:false,metaKey:true,target:null,preventDefault(){}})
assert.deepEqual(calls,[['copy','spread','frame']],'Mac Command+C uses the same action')
calls.length=0
globalThis.HTMLElement=class {tagName='INPUT';isContentEditable=false}
key('c',false,new HTMLElement())
assert.deepEqual(calls,[],'Text fields retain their native clipboard')
useProjectStore.setState({multiSelectedPlaceholderIds:['one','two'],selectedPlaceholderId:null})
key('v')
assert.equal(calls[0][0],'paste','Paste inserts copied elements even with multiple target frames selected')
calls.length=0
useProjectStore.setState({selectedTextBoxId:'text',selectedPhotoIds:['photo']})
key('d')
assert.equal(useProjectStore.getState().selectedPlaceholderId,null)
assert.equal(useProjectStore.getState().selectedTextBoxId,null)
assert.deepEqual(useProjectStore.getState().selectedPhotoIds,[])
assert.deepEqual(useProjectStore.getState().multiSelectedPlaceholderIds,[])
const arrows=(key,extra={})=>listeners.get('keydown')({key,ctrlKey:false,metaKey:false,shiftKey:false,target:null,preventDefault(){},...extra})
const base=useProjectStore.getState().project
useProjectStore.setState({project:{...base,spreads:[{id:'two',order:2,placements:[],textBoxes:[]},{id:'cover',order:9,isCover:true,placements:[],textBoxes:[]},{id:'one',order:1,placements:[],textBoxes:[]}]},selectedSpreadId:'one',selectedPlaceholderId:null,selectedTextBoxId:null,multiSelectedPlaceholderIds:[],designerViewSpreadId:null,isDirty:false})
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
