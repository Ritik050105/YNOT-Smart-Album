import assert from 'node:assert/strict'
import fs from 'node:fs'
import { transform } from 'esbuild'
const source = fs.readFileSync('src/App.tsx','utf8')
const start = source.indexOf('    if(!window.albumStudio?.isElectron||!recoveryChecked||resumePrompt)return')
const end = source.indexOf('  },[resumePrompt,recoveryChecked,projectId])',start)
const body = (await transform(source.slice(start,end),{loader:'ts'})).code
let state={project:{id:'a',name:'A',spreads:[],size:{label:'test'}},userTemplates:[],currentFilePath:null,isDirty:false}
let listener, pending=[], writes=[], invalidations=0, cleared=0
const store={getState:()=>state,subscribe:fn=>{listener=fn;return()=>{listener=null}}}
const win={albumStudio:{isElectron:true},setInterval:()=>1,clearInterval:()=>{},addEventListener:()=>{},removeEventListener:()=>{}}
const run=new Function('window','recoveryChecked','resumePrompt','useProjectStore','projectId','serializeProjectFile','persistRecovery','clearOpenSession','invalidateRecovery','setRecoveryError',body)
const cleanup=run(win,true,false,store,state.project.id,async p=>p.name,async promise=>{writes.push(await promise);await new Promise(resolve=>pending.push(resolve))},()=>cleared++,()=>invalidations++,()=>{})
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const edit=name=>{const prev=state;state={...state,isDirty:true,project:{...state.project,name}};listener(state,prev)}
await tick();assert.equal(writes.length,0)
edit('B');edit('C');await tick();assert.deepEqual(writes,['C'],'Same-turn edits coalesce immediately')
edit('D');await tick();assert.equal(writes.length,1,'Only one serialization/write in flight')
pending.shift()();await tick();assert.deepEqual(writes,['C'],'A burst of edits is not written again straight away: the next write waits a short while after the last')
await new Promise(resolve=>setTimeout(resolve,450));assert.deepEqual(writes,['C','D'],'The edits made meanwhile are then saved together')
pending.shift()();await tick()
const prev=state;state={...state,isDirty:false};listener(state,prev);await new Promise(resolve=>setTimeout(resolve,450));assert.equal(cleared,1);assert.ok(invalidations)
cleanup();assert.equal(listener,null)
await tick();assert.equal(writes.length,2)
console.log('Edit-triggered recovery passed: first change at once, bursts coalesced and rate-limited, serialized, catch-up, clean-state and cleanup.')
