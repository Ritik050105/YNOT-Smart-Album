import assert from 'node:assert/strict'
import { build } from 'esbuild'
const calls=[]
const state={project:{photos:[{id:'b',capturedAt:'2020-01-02'},{id:'c',capturedAt:'2020-01-03'},{id:'a',capturedAt:'2020-01-01'}].map((photo)=>({...photo,fileName:photo.id+'.jpg',bins:[],src:'data:',favorite:false})),spreads:[]},selectedPhotoIds:[],photoDockZoom:80,
  setSelectedPhotoIds:(ids)=>{state.selectedPhotoIds=ids;calls.push(['all',ids])},
  togglePhotoSelection:(...args)=>calls.push(['select',...args])}
globalThis.__photoBrowserState=state
const result=await build({entryPoints:['src/components/PhotoBin.tsx'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'shallow-render',setup(build){
  build.onResolve({filter:/^react$/},()=>({path:'react',namespace:'test'}))
  build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`export const useState=(value)=>[value==='all' && globalThis.__browserFilter ? globalThis.__browserFilter : value,()=>{}];export const useEffect=()=>{};export const useRef=(current)=>({current});export const useMemo=(fn)=>fn();export default {};`}))
  build.onResolve({filter:/^react-dom$/},()=>({path:'react-dom',namespace:'portal'}))
  build.onLoad({filter:/.*/,namespace:'portal'},()=>({contents:'export const createPortal=()=>null;'}))
  build.onResolve({filter:/^react\/jsx-runtime$/},()=>({path:'jsx',namespace:'jsx'}))
  build.onLoad({filter:/.*/,namespace:'jsx'},()=>({contents:'export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment="fragment";'}))
  build.onResolve({filter:/^@\/state\/projectStore$/},()=>({path:'store',namespace:'store'}))
  build.onLoad({filter:/.*/,namespace:'store'},()=>({contents:'export const useProjectStore=(selector)=>selector(globalThis.__photoBrowserState);useProjectStore.getState=()=>globalThis.__photoBrowserState;'}))
  build.onResolve({filter:/^@\/engine\/useImportPhotos$/},()=>({path:'import',namespace:'import'}))
  build.onLoad({filter:/.*/,namespace:'import'},()=>({contents:'export const useImportPhotos=()=>({handleFiles:()=>{},importing:false});'}))
}}]})
const {default:PhotoBin}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const find=(node,predicate)=>{if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const match=find(child,predicate);if(match)return match}return null}
globalThis.HTMLInputElement=class {}
let focused='',scrolled=''
const items=['a','b','c'].map((id)=>({dataset:{dockPhoto:id},focus(){focused=id},scrollIntoView(){scrolled=id}}))
const strip=()=>find(PhotoBin(),(node)=>node.props?.['aria-label']==='Image browser')
const event=(key,extra={})=>({key,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,target:{closest:()=>null},currentTarget:{querySelectorAll:()=>items},preventDefault(){this.defaultPrevented=true},...extra})
strip().props.onKeyDown(event('a',{ctrlKey:true}))
assert.deepEqual(calls.pop(),['all',['a','b','c']],'Select All follows visible chronological order')
strip().props.onKeyDown(event('ArrowLeft',{target:{closest:()=>items[2]}}))
assert.deepEqual(calls.pop(),['select','b',['a','b','c'],'single'])
assert.equal(focused,'b');assert.equal(scrolled,'b')
strip().props.onKeyDown(event('ArrowRight',{shiftKey:true,target:{closest:()=>items[0]}}))
assert.deepEqual(calls.pop(),['select','b',['a','b','c'],'range'])
strip().props.onKeyDown(event('a',{ctrlKey:true,target:new HTMLInputElement()}))
assert.equal(calls.length,0,'Text fields retain Select All')
globalThis.__browserFilter='unplaced'
state.project.spreads=[{placements:[{photoId:'a'}]}]
strip().props.onKeyDown(event('a',{ctrlKey:true}))
assert.deepEqual(calls.pop(),['all',['b','c']],'Filtered-out photos are not selected')
console.log('Photo-browser checks passed: chronological Select All, focus-local arrows, range selection, scroll/focus and text-field isolation.')
