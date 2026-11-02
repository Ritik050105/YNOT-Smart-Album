import assert from 'node:assert/strict'
import fs from 'node:fs'
import { transform } from 'esbuild'
const source = fs.readFileSync('src/App.tsx','utf8')
const start = source.indexOf('    if(!window.albumStudio?.isElectron||!recoveryChecked||resumePrompt)return')
const end = source.indexOf('  },[resumePrompt,recoveryChecked,project.id])',start)
const body = (await transform(source.slice(start,end),{loader:'ts'})).code
let state={project:{id:'a',name:'A',spreads:[],size:{label:'test'}},userTemplates:[],currentFilePath:null,isDirty:false}
let listener, pending=[], writes=[], invalidations=0, cleared=0
const store={getState:()=>state,subscribe:fn=>{listener=fn;return()=>{listener=null}}}
const win={albumStudio:{isElectron:true},setInterval:()=>1,clearInterval:()=>{},addEventListener:()=>{},removeEventListener:()=>{}}
const run=new Function('window','recoveryChecked','resumePrompt','useProjectStore','project','serializeProjectFile','persistRecovery','clearOpenSession','invalidateRecovery','setRecoveryError',body)
const cleanup=run(win,true,false,store,state.project,async p=>p.name,async promise=>{writes.push(await promise);await new Promise(resolve=>pending.push(resolve))},()=>cleared++,()=>invalidations++,()=>{})
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const edit=name=>{const prev=state;state={...state,isDirty:true,project:{...state.project,name}};listener(state,prev)}
await tick();assert.equal(writes.length,0)
edit('B');edit('C');await tick();assert.deepEqual(writes,['C'],'Same-turn edits coalesce immediately')
edit('D');await tick();assert.equal(writes.length,1,'Only one serialization/write in flight')
pending.shift()();await tick();assert.deepEqual(writes,['C','D'],'New edits saved immediately after active write')
pending.shift()();await tick()
const prev=state;state={...state,isDirty:false};listener(state,prev);await tick();assert.equal(cleared,1);assert.ok(invalidations)
cleanup();assert.equal(listener,null)
await tick();assert.equal(writes.length,2)
console.log('Edit-triggered recovery passed: immediate, coalesced, serialized, catch-up, clean-state and cleanup.')
