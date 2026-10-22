import assert from 'node:assert/strict'
import { build } from 'esbuild'
const result=await build({stdin:{contents:`export {default} from './src/components/AutoBuildModal';export {reset,clear} from 'react';export {templatesForCount} from './src/engine/templates'`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'dialog-state',setup(build){
  const stub=(filter,namespace,contents)=>{build.onResolve({filter},()=>({path:namespace,namespace}));build.onLoad({filter:/.*/,namespace},()=>({contents}))}
  stub(/^react$/,'react',`let state=[],cursor=0;export const reset=()=>{cursor=0};export const clear=()=>{state=[];cursor=0};export const useState=value=>{const i=cursor++;if(!(i in state))state[i]=value;return [state[i],value=>state[i]=value]};export const useMemo=fn=>fn();export const useRef=current=>({current});export const useEffect=()=>{};`)
  stub(/^react-dom$/,'portal','export const createPortal=node=>node;')
  stub(/^react\/jsx-runtime$/,'jsx','export const Fragment="fragment";export const jsx=(type,props)=>({type,props});export const jsxs=jsx;')
  stub(/^@\/state\/projectStore$/,'store','export const useProjectStore=selector=>selector(globalThis.dialogStore);')
}}]})
const {default:AutoBuild,reset,clear,templatesForCount}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const photos=Array.from({length:72},(_,i)=>({id:String(i),width:900,height:600,capturedAt:new Date(i*60000).toISOString()}))
globalThis.dialogStore={project:{photos,spreads:[],size:{widthIn:12,heightIn:8},defaultGapPx:8,defaultMarginPx:24,enabledTemplateIds:null,layoutStart:'spread',layoutEnd:'spread',includeFullSpreadTemplates:true},templateFrameFilter:'all',autoLayoutOptions:{gapMinutes:20,maxPhotosPerSpread:6,matchTimelineOrder:true}}
const render=()=>{reset();return AutoBuild({photoIds:photos.map(p=>p.id),onClose(){}})}
function nodes(node){return Array.isArray(node)?node.flatMap(nodes):node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[]}
const count=tree=>nodes(tree).find(node=>node.props?.id==='auto-build-count').props.value
let tree=render()
assert.equal(count(tree),18)
const criteria=nodes(tree).filter(node=>node.type==='input'&&node.props.type==='checkbox')
criteria.forEach(node=>node.props.onChange({target:{checked:false}}))
tree=render()
const buildButton=tree=>nodes(tree.props.footer).find(node=>node.props.className==='btn btn--primary')
assert.equal(buildButton(tree).props.disabled,true,'SmartAlbums disables Smart Grouping when all three criteria are off')
let noCriteriaSubmissions=0
dialogStore.runAutoBuildFromGroups=()=>{noCriteriaSubmissions++}
buildButton(tree).props.onClick()
assert.equal(noCriteriaSubmissions,0,'The build handler also rejects a stale click after criteria were disabled')
nodes(tree).find(node=>node.type==='input'&&node.props.type==='checkbox').props.onChange({target:{checked:true}})
tree=render()
assert.equal(buildButton(tree).props.disabled,false,'One enabled criterion permits a smart build')
criteria.forEach(node=>node.props.onChange({target:{checked:false}}))
tree=render()
nodes(tree).find(node=>node.type==='label'&&nodes(node).some(child=>child.type==='input'&&child.props.type==='radio')&&node.props.children.includes('Specify range')).props.children[0].props.onChange()
tree=render()
assert.equal(count(tree),18,'Switching to range must preserve the suggested count for a larger album')
assert.equal(buildButton(tree).props.disabled,false,'Specify range remains usable with all smart criteria off')
dialogStore.project.enabledTemplateIds=[templatesForCount(2)[0].id,templatesForCount(4)[0].id]
let submitted
dialogStore.runAutoBuildFromGroups=groups=>{submitted=groups}
tree=render()
nodes(tree.props.footer).find(node=>node.type==='button'&&node.props.className==='btn btn--primary').props.onClick()
assert.equal(submitted.length,18)
assert.ok(submitted.every(group=>group.length===4),'A two/four-frame library must build 72 photos without unsupported three-frame groups')
assert.equal(new Set(submitted.flat()).size,72)
dialogStore.project.enabledTemplateIds=[templatesForCount(2)[0].id]
tree=render()
assert.equal(nodes(tree.props.footer).find(node=>node.props.className==='btn btn--primary').props.disabled,true,'An impossible library/count combination stays open and cannot build')
console.log('Auto Build dialog checks passed: switching to Specify range preserves the current spread count.')

clear()
tree=render()
assert.equal(count(tree),36,'Automatic recommendation must adapt to a two-frame-only library')
assert.equal(nodes(tree.props.footer).find(node=>node.props.className==='btn btn--primary').props.disabled,false)
nodes(tree).find(node=>node.props?.id==='auto-build-count').props.onChange({target:{value:'18'}})
tree=render()
assert.equal(count(tree),18,'An explicit user count is not silently replaced')
assert.equal(nodes(tree.props.footer).find(node=>node.props.className==='btn btn--primary').props.disabled,true)
clear()
dialogStore.project.photos=photos.slice(0,12)
dialogStore.project.enabledTemplateIds=[templatesForCount(3)[0].id,templatesForCount(5)[0].id]
tree=render()
assert.equal(count(tree),4,'The recommendation skips an impossible three-spread combination of three/five-frame templates')
clear()
dialogStore.project.photos=photos.slice(0,9).map((photo,i)=>({...photo,isBlackAndWhite:i>=6,cameraModel:'Camera A'}))
dialogStore.project.enabledTemplateIds=null
tree=render()
assert.equal(count(tree),3)
nodes(tree).find(node=>node.props?.id==='auto-build-count').props.onChange({target:{value:'4'}})
tree=render()
buildButton(tree).props.onClick()
assert.deepEqual(submitted,[['0','1','2'],['3','4','5'],['6','7'],['8']],'The dialog submits the four groups observed in the reference, retaining the two original three-image groups')
