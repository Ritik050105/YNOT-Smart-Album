// An album saved before a field existed simply has no such field. The code reads these as the
// arrays the types promise — forty-odd places read spread.textBoxes without asking whether it is
// there — so one missing list is a crash on open rather than a missing feature. That is exactly
// how a photograph with no `bins` emptied the whole photo dock.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const saved = new Map()
globalThis.localStorage = { getItem: k => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v), removeItem: k => saved.delete(k) }
globalThis.window ??= { dispatchEvent: () => true, addEventListener() {}, removeEventListener() {} }

const bundle = await build({
  stdin: { contents: `export {useProjectStore} from './src/state/projectStore'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const { useProjectStore: store } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

const size = store.getState().project.size

/** A file from an older version: no bins, no favourite, no textBoxes, no guides, no flipped. */
const oldFile = {
  version: 1,
  project: {
    id: 'old', name: 'Saved long ago', size, units: 'in',
    photos: [{ id: 'p1', fileName: 'one.jpg', src: 'data:,', width: 900, height: 600, orientation: 'landscape' }],
    spreads: [{ id: 's1', order: 0, templateId: 'two-vertical', marginPx: 10, gapPx: 10,
      backgroundColor: '#ffffff', borderWidth: 0, borderColor: '#fff',
      placements: [{ placeholderId: 'a', photoId: 'p1' }] }],
  },
  userTemplates: [],
}

store.getState().loadProjectFile(structuredClone(oldFile))
const project = store.getState().project

assert.equal(project.name, 'Saved long ago', 'the old file opened at all')
for (const spread of project.spreads) {
  assert.ok(Array.isArray(spread.textBoxes), `${spread.id}: textBoxes is an array`)
  assert.ok(Array.isArray(spread.placements), `${spread.id}: placements is an array`)
  assert.ok(spread.guides && Array.isArray(spread.guides.horizontal), `${spread.id}: guides are there`)
  assert.equal(typeof spread.flipped, 'boolean', `${spread.id}: flipped is a boolean`)
  assert.equal(typeof spread.isCover, 'boolean', `${spread.id}: isCover is a boolean`)
}
for (const photo of project.photos) {
  assert.ok(Array.isArray(photo.bins), `${photo.id}: bins is an array`)
  assert.equal(typeof photo.favorite, 'boolean', `${photo.id}: favorite is a boolean`)
}

// The forty-odd readers do this without asking. It must not throw.
for (const spread of project.spreads) {
  assert.equal(spread.textBoxes.filter(t => !t.locked).length, 0)
  assert.equal(spread.placements.some(p => p.photoId), true)
}

// A file with nothing in it at all is a file, not a crash.
store.getState().loadProjectFile({ version: 1, userTemplates: [], project: { id: 'empty', name: 'Empty', size, units: 'in' } })
assert.deepEqual(store.getState().project.spreads, [], 'a file with no spreads opens empty')
assert.deepEqual(store.getState().project.photos, [], 'a file with no photos opens empty')

console.log('Old project files open: missing lists are filled in, and nothing downstream has to ask whether they are there.')
