// A spread that holds the same photograph more than once (a dozen frames, a few pictures repeated) must give every frame its
// own place in a move. Keyed by photograph alone, the repeats collapsed onto the first appearance of their picture and were
// drawn over it for the whole move, so only the first few frames seemed to travel and the rest appeared at the end.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: {
    contents: `export {frameRects,placementKeys} from './src/engine/moveRects'
export {retemplateSpread,createBlankSpread,defaultPlacement} from './src/engine/autoLayout'
export {templatesForCount,sequenceCandidates} from './src/engine/templates'`,
    resolveDir: process.cwd(),
  },
  bundle: true, loader: { '.ttf': 'dataurl', '.png': 'dataurl', '.icc': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const m = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const n = 12
// Twelve frames, only three different photographs, repeated.
const ids = Array.from({ length: n }, (_, i) => ['a', 'b', 'c'][i % 3])
const photos = ['a', 'b', 'c'].map((id, i) => ({ id, src: '', width: i === 1 ? 900 : 1500, height: i === 1 ? 1500 : 1000, name: id, bins: [], capturedAt: new Date().toISOString() }))
const blank = m.createBlankSpread(0, { backgroundColor: '#fff', marginPx: 3, gapPx: 6, borderWidth: 0, borderColor: '#fff' })
const base = { ...blank, placements: ids.map((id, i) => m.defaultPlacement('f' + i, id)) }
const templates = m.templatesForCount(n, null, 'all', 1.5).slice(0, 2)
assert.ok(templates.length === 2, 'two layouts to move between')
const [first, second] = templates.map(t => m.retemplateSpread(base, t.id, photos, 1.5, true))

for (const spread of [first, second]) {
  assert.equal(spread.placements.length, n)
  const keys = [...m.placementKeys(spread).values()]
  assert.equal(new Set(keys).size, n, 'every placement has its own key, repeats of one photograph numbered')
  const rects = m.frameRects(spread, 100 * 12 / 18)
  assert.equal(rects.size, n, 'every placement has its own frame on the card')
}
// The nth appearance of a photograph before a change is the nth after, so each frame has somewhere to travel from.
const before = m.frameRects(first, 100 * 12 / 18), after = m.frameRects(second, 100 * 12 / 18)
for (const key of after.keys()) assert.ok(before.has(key), `${key} has a place to start from`)
console.log('Move rect checks passed: twelve frames of three repeated photographs each get their own start and end in a move.')
