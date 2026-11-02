// Deleting every image of the spread open in Designer View removes the spread and returns to the normal window.
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
store.setState(s => ({ project: { ...s.project, photos: ['a', 'b'].map(id => ({ id, fileName: id + '.jpg', src: 'x', width: 600, height: 400, orientation: 'landscape', bins: [], favorite: false })) } }))
state().insertTimelinePhotos(['a'], null)
state().insertTimelinePhotos(['b'], null)
const [first, second] = state().project.spreads.filter(s => !s.isCover)
assert.ok(first && second, 'two interior spreads')
state().enterDesignerView(first.id)
assert.equal(state().designerViewSpreadId, first.id)
state().removeImageFrame(first.id, first.placements[0].placeholderId)
assert.ok(!state().project.spreads.some(s => s.id === first.id), 'the emptied spread is deleted')
assert.equal(state().designerViewSpreadId, null, 'Designer View closes instead of showing a blank canvas')
assert.ok(state().project.spreads.some(s => s.id === second.id), 'other spreads are untouched')
state().undo()
assert.ok(state().project.spreads.some(s => s.id === first.id), 'undo brings the spread back')
console.log('Designer empty-exit checks passed.')
