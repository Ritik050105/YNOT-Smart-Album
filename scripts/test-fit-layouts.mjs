// Fitted layouts: drawn for the photographs' real proportions, so a frame is about its photograph's shape and little of the picture is
// cropped away. The offer rule drops layouts that would cut a photograph badly, and nothing is offered across the fold.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: {
    contents: `export {fitForRatios,ratiosOf,fitFromId,frameSuits} from './src/engine/balancedLayouts'
export {findTemplate,sequenceCandidates} from './src/engine/templates'
export {wellCovered,offeredLayouts} from './src/engine/layoutOffer'
export {supportsUniformGap} from './src/engine/templateLayout'
export {templateOrderMismatches} from './src/engine/templateMatching'`,
    resolveDir: process.cwd(),
  },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const m = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const sets = {
  'eight mixed': [[1500, 1000], [1000, 1500], [1200, 1000], [900, 1200], [1600, 900], [1000, 1500], [1500, 1000], [1000, 1000]],
  'panorama and four': [[3000, 1000], [1500, 1000], [1000, 1500], [1000, 1500], [1500, 1000]],
  'four 4:5 portraits': [[800, 1000], [800, 1000], [800, 1000], [800, 1000]],
  'six mixed': [[1500, 1000], [800, 1000], [1920, 1080], [1000, 1500], [4000, 1000], [1000, 1000]],
}
let total = 0
for (const [name, dims] of Object.entries(sets)) for (const aspect of [1.5, 1.25, 0.75]) {
  const photos = dims.map(([width, height], i) => ({ id: `p${i}`, width, height })), ratios = m.ratiosOf(photos)
  const layouts = m.fitForRatios(ratios, aspect)
  assert.equal(m.fitForRatios(ratios, aspect), layouts, 'built once per set and shape')
  total += layouts.length
  for (const t of layouts) {
    assert.equal(t.placeholders.length, photos.length)
    assert.ok(Math.abs(t.placeholders.reduce((a, p) => a + p.width * p.height, 0) - 1) < 1e-6, `${t.id} tiles the sheet`)
    // Every frame is about its own photograph's proportion (the reading order the matcher uses gives photograph k the k-th frame).
    const frames = [...t.placeholders].sort((a, b) => a.x - b.x || a.y - b.y)
    frames.forEach((p, k) => {
      const ratio = (p.width * aspect) / p.height
      assert.ok(Math.abs(Math.log(ratio / ratios[k])) <= Math.log(1.6) + 1e-9, `${t.id}: frame ${k} is ${ratio.toFixed(2)} for a ${ratios[k].toFixed(2)} photograph`)
      assert.ok(m.frameSuits(ratios[k], ratio), `${t.id}: frame ${k} keeps its photograph's shape`)
    })
    for (const gap of [0, 6, 16, 28]) assert.ok(m.supportsUniformGap(t.placeholders, aspect, gap / 2, gap), `${t.id} keeps the gap at ${gap}`)
    assert.equal(m.findTemplate(t.id)?.id, t.id, `${t.id} resolves from its id`)
    assert.equal(m.templateOrderMismatches(photos, t, aspect, 3, 6), 0, `${t.id} gives every photograph a frame of its own shape, in order`)
  }
  // The browsers' in-order list leads with them.
  const offered = m.sequenceCandidates(photos, photos.length, null, 'all', aspect)
  if (layouts.length) assert.deepEqual(offered.slice(0, layouts.length).map(t => t.id), layouts.map(t => t.id), 'fitted layouts come first')
}
assert.ok(total >= 40, `fitted layouts exist for real proportions (${total})`)

// The offer rule: a layout that throws away much of a photograph is dropped while enough others remain.
{
  const photos = [[3000, 1000], [1000, 1500], [1500, 1000], [1000, 1500]].map(([width, height], i) => ({ id: `q${i}`, width, height }))
  const frame = (id, x, y, width, height) => ({ id, x, y, width, height, preferredOrientation: 'any' })
  const make = (id, ratios) => {
    // Four frames in a row whose proportions (at an album of aspect 1) are the ratios given.
    let x = 0
    return { id, name: id, photoCount: 4, pageSide: 'spread', isBuiltIn: true, createdAt: '', thumbnailColor: '#000', placeholders: ratios.map((r, i) => { const f = frame(`${id}-${i}`, x, 0, r / 8, 1); x += r / 8; return f }) }
  }
  const good = Array.from({ length: 70 }, (_, i) => make(`good${i}`, [3 + i * 0.004, 0.67, 1.5, 0.67]))
  const bad = make('bad', [1, 1.5, 0.67, 1.5])
  const kept = m.wellCovered(photos, [...good, bad], 1, true)
  assert.ok(kept.some(t => t.id === 'good0') && !kept.some(t => t.id === 'bad'), 'a layout that crops a panorama to a landscape frame is dropped')
}
console.log(`Fit layout checks passed: ${total} layouts across ${Object.keys(sets).length} sets of real proportions, each frame about its photograph, gaps held at every preset, ids resolve.`)
