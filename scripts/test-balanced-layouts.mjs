// The balanced family: for each album shape, photo count and split into landscapes and uprights, a
// deep shelf of layouts that tile the page, keep the album's margin and gap, suit each photograph's
// shape, and are drawn from frames of comparable size.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: {
    contents: `export {balancedTemplates} from './src/engine/balancedLayouts'
export {templatesForCount,findTemplate,runsToTheTrim,templateFamilyLabel} from './src/engine/templates'
export {templateShapeMismatches} from './src/engine/templateMatching'
export {supportsUniformGap,hasEvenMargins,frameSizeSpread} from './src/engine/templateLayout'
export {templateCategory} from './src/engine/templateTransfer'
export {offeredLayouts} from './src/engine/layoutOffer'`,
    resolveDir: process.cwd(),
  },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const { balancedTemplates, templatesForCount, findTemplate, runsToTheTrim, templateFamilyLabel, templateShapeMismatches, supportsUniformGap, hasEvenMargins, frameSizeSpread, templateCategory, offeredLayouts } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const MARGIN = 10, GAP = 10
const landscape = i => ({ id: 'l' + i, width: 1500, height: 900 })
const upright = i => ({ id: 'p' + i, width: 900, height: 1500 })
// 18x12, 15x12, 15x15 and 12.007x17.717 inches: the four sizes the wizard offers.
const ASPECTS = [1.5, 1.25, 1, 12.007 / 17.717]

let thinnest = Infinity, thinnestAt = ''
for (const aspect of ASPECTS) {
  for (let count = 2; count <= 24; count++) {
    // The two album shapes the wizard leads with get every count; the others a spread of them.
    if ((aspect === 1.25 || aspect === 1) && count > 8 && count % 4 !== 0) continue
    const all = balancedTemplates(count, aspect)
    assert.equal(balancedTemplates(count, aspect), all, 'the family is built once per shape and count')
    for (const t of all) {
      assert.equal(t.placeholders.length, count)
      // The frames tile the whole sheet: nothing overlaps, nothing is left over, so the album's
      // margin runs round the outside and its gap is the only spacing inside.
      const area = t.placeholders.reduce((a, p) => a + p.width * p.height, 0)
      assert.ok(Math.abs(area - 1) < 1e-6, `${t.id} tiles the page (area ${area})`)
      assert.ok(t.placeholders.every(p => p.x >= -1e-9 && p.y >= -1e-9 && p.x + p.width <= 1 + 1e-9 && p.y + p.height <= 1 + 1e-9))
      assert.ok(supportsUniformGap(t.placeholders, aspect, MARGIN, GAP), `${t.id} keeps the gap`)
      assert.ok(hasEvenMargins(t.placeholders, aspect, MARGIN, GAP), `${t.id} has an even margin`)
      assert.ok(frameSizeSpread(t.placeholders) <= 6, `${t.id} frames are comparable in size`)
      assert.equal(templateFamilyLabel(t), 'Balanced')
      assert.deepEqual(findTemplate(t.id), t, `${t.id} resolves from its id`)
      // Exactly the mix it was drawn for, and no frame that could take the opposite shape.
      const landscapes = Number(t.id.match(/-(\d+)l-/)[1])
      const photos = [...Array.from({ length: landscapes }, (_, i) => landscape(i)), ...Array.from({ length: count - landscapes }, (_, i) => upright(i))]
      assert.equal(templateShapeMismatches(photos, t, aspect, MARGIN, GAP), 0, `${t.id} suits its own mix`)
    }
    // What the browsers show: every photograph in a frame of its own shape, in a layout that keeps
    // the gap and an even border.
    const offered = templatesForCount(count, null, 'all', aspect).filter(t => !t.textBoxes?.length)
      .filter(t => templateCategory(t) !== 'reference' || supportsUniformGap(t.placeholders, aspect, MARGIN, GAP))
    for (let landscapes = 0; landscapes <= count; landscapes++) {
      const photos = [...Array.from({ length: landscapes }, (_, i) => landscape(i)), ...Array.from({ length: count - landscapes }, (_, i) => upright(i))]
      const shelf = offeredLayouts(photos, offered, aspect, MARGIN, GAP)
      assert.ok(shelf.every(t => templateShapeMismatches(photos, t, aspect, MARGIN, GAP) === 0), `aspect ${aspect}, ${count}/${landscapes}: every layout on the shelf fits`)
      if (count >= 3 && shelf.length < thinnest) { thinnest = shelf.length; thinnestAt = `aspect ${aspect}, ${count} photos, ${landscapes} landscape` }
      // Everyday mixes — neither shape under 30% of the set — get a deep shelf.
      if (count >= 6 && landscapes >= count * 0.3 && count - landscapes >= count * 0.3)
        assert.ok(shelf.length >= 6, `aspect ${aspect}, ${count} photos, ${landscapes} landscape: ${shelf.length} layouts`)
    }
  }
}
assert.ok(thinnest >= 1, `every mix has a layout (thinnest: ${thinnest} at ${thinnestAt})`)
// Deterministic: the same album shape gives the same layouts every run, so saved albums keep theirs.
assert.deepEqual(balancedTemplates(8, 1.5).map(t => t.id), balancedTemplates(8, 1.5).map(t => t.id))
assert.equal(findTemplate('mix-150-8-4l-0')?.photoCount, 8)
assert.deepEqual(balancedTemplates(1, 1.5), [])
console.log(`Balanced layout checks passed: every layout tiles the page, keeps the gap and an even margin, and suits its own mix; the thinnest shelf has ${thinnest} (${thinnestAt}).`)
