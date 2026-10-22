import assert from 'node:assert/strict'
import { build } from 'esbuild'
const storage = new Map()
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) }
const result = await build({entryPoints:['src/engine/recentProjects.ts'],bundle:true,platform:'node',format:'esm',write:false})
const {recordRecentProject,loadRecentProjects,setRecentProjectStatus,browseRecentProjects} = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const entry = {projectId:'a',name:'Album 10',clientName:'Maya',sizeLabel:'12x12',spreadCount:2,createdAt:'2024-01-01',kind:'album'}
recordRecentProject(entry)
setRecentProjectStatus('a','Approved')
recordRecentProject({...entry,name:'Renamed'})
assert.equal(loadRecentProjects()[0].status,'Approved','Saving keeps the local status')
assert.equal(loadRecentProjects()[0].createdAt,'2024-01-01','Saving keeps creation date')
const fixtures=[{...entry,updatedAt:'2025-02-01',status:'Approved'},{...entry,projectId:'b',name:'Album 2',createdAt:'2023-01-01',updatedAt:'2025-03-01'},{...entry,projectId:'c',kind:'gallery',updatedAt:'2025-01-01'}]
assert.deepEqual(browseRecentProjects(fixtures,'album','',[],'name').map(e=>e.projectId),['b','a'])
assert.deepEqual(browseRecentProjects(fixtures,'album','',[],'created-asc').map(e=>e.projectId),['b','a'])
assert.deepEqual(browseRecentProjects(fixtures,'album','',[],'created-desc').map(e=>e.projectId),['a','b'])
assert.deepEqual(browseRecentProjects(fixtures,'album','',[],'modified').map(e=>e.projectId),['b','a'])
assert.deepEqual(browseRecentProjects(fixtures,'album',' MAYA ',['Approved'],'modified').map(e=>e.projectId),['a'])
assert.deepEqual(browseRecentProjects(fixtures,'album','',['Unpublished draft'],'modified').map(e=>e.projectId),['b'])
assert.equal(browseRecentProjects(fixtures,'album','',['Approved','Unpublished draft'],'modified').length,2)
assert.equal(browseRecentProjects(fixtures,'gallery','',['Archived'],'modified').length,1,'Album filters never hide galleries')
assert.equal(browseRecentProjects(fixtures,'album','missing',[],'modified').length,0)
assert.equal(fixtures[0].projectId,'a','Sorting does not mutate input')
console.log('Project-browser checks passed: status persistence, legacy draft fallback, combined search/status, four sort orders and gallery isolation.')
