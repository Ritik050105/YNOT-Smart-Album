import assert from 'node:assert/strict'
import { build } from 'esbuild'

const saved = new Map()
globalThis.localStorage = { getItem: k => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) }
globalThis.window ??= { dispatchEvent: () => true, addEventListener() {}, removeEventListener() {} }

const bundle = await build({
  stdin: {
    contents: `export {useProjectStore} from './src/state/projectStore'
export {createBlankSpread} from './src/engine/autoLayout'
export {computePlaceholderBoxes} from './src/engine/layoutMath'
export {respaceBoxes} from './src/engine/templateLayout'`,
    resolveDir: process.cwd(),
  },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const { useProjectStore: store, createBlankSpread, computePlaceholderBoxes, respaceBoxes } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

// --- the helper on its own ----------------------------------------------------------------------
// Four quarters, flush to the sheet: every outer edge is on the trim and the two inner seams are not.
const quarters = [
  { id: 'a', x: 0, y: 0, width: 0.5, height: 0.5, preferredOrientation: 'any' },
  { id: 'b', x: 0.5, y: 0, width: 0.5, height: 0.5, preferredOrientation: 'any' },
  { id: 'c', x: 0, y: 0.5, width: 0.5, height: 0.5, preferredOrientation: 'any' },
  { id: 'd', x: 0.5, y: 0.5, width: 0.5, height: 0.5, preferredOrientation: 'any' },
]
const wider = respaceBoxes(quarters, 1, { marginPx: 0, gapPx: 0 }, { marginPx: 0, gapPx: 40 })
assert.equal(wider[0].x, 0, 'a frame on the trim stays on the trim when the gap grows')
assert.equal(wider[0].y, 0, 'a frame on the trim stays on the trim when the gap grows')
assert.ok(wider[0].width < 0.5, 'its interior edge gives way to the gap')
assert.ok(wider[1].x > 0.5, 'the frame beside it moves the other way')
assert.ok(Math.abs((wider[1].x - (wider[0].x + wider[0].width)) - 40 / 900) < 1e-6, 'the seam is exactly the gap')
assert.equal(wider[3].x + wider[3].width, 1, 'the far corner keeps the trim too')

const inset = respaceBoxes(quarters, 1, { marginPx: 0, gapPx: 0 }, { marginPx: 90, gapPx: 0 })
assert.ok(Math.abs(inset[0].x - 0) < 1e-9, 'a trim edge ignores the margin as well — it is authored flush')
const insetMiddle = respaceBoxes(
  [{ id: 'm', x: 0.25, y: 0.25, width: 0.5, height: 0.5, preferredOrientation: 'any' }],
  1, { marginPx: 0, gapPx: 0 }, { marginPx: 90, gapPx: 0 })
assert.ok(insetMiddle[0].x > 0.25, 'a frame away from the trim is pulled in by the margin')

// A gap far wider than the cells must leave something to look at, not an inverted frame.
for (const box of respaceBoxes(quarters, 1, { marginPx: 0, gapPx: 0 }, { marginPx: 0, gapPx: 4000 })) {
  assert.ok(box.width > 0 && box.height > 0, `${box.id} survives an absurd gap`)
}

// --- and through the store, which is where it was missing ----------------------------------------
const photos = [{ id: 'one', width: 900, height: 600 }, { id: 'two', width: 600, height: 900 }]
const spread = { ...createBlankSpread(0, { backgroundColor: '#fff', marginPx: 10, gapPx: 10, borderWidth: 0, borderColor: '#fff' }), id: 's' }
store.setState(s => ({ project: { ...s.project, spreads: [spread], photos }, selectedSpreadId: 's', history: [], future: [] }))

const size = store.getState().project.size
const height = 900 * size.heightIn / size.widthIn
const asCustom = computePlaceholderBoxes(store.getState().project.spreads[0], 900, height)
  .map(b => ({ id: b.placeholderId, x: b.x / 900, y: b.y / height, width: b.width / 900, height: b.height / height, preferredOrientation: 'any' }))
store.getState().updateSpread('s', { customBoxes: asCustom })

const read = () => store.getState().project.spreads[0].customBoxes.map(b => [b.x, b.y, b.width, b.height].join(','))
const atTen = read()
store.getState().updateSpread('s', { gapPx: 60 })
const atSixty = read()
assert.notDeepEqual(atSixty, atTen, 'raising the gap re-spaces a spread holding absolute boxes')
store.getState().updateSpread('s', { marginPx: 80 })
assert.notDeepEqual(read(), atSixty, 'and so does raising the margin')

// Anything else must leave the boxes exactly as they are — this only answers to spacing.
const before = read()
store.getState().updateSpread('s', { backgroundColor: '#eeeeee' })
assert.deepEqual(read(), before, 'an unrelated edit does not move a single frame')
store.getState().updateSpread('s', { gapPx: 60 })
assert.deepEqual(read(), before, 'setting the gap to what it already is changes nothing')

console.log('Spread re-spacing checks passed: gap and margin reach spreads holding absolute boxes, and nothing else does.')
