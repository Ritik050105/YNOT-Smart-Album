import assert from 'node:assert/strict'
import { build } from 'esbuild'

const effects=[]
globalThis.__gestureEffects=effects
const bundle=await build({stdin:{contents:`export {useTimelineDrag} from './src/engine/useTimelineDrag'; export {useProjectStore} from './src/state/projectStore'`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,plugins:[{
  name:'hook-lifecycle', setup(build) {
    build.onResolve({filter:/^react$/},()=>({path:'react',namespace:'hook-test'}))
    build.onLoad({filter:/.*/,namespace:'hook-test'},()=>({contents:`
      export const useRef=(current)=>({current});
      export const useState=(value)=>[value,()=>{}];
      export const useEffect=(effect)=>globalThis.__gestureEffects.push(effect);
      export default {};
    `}))
  },
}]})
const {useTimelineDrag,useProjectStore}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const listeners=new Map()
globalThis.window={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type)=>listeners.delete(type)}
let rafId=0
const frames=new Map()
globalThis.requestAnimationFrame=(fn)=>{const id=++rafId;frames.set(id,()=>{frames.delete(id);fn()});return id}
globalThis.cancelAnimationFrame=(id)=>frames.delete(id)
class Item {
  constructor(dataset={},matches={}) {this.dataset=dataset;this.matches=matches;this.scrollLeft=0}
  closest(selector) {return this.matches[selector]??null}
  hasAttribute(name) {return name==='data-spread-drag'&&this.isSpread}
  setPointerCapture(id) {this.captured=id}
  getBoundingClientRect() {return {left:0,right:100,top:0,bottom:100,width:100}}
  querySelectorAll() {return this.children??[]}
}
globalThis.Element=Item
const column=new Item({timelineSpread:'target'})
const first=new Item({timelineFrame:'frame-1'})
first.matches['[data-timeline-frame]']=first
first.matches['[data-timeline-spread]']=column
column.children=[first,new Item({timelineFrame:'frame-2'})]
const viewport=new Item()
const dock=new Item({dockPhoto:'photo-1'})
dock.matches['[data-timeline-frame], [data-dock-photo], [data-spread-drag]']=dock
const button=new Item()
button.matches['button, input, select, textarea, a']=button
let under=first
globalThis.document={elementFromPoint:()=>under,querySelector:()=>viewport,querySelectorAll:()=>[dock,new Item({dockPhoto:'photo-2'})]}
useProjectStore.setState({project:{...useProjectStore.getState().project,photos:[{id:'photo-1',src:'one'},{id:'photo-2',src:'two'}]},selectedPhotoIds:['photo-2','photo-1']})
const drops=[]
useTimelineDrag((source,target)=>drops.push({source,target}))
const cleanup=effects[0]()
function event(target=dock,x=10,y=10) {return {target,clientX:x,clientY:y,pointerId:1,button:0,preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true}}}
function send(type,value) {listeners.get(type)(value);return value}
send('pointerdown',event())
send('pointerup',event())
assert.equal(drops.length,0,'A click must not drop photos')
send('pointerdown',event())
send('pointermove',event(dock,20))
send('pointerup',event(dock,20))
assert.deepEqual(drops.pop(),{source:{spreadId:undefined,frameId:undefined,photoIds:['photo-1','photo-2']},target:{spreadId:'target',beforeFrameId:'frame-1'}})
send('pointerdown',event())
send('pointermove',event(dock,80))
send('pointerup',event(dock,80))
assert.equal(drops.pop().target.beforeFrameId,'frame-2','Right half inserts after the hovered frame')
send('pointerdown',event())
send('pointermove',event(dock,95))
const scrollCallback=frames.values().next().value
scrollCallback()
assert.equal(viewport.scrollLeft,10,'Dragging near the viewport edge must scroll')
send('keydown',{key:'Escape',preventDefault(){},stopPropagation(){}})
send('pointerup',event(dock,95))
assert.equal(drops.length,0,'Escape cancels the drag')
send('pointerdown',event())
send('pointermove',event(dock,80))
send('blur',{})
send('pointerup',event(dock,80))
assert.equal(drops.length,0,'Losing focus cancels the drag')
send('pointerdown',event(button))
send('pointermove',event(button,80))
send('pointerup',event(button,80))
assert.equal(drops.length,0,'Dock buttons must keep their own interactions')
under=null
send('pointerdown',event())
send('pointermove',event(dock,80))
send('pointerup',event(dock,80))
assert.equal(drops.length,0,'Dropping outside a target must not mutate the album')
const cover=new Item()
cover.matches['[data-cover-drop]']=cover
under=cover
send('pointerdown',event())
send('pointermove',event(dock,80))
send('pointerup',event(dock,80))
assert.deepEqual(drops.pop().target,{spreadId:null,cover:true},'Cover creation must retain dock drops')
const newSpread=new Item()
newSpread.matches['[data-new-spread]']=newSpread
under=newSpread
const spreadCard=new Item()
spreadCard.isSpread=true
spreadCard.matches['[data-timeline-frame], [data-dock-photo], [data-spread-drag]']=spreadCard
spreadCard.matches['[data-timeline-spread]']=column
spreadCard.querySelector=()=>({toDataURL:()=> 'spread-preview'})
send('pointerdown',event(spreadCard))
send('pointermove',event(spreadCard,80))
send('pointerup',event(spreadCard,80))
assert.deepEqual(drops.pop(),{source:{spreadId:'target',photoIds:[]},target:{spreadId:null}},'Whole spread drags must be distinct from image moves')
cleanup()
assert.equal(listeners.size,0)
assert.equal(frames.size,0)
console.log('Timeline gesture checks passed: click threshold, selected dock order, insertion sides, scrolling, Escape/focus cancellation, button isolation and outside drops.')
