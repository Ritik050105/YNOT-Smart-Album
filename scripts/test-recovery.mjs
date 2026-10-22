import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { build } from 'esbuild'

const result = await build({ stdin: { contents: `export * from './electron/recovery'; export * from './src/engine/sessionMarker'; export * from './src/engine/projectFile'; export {useProjectStore} from './src/state/projectStore'`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false })
const api = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ynot-recovery-'))
const target = path.join(directory, 'recovery.json')
const saved = path.join(directory, 'saved.json')
const storage = new Map()
globalThis.localStorage = {setItem:(key,value)=>storage.set(key,value),getItem:(key)=>storage.get(key),removeItem:(key)=>storage.delete(key)}
globalThis.window = {albumStudio:{writeRecovery:async(snapshot)=>api.writeRecovery(target,snapshot),clearRecovery:async()=>api.clearRecovery(target)}}
try {
  const state = api.useProjectStore.getState()
  const contents = await api.serializeProjectFile({...state.project,name:'Unsaved edit',photos:[{id:'p',src:'data:image/png;base64,AA=='}]},state.userTemplates)
  fs.writeFileSync(saved, 'original saved album')
  const marker = {projectId:'test',filePath:saved,name:'Unsaved edit',clientName:'',sizeLabel:'test',spreadCount:0}
  await api.persistRecovery(Promise.resolve(contents),marker)
  assert.equal(api.deserializeProjectFile(api.readRecovery(target).contents).project.name,'Unsaved edit')
  assert.equal(api.deserializeProjectFile(api.readRecovery(target).contents).project.photos[0].src,'data:image/png;base64,AA==')
  assert.equal(fs.readFileSync(saved,'utf8'),'original saved album')
  assert.equal(api.loadOpenSession().hasRecovery,true)
  await api.persistRecovery(Promise.resolve(contents),{...marker,filePath:null})
  assert.equal(api.readRecovery(target).filePath,null,'Never-saved albums recover too')
  assert.throws(()=>api.writeRecovery(target,{filePath:null,contents:'{}'}))
  assert.equal(api.readRecovery(target).contents,contents,'Invalid writes preserve previous recovery')
  let resolve
  const pending = api.persistRecovery(new Promise((done)=>{resolve=done}),marker)
  api.clearOpenSession()
  resolve(contents)
  await pending
  assert.equal(api.readRecovery(target),null,'A late serializer must not resurrect saved/discarded work')
  assert.equal(api.loadOpenSession(),null)
  let older
  const old = api.persistRecovery(new Promise((done)=>{older=done}),marker)
  await api.persistRecovery(Promise.resolve(contents),{...marker,filePath:null})
  older(contents)
  await old
  assert.equal(api.readRecovery(target).filePath,null,'An older project must not replace the current recovery')
  fs.writeFileSync(target,'broken')
  assert.throws(()=>api.readRecovery(target))
  assert.equal(fs.readFileSync(target,'utf8'),'broken','Corrupt recovery is retained for manual recovery')
  api.clearRecovery(target)
  assert.equal(api.readRecovery(target),null)
  console.log('Recovery checks passed: unsaved edits/photos, untitled album, saved-file isolation, invalid/corrupt data, stale writes and discard.')
} finally { fs.rmSync(directory,{recursive:true,force:true}) }
