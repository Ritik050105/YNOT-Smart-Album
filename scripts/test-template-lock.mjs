// Locking a spread's template keeps applyTemplateToSpread/cycleSpreadTemplate/cycleSpreadMixedTemplate
// from changing its layout, while photo swaps (setPlacementPhoto) still work.
import assert from 'node:assert/strict'
import { build } from 'esbuild'
const saved = new Map()
globalThis.localStorage = { getItem: k => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) }
globalThis.window ??= { dispatchEvent: () => true, addEventListener() {}, removeEventListener() {} }
const result = await build({
  stdin: { contents: `export {useProjectStore} from './src/state/projectStore'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const { useProjectStore: store } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const state = () => store.getState()
store.setState(s => ({ project: { ...s.project, photos: ['a', 'b', 'c', 'd'].map(id => ({ id, fileName: id + '.jpg', src: 'x', width: 600, height: 400, orientation: 'landscape', bins: [], favorite: false })) } }))
for (const id of ['a', 'b', 'c', 'd']) state().insertTimelinePhotos([id], null)
const spread = state().project.spreads.find(s => !s.isCover)
assert.ok(spread, 'an interior spread exists')

state().cycleSpreadTemplate(spread.id, 1)
const templateIdBefore = state().project.spreads.find(s => s.id === spread.id).templateId

state().updateSpread(spread.id, { templateLocked: true })
state().cycleSpreadTemplate(spread.id, 1)
state().cycleSpreadMixedTemplate(spread.id, 1)
state().applyTemplateToSpread(spread.id, 'some-other-template-id')
assert.equal(state().project.spreads.find(s => s.id === spread.id).templateId, templateIdBefore, 'locked spread keeps its template through cycling and direct apply')

const photoIdBefore = state().project.spreads.find(s => s.id === spread.id).placements[0].photoId
state().setPlacementPhoto(spread.id, state().project.spreads.find(s => s.id === spread.id).placements[0].placeholderId, 'd')
assert.notEqual(state().project.spreads.find(s => s.id === spread.id).placements[0].photoId, photoIdBefore, 'photos can still be swapped while the template is locked')

state().updateSpread(spread.id, { templateLocked: false })
state().cycleSpreadTemplate(spread.id, 1)
assert.notEqual(state().project.spreads.find(s => s.id === spread.id).templateId, templateIdBefore, 'unlocking lets the template cycle again')

console.log('Template lock checks passed: layout locked, photo swaps still allowed, unlock restores cycling.')
