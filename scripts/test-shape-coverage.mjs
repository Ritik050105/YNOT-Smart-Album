// Every mix of upright and landscape photographs must have somewhere to go, on every album shape
// the size presets produce. Without this the browser quietly offers layouts that crop half the
// pictures, and a drop takes the first of them — which is what sent landscape photographs into
// upright frames.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: {
    contents: `export {templatesForCount,runsToTheTrim} from './src/engine/templates'
export {templateShapeMismatches} from './src/engine/templateMatching'
export {supportsUniformGap} from './src/engine/templateLayout'
export {templateCategory} from './src/engine/templateTransfer'
export {offeredLayouts} from './src/engine/layoutOffer'
export {templateOrderMismatches} from './src/engine/templateMatching'
export {hasEvenMargins,frameSizeSpread} from './src/engine/templateLayout'`,
    resolveDir: process.cwd(),
  },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const { templatesForCount, runsToTheTrim, templateShapeMismatches, supportsUniformGap, templateCategory, offeredLayouts, hasEvenMargins, frameSizeSpread, templateOrderMismatches } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const MARGIN = 10, GAP = 10
const landscape = i => ({ id: 'l' + i, width: 1500, height: 900 })
const upright = i => ({ id: 'p' + i, width: 900, height: 1500 })

// 5x7, 8x10, square, 4x3, letter landscape, 3x2 — the spread shapes the presets produce.
const ASPECTS = [0.714, 0.8, 1, 1.25, 1.294, 1.5]

let worst = Infinity, worstAt = ''
for (const aspect of ASPECTS) {
  for (let count = 1; count <= 12; count++) {
    // Exactly what the browsers offer: the per-count list, minus captions, minus built-ins whose
    // spacing cannot honour the album's gap.
    const offered = templatesForCount(count, null, 'all', aspect)
      .filter(t => !t.textBoxes?.length)
      .filter(t => templateCategory(t) !== 'reference' || runsToTheTrim(t)
        || supportsUniformGap(t.placeholders, aspect, MARGIN, GAP))
    for (let landscapes = 0; landscapes <= count; landscapes++) {
      const photos = [
        ...Array.from({ length: landscapes }, (_, i) => landscape(i)),
        ...Array.from({ length: count - landscapes }, (_, i) => upright(i)),
      ]
      const fit = offered.filter(t => templateShapeMismatches(photos, t, aspect, MARGIN, GAP) === 0).length
      // What the browser actually shows: only layouts whose frames suit the photographs' shapes
      // (landscape photos meet landscape or square frames, uprights meet upright or square), and
      // evenly framed ones while enough of those remain.
      const shelf = offeredLayouts(photos, offered, aspect, MARGIN, GAP)
      assert.ok(shelf.length > 0, `aspect ${aspect}, ${count} photos, ${landscapes} landscape: the shelf is not empty`)
      const fewest = Math.min(...offered.map(t => templateShapeMismatches(photos, t, aspect, MARGIN, GAP)))
      assert.ok(shelf.every(t => templateShapeMismatches(photos, t, aspect, MARGIN, GAP) === fewest),
        `aspect ${aspect}, ${count} photos, ${landscapes} landscape: the shelf holds only layouts that fit the photographs' shapes`)
      if (shelf.length > 0 && shelf.some(t => !runsToTheTrim(t) && !hasEvenMargins(t.placeholders, aspect, MARGIN, GAP))) {
        assert.ok(shelf.filter(t => runsToTheTrim(t) || (hasEvenMargins(t.placeholders, aspect, MARGIN, GAP) && frameSizeSpread(t.placeholders) <= 6)).length < 3,
          `aspect ${aspect}, ${count} photos, ${landscapes} landscape: uneven layouts are shown only when fewer than three even ones fit`)
      }
      assert.ok(fit > 0,
        `aspect ${aspect}, ${count} photos, ${landscapes} landscape: no layout gives every photograph a frame of its own shape`)
      if (fit < worst) { worst = fit; worstAt = `aspect ${aspect}, ${count} photos, ${landscapes} landscape` }
    }
  }
}

// Photographs that keep their timeline order get the frame at their own position, so a layout with
// the right NUMBER of upright and landscape frames can still put a panorama in a tall one. The
// shelf for a fixed order must judge each photograph against the frame it would really get.
{
  const pano = { id: 'pano', width: 1200, height: 400 }, tall = { id: 'tall', width: 400, height: 1000 }
  const wide = { id: 'wide', width: 900, height: 600 }, upright = { id: 'up', width: 600, height: 900 }
  let zero = 0, total = 0
  for (const aspect of ASPECTS) for (let count = 2; count <= 8; count++) {
    const seq = [pano, tall, wide, upright, tall, wide, pano, upright].slice(0, count).map((p, i) => ({ ...p, id: p.id + i }))
    const offered = templatesForCount(count, null, 'all', aspect).filter(t => !t.textBoxes?.length)
      .filter(t => templateCategory(t) !== 'reference' || runsToTheTrim(t) || supportsUniformGap(t.placeholders, aspect, MARGIN, GAP))
    const shelf = offeredLayouts(seq, offered, aspect, MARGIN, GAP, true)
    const fewest = Math.min(...offered.map(t => templateOrderMismatches(seq, t, aspect, MARGIN, GAP)))
    assert.ok(shelf.length > 0 && shelf.every(t => templateOrderMismatches(seq, t, aspect, MARGIN, GAP) === fewest),
      `aspect ${aspect}, ${count} photos in a fixed order: every offered layout gives each photograph a frame of its own shape`)
    total++; if (fewest === 0) zero++
  }
  assert.ok(zero / total > 0.5, `most fixed-order sequences have a layout that suits every photograph (${zero}/${total})`)
}

console.log(`Shape coverage checks passed: every mix on every album shape has a layout; the thinnest is ${worst} (${worstAt}).`)
