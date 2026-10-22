import assert from 'node:assert/strict'
import { build } from 'esbuild'
const calls=[]
const state={project:{photos:[{id:'b',capturedAt:'2020-01-02'},{id:'c',capturedAt:'2020-01-03'},{id:'a',capturedAt:'2020-01-01'}].map((photo)=>({...photo,fileName:photo.id+'.jpg',bins:[],src:'data:',favorite:false})),spreads:[]},selectedPhotoIds:[],photoDockZoom:80,
  setSelectedPhotoIds:(ids)=>{state.selectedPhotoIds=ids;calls.push(['all',ids])},
  togglePhotoSelection:(...args)=>calls.push(['select',...args])}
globalThis.__photoBrowserState=state
const result=await build({entryPoints:['src/components/PhotoBin.tsx'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'shallow-render',setup(build){
  build.onResolve({filter:/^react$/},()=>({path:'react',namespace:'test'}))
  build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`export const useState=(value)=>{const index=globalThis.__hookIndex++;return [index in globalThis.__hooks?globalThis.__hooks[index]:(value==='all' && globalThis.__browserFilter ? globalThis.__browserFilter : value),(next)=>{globalThis.__hooks[index]=next}];};export const useEffect=()=>{};export const useRef=(current)=>({current});export const useMemo=(fn)=>fn();export default {};`}))
  build.onResolve({filter:/^react-dom$/},()=>({path:'react-dom',namespace:'portal'}))
  build.onLoad({filter:/.*/,namespace:'portal'},()=>({contents:'export const createPortal=()=>null;'}))
  build.onResolve({filter:/^react\/jsx-runtime$/},()=>({path:'jsx',namespace:'jsx'}))
  build.onLoad({filter:/.*/,namespace:'jsx'},()=>({contents:'export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment="fragment";'}))
  build.onResolve({filter:/^@\/state\/projectStore$/},()=>({path:'store',namespace:'store'}))
  build.onLoad({filter:/.*/,namespace:'store'},()=>({contents:'export const useProjectStore=(selector)=>selector(globalThis.__photoBrowserState);useProjectStore.getState=()=>globalThis.__photoBrowserState;'}))
  build.onResolve({filter:/^@\/engine\/useImportPhotos$/},()=>({path:'import',namespace:'import'}))
  build.onLoad({filter:/.*/,namespace:'import'},()=>({contents:'export const useImportPhotos=()=>({handleFiles:()=>{},importing:false,lastSummary:globalThis.__importSummary});'}))
}}]})
const {default:PhotoBin}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const find=(node,predicate)=>{if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const match=find(child,predicate);if(match)return match}return null}
globalThis.HTMLInputElement=class {}
let focused='',scrolled=''
const items=['a','b','c'].map((id)=>({dataset:{dockPhoto:id},focus(){focused=id},scrollIntoView(){scrolled=id}}))
globalThis.__hooks={};globalThis.__hookIndex=0
const render=()=>{globalThis.__hookIndex=0;return PhotoBin()}
const strip=()=>find(render(),(node)=>node.props?.['aria-label']==='Image browser')
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

const control=(label)=>find(render(),node=>node.props?.['aria-label']===label)
globalThis.__browserFilter='all'
const usedPhoto=find(render(),node=>node.props?.['data-dock-photo']==='a')
assert.equal(usedPhoto.props.draggable,true,'Used photos remain draggable')
usedPhoto.props.onClick({currentTarget:{focus(){}},shiftKey:false,ctrlKey:false,metaKey:false})
assert.deepEqual(calls.pop(),['select','a',['a','b','c'],'single'],'Used photos remain selectable')
const transfer={setData(type,value){this[type]=value}}
usedPhoto.props.onDragStart({dataTransfer:transfer})
assert.equal(transfer.effectAllowed,'copy','Reuse copies the photo instead of moving its original placement')
assert.equal(transfer['application/x-photo-id'],'a')
globalThis.__browserFilter='unplaced'
for(const tool of ['Search photos','Filter photos','Sort photos','Import folder']) assert.ok(control(tool),tool+' is visible')
control('Search photos').props.onClick()
control('Search photo filenames').props.onChange({target:{value:'b.jpg'}})
strip().props.onKeyDown(event('a',{ctrlKey:true}))
assert.deepEqual(calls.pop(),['all',['b']],'Search filters filenames')
control('Clear search').props.onClick()
control('Sort photos').props.onClick()
control('Sort direction').props.onChange({target:{value:'descending'}})
strip().props.onKeyDown(event('a',{ctrlKey:true}))
assert.deepEqual(calls.pop(),['all',['c','b']],'Descending sort reverses visible order')
control('Filter photos').props.onClick()
assert.ok(find(render(),node=>node.props?.children?.includes?.('Favorites')))
state.project.photos=[]
for(const tool of ['Search photos','Filter photos','Sort photos','Import folder']) assert.ok(control(tool),tool+' remains available before import')
assert.ok(find(render(),node=>node.type==='input'&&node.props.webkitdirectory===''),'Folder picker accepts directories')
console.log('Photo toolbar checks passed: search, filter options, reverse sort, folder input and empty-library controls.')

globalThis.__importSummary={importedCount:0,duplicateCount:3,rejected:[{fileName:'notes.txt'}],failures:[]}
assert.ok(find(render(),node=>[node.props?.children].flat().includes('0 photos imported · 3 duplicates skipped · 1 non-image file skipped')),'Import summary remains visible')
control('Search photos').props.onClick()
control('Search photo filenames').props.onChange({target:{value:'hidden'}})
control('Close photo options').props.onClick()
assert.ok(find(render(),node=>node.type==='button'&&node.props.children==='Clear all filters'),'Active filters can be cleared after options close')
find(render(),node=>node.type==='button'&&node.props.children==='Clear all filters').props.onClick()
assert.equal(find(render(),node=>node.type==='button'&&node.props.children==='Clear all filters'),null)
console.log('Photo toolbar feedback checks passed: import summary and collapsed-filter reset.')
