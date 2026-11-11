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
export {templateCategory} from './src/engine/templateTransfer'`,
    resolveDir: process.cwd(),
  },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const { templatesForCount, runsToTheTrim, templateShapeMismatches, supportsUniformGap, templateCategory } =
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
      assert.ok(fit > 0,
        `aspect ${aspect}, ${count} photos, ${landscapes} landscape: no layout gives every photograph a frame of its own shape`)
      if (fit < worst) { worst = fit; worstAt = `aspect ${aspect}, ${count} photos, ${landscapes} landscape` }
    }
  }
}

console.log(`Shape coverage checks passed: every mix on every album shape has a layout; the thinnest is ${worst} (${worstAt}).`)
