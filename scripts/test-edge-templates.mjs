// Edge-to-edge layouts: the picture reaches the trim on every side, and the album's gap still
// opens up between photographs without ever pulling a frame away from the page edge. That second
// half is the part worth pinning — it is the behaviour the margin/gap resolver has to get right.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: { contents: `export {EDGE_TEMPLATES} from './src/engine/edgeTemplates';export {resolveTemplateFrames} from './src/engine/templateLayout'`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', write: false,
})
const { EDGE_TEMPLATES, resolveTemplateFrames } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

assert.ok(EDGE_TEMPLATES.length >= 15, `enough layouts to be a set (got ${EDGE_TEMPLATES.length})`)

const ids = new Set()
for (const t of EDGE_TEMPLATES) {
  assert.ok(!ids.has(t.id), `${t.id} appears once`); ids.add(t.id)
  assert.equal(t.photoCount, t.placeholders.length, `${t.id} counts its own frames`)
  assert.ok(t.placeholders.every((p) => p.bleed), `${t.id} is authored full-bleed throughout`)

  // Together the frames cover the whole sheet: every edge of the spread is touched.
  const left = Math.min(...t.placeholders.map((p) => p.x))
  const top = Math.min(...t.placeholders.map((p) => p.y))
  const right = Math.max(...t.placeholders.map((p) => p.x + p.width))
  const bottom = Math.max(...t.placeholders.map((p) => p.y + p.height))
  assert.ok(left < 1e-6 && top < 1e-6, `${t.id} starts at the top-left trim (${left}, ${top})`)
  assert.ok(right > 1 - 1e-6 && bottom > 1 - 1e-6, `${t.id} reaches the bottom-right trim (${right}, ${bottom})`)

  // And no photo sits on top of another.
  const f = t.placeholders
  for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) {
    const a = f[i], b = f[j]
    assert.ok(!(a.x < b.x + b.width - 1e-6 && b.x < a.x + a.width - 1e-6 &&
      a.y < b.y + b.height - 1e-6 && b.y < a.y + a.height - 1e-6), `${t.id}: ${a.id} and ${b.id} do not overlap`)
  }
}

// The resolver: a margin must not pull these off the trim, while a gap must still open up inside.
const sample = EDGE_TEMPLATES.find((t) => t.photoCount === 4 && t.id.includes('quarters'))
assert.ok(sample, 'the four-across layout is there to measure')

for (const [marginPx, gapPx] of [[0, 0], [40, 0], [40, 24], [0, 24]]) {
  const resolved = resolveTemplateFrames(sample.placeholders, 2, marginPx, gapPx)
  const left = Math.min(...resolved.map((p) => p.x))
  const right = Math.max(...resolved.map((p) => p.x + p.width))
  const top = Math.min(...resolved.map((p) => p.y))
  const bottom = Math.max(...resolved.map((p) => p.y + p.height))
  assert.ok(left < 1e-6 && top < 1e-6 && right > 1 - 1e-6 && bottom > 1 - 1e-6,
    `margin ${marginPx} / gap ${gapPx}: the layout still reaches all four trims (${left.toFixed(4)}, ${top.toFixed(4)}, ${right.toFixed(4)}, ${bottom.toFixed(4)})`)
}

// With a gap, neighbours separate; with none, they meet.
const tight = resolveTemplateFrames(sample.placeholders, 2, 0, 0).sort((a, b) => a.x - b.x)
const airy = resolveTemplateFrames(sample.placeholders, 2, 0, 24).sort((a, b) => a.x - b.x)
const seam = (list) => list[1].x - (list[0].x + list[0].width)
assert.ok(Math.abs(seam(tight)) < 1e-6, `at gap 0 the photos meet (seam ${seam(tight)})`)
assert.ok(seam(airy) > 0.02, `at gap 24 the photos separate (seam ${seam(airy).toFixed(4)})`)
// The outer edge did not move while the inner one did.
assert.ok(Math.abs(airy[0].x) < 1e-6, 'the leftmost photo keeps its outer edge on the trim')
assert.ok(airy[0].width < tight[0].width, 'but gives up width on the side that meets its neighbour')

console.log(`Edge layout checks passed: ${EDGE_TEMPLATES.length} layouts, all full-bleed, covering the sheet, non-overlapping; margin never lifts them off the trim and the gap only opens between photographs.`)
