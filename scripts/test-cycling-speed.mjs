// Pressing Next / Previous template, held down, must cost next to nothing per press. The layouts on offer for a spread depend
// only on how many photographs it has, their shapes in order, the album's shape, margin and gap, and the filters, none of which a
// change of layout alters, so after the first press the answer is looked up, not worked out again.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: {
    contents: `export {cyclingTemplates,cyclingCount} from './src/state/templateBrowsing'
export {createBlankSpread,defaultPlacement} from './src/engine/autoLayout'
export {setUserTemplateRegistry,templatesForCount,isStaircase,arrangementSignature,findTemplate} from './src/engine/templates'
export {varyPatterns,patternClass} from './src/engine/layoutOffer'
export {balancedTemplates} from './src/engine/balancedLayouts'
export {templateFramesInReadingOrder} from './src/engine/templateMatching'
export {resolveTemplateFramesShared} from './src/engine/templateLayout'
export {readCollectionsShared} from './src/engine/templateCollections'`,
    resolveDir: process.cwd(),
  },
  bundle: true, loader: { '.ttf': 'dataurl', '.png': 'dataurl', '.icc': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const m = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const shapes = [[900, 600], [600, 900], [700, 700], [1200, 800], [800, 1200], [900, 600], [1200, 800], [600, 900]]
const make = (n, gap = 6) => {
  const photos = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, src: '', width: shapes[i % 8][0], height: shapes[i % 8][1], name: 'p' + i, bins: [], capturedAt: new Date().toISOString() }))
  const spread = { ...m.createBlankSpread(0, { backgroundColor: '#fff', marginPx: 3, gapPx: gap, borderWidth: 0, borderColor: '#fff' }), id: 's', placements: photos.map((p, i) => m.defaultPlacement('f' + i, p.id)) }
  return { photos, spread, project: { size: { widthIn: 18, heightIn: 12 }, enabledTemplateIds: null, photos, spreads: [spread] } }
}

const { project, spread } = make(6)
const none = []   // the store hands out one favourites list until it changes, so a test must too
const first = m.cyclingTemplates(project, spread, 'all', none)
assert.ok(first.length >= 1, 'a six-photo spread has layouts to cycle through')
// A change of layout makes a new spread object. The answer for it is the very same list.
const changed = { ...spread, templateId: 'something-else', placements: [...spread.placements].reverse().reverse() }
assert.equal(m.cyclingTemplates(project, changed, 'all', none), first, 'a new spread object with the same photographs gets the same list back')
assert.equal(m.cyclingCount(project, changed, 'all', none), first.length)

// Held down: two hundred presses, each on a fresh spread object, are lookups.
const t0 = performance.now()
for (let i = 0; i < 200; i++) m.cyclingTemplates(project, { ...spread, templateId: 't' + i }, 'all', none)
const perPress = (performance.now() - t0) / 200
assert.ok(perPress < 1, `a repeated press costs under a millisecond (${perPress.toFixed(3)} ms)`)

// What the answer depends on still changes it.
assert.notEqual(m.cyclingTemplates(project, { ...spread, gapPx: 24 }, 'all', none), first, 'a different gap is a different question')
assert.notEqual(m.cyclingTemplates(project, spread, 'no-square', none), first, 'a different frame filter is a different question')
const other = make(6); other.photos[0].width = 600; other.photos[0].height = 900   // first photograph turns portrait
assert.notEqual(m.cyclingTemplates(other.project, other.spread, 'all', none), first, 'photographs of other shapes are a different question')
m.setUserTemplateRegistry([])
assert.notEqual(m.cyclingTemplates(project, spread, 'all', none), first, 'a change to the template library drops remembered answers')

// The pieces it is built from are remembered too, and shared (read, never changed).
const t = m.templatesForCount(6, null, 'all', 1.5)[0]
assert.equal(m.templateFramesInReadingOrder(t), m.templateFramesInReadingOrder(t), 'a template\'s reading order is worked out once')
assert.equal(m.resolveTemplateFramesShared(t.placeholders, 1.5, 3, 6), m.resolveTemplateFramesShared(t.placeholders, 1.5, 3, 6), 'resolved frames are worked out once per setting')
assert.notEqual(m.resolveTemplateFramesShared(t.placeholders, 1.5, 3, 6), m.resolveTemplateFramesShared(t.placeholders, 1.5, 3, 12))
assert.equal(m.readCollectionsShared(), m.readCollectionsShared(), 'saved collections are parsed once per change')

// Patterns: Next walks through different arrangements, not one cut at five sizes, and the rising staircase is gone.
{
  const frame = (x, y, width, height) => ({ id: `f${x}${y}`, x, y, width, height, preferredOrientation: 'any' })
  const rising = { placeholders: [frame(0, 0, 0.16, 1), frame(0.16, 0.18, 0.16, 0.82), frame(0.32, 0.36, 0.16, 0.64), frame(0.5, 0, 0.5, 1)], id: 'x' }
  assert.ok(m.isStaircase(rising), 'frames stepping down from a shared bottom edge are a staircase')
  const grid = { placeholders: [frame(0, 0, 0.33, 0.5), frame(0.33, 0, 0.33, 0.5), frame(0.66, 0, 0.34, 0.5), frame(0, 0.5, 1, 0.5)], id: 'y' }
  assert.ok(!m.isStaircase(grid), 'a grid is not')
  for (const n of [2, 3, 4, 13]) for (const side of ['left', 'right']) assert.ok(m.findTemplate(`gen-full-${side}-cascade-${n}`) && m.isStaircase(m.findTemplate(`gen-full-${side}-cascade-${n}`)), `cascade ${n} resolves for old albums and counts as a staircase`)
  for (let n = 2; n <= 24; n++) for (const t of m.balancedTemplates(n, 1.5)) assert.ok(!m.isStaircase(t), `${t.id} is a tiling, not a staircase`)
  for (const count of [4, 6, 9]) {
    const { project, spread } = make(count)
    const list = m.cyclingTemplates(project, spread, 'all', none)
    const keys = list.map(t => `${t.pageSide}:${t.placeholders.length}:${t.textBoxes?.length ?? 0}:${m.patternClass(t)}`)
    // No two on the list are one arrangement in one block of the page at slightly different sizes.
    const fine = list.map(t => `${m.arrangementSignature(t.placeholders)}:${[Math.min(...t.placeholders.map(p => p.x)), Math.min(...t.placeholders.map(p => p.y)), Math.max(...t.placeholders.map(p => p.x + p.width)), Math.max(...t.placeholders.map(p => p.y + p.height))].map(v => Math.round(v * 10)).join(',')}`)
    assert.equal(new Set(fine).size, fine.length, `${count} photos: no layout is another one at a slightly different size`)
    const distinct = new Set(keys).size
    assert.ok(distinct >= 2, `${count} photos have arrangements to cycle through (got ${distinct} of ${list.length})`)
    // The first run of presses never repeats an arrangement until every arrangement has been shown once.
    assert.equal(new Set(keys.slice(0, distinct)).size, distinct, `${count} photos: the first ${distinct} presses are ${distinct} different pattern classes`)
  }
}
console.log(`Cycling speed checks passed: a repeated press is a lookup (${perPress.toFixed(3)} ms), and the answer is recomputed only when the photographs, album shape, margin, gap, filters or template library change.`)
