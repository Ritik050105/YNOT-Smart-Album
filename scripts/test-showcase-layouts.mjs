// Showcase layouts: pictures floated on the page with white space, in the photographs' own order, each frame the shape of
// its photograph. They are creative designs (the album gap rule does not apply), resolve from their ids, stay on the page,
// and are never a rising staircase.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: {
    contents: `export {showcaseCandidates,findTemplate,isStaircase,runsToTheTrim,templateFamilyLabel} from './src/engine/templates'
export {templateOrderMismatches} from './src/engine/templateMatching'
export {templateCategory} from './src/engine/templateTransfer'
export {offeredLayouts} from './src/engine/layoutOffer'`,
    resolveDir: process.cwd(),
  },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const m = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const dims = { L: [1500, 1000], P: [1000, 1500], S: [1000, 1000] }
const photos = word => [...word].map((c, i) => ({ id: c + i, width: dims[c][0], height: dims[c][1] }))
let total = 0
for (const aspect of [1.5, 1.25, 1, 12.007 / 17.717]) {
  for (const word of ['L', 'P', 'LL', 'LP', 'LLL', 'LPL', 'PPP', 'LPLP', 'LLPPS', 'LLLLLL', 'LPLPLPLP', 'LLLLLLLLLLLL', 'LPLPLPLPLPLPLPLPLPLPLPLP']) {
    const ph = photos(word), found = m.showcaseCandidates(ph, ph.length, null, 'all', aspect)
    assert.deepEqual(found.map(t => t.id), m.showcaseCandidates(ph, ph.length, null, 'all', aspect).map(t => t.id), 'the same photographs give the same layouts')
    total += found.length
    const ids = new Set()
    for (const t of found) {
      assert.ok(!ids.has(t.id), `${t.id} is unique`); ids.add(t.id)
      assert.equal(t.placeholders.length, ph.length)
      for (const p of t.placeholders) assert.ok(p.x >= -1e-9 && p.y >= -1e-9 && p.x + p.width <= 1 + 1e-9 && p.y + p.height <= 1 + 1e-9, `${t.id} stays on the page`)
      // (A layout with one photograph picked out to fill a page, `-f<n>L-` / `-f<n>R-`, is for the rearranging row: its frames suit the photographs in another order.)
      if (!/-f\d+[LR]-/.test(t.id)) assert.equal(m.templateOrderMismatches(ph, t, aspect, 3, 6), 0, `${t.id} gives every photograph a frame of its own shape, in order`)
      assert.equal(m.templateCategory(t), 'creative', `${t.id} is a creative design`)
      assert.ok(m.runsToTheTrim(t), `${t.id} is exempt from the even-margin and gap checks`)
      assert.equal(m.templateFamilyLabel(t), 'Showcase')
      assert.ok(!m.isStaircase(t), `${t.id} is not a rising staircase`)
      // Nothing postage-stamp small, and the block of pictures is a good part of the page.
      const x0 = Math.min(...t.placeholders.map(p => p.x)), x1 = Math.max(...t.placeholders.map(p => p.x + p.width)), y0 = Math.min(...t.placeholders.map(p => p.y)), y1 = Math.max(...t.placeholders.map(p => p.y + p.height))
      assert.ok(Math.max(x1 - x0, y1 - y0) >= 0.12, `${t.id} spans a good part of a page`)
      // (With three photographs or fewer a picture may run across the fold; with more, none may.)
      const wholeSpread = t.placeholders.length <= 4 // (up to four photographs may run across the fold)
      assert.ok(wholeSpread || !t.placeholders.some(p => p.x < 0.497 && p.x + p.width > 0.503), `${t.id} keeps every photograph off the fold`)
      // (A big set on one spread has small frames; the floor falls with the count, as it does in the generator.)
      const floor = (ph.length > 12 ? 0.045 : ph.length > 8 ? 0.07 : 0.09) - 1e-9
      for (const p of t.placeholders) assert.ok(Math.min(p.width * aspect, p.height) >= floor, `${t.id} has no tiny frame`)
      for (const p of t.placeholders) { const ratio = (p.width * aspect) / p.height; assert.ok(ratio <= 2.5 && ratio >= 0.4, `${t.id} has no strip`) }
      assert.equal(m.findTemplate(t.id)?.id, t.id, `${t.id} resolves from its id`)
    }
    // Strict, in order: every one is offered.
    // Strict, in order: the layouts that keep most of every photograph are offered (the rest, where a tiling had to stretch a frame, are not).
    assert.ok(m.offeredLayouts(ph, found, aspect, 3, 6, true, true).length >= Math.min(found.length, 8), `${word}: the well-covered ones are offered`)
  }
}
// Three photographs of a mix have plenty of different patterns, and a hand-picked library gets none.
const three = photos('LPL')
assert.ok(m.showcaseCandidates(three, 3, null, 'all', 1.5).length >= 8, 'three photographs have eight or more page layouts')
assert.deepEqual(m.showcaseCandidates(three, 3, ['some-hand-picked-id'], 'all', 1.5), [])
assert.deepEqual(m.showcaseCandidates(three, 4, null, 'all', 1.5), [])
// One photograph has plenty of places to sit: either page, filling it, inset, or smaller toward an edge, the top or the bottom.
for (const aspect of [1.5, 1.25, 1, 12.007 / 17.717]) for (const word of ['L', 'P', 'S']) assert.ok(m.showcaseCandidates(photos(word), 1, null, 'all', aspect).length >= 4, `${word} at ${aspect}: four or more single photograph layouts`)
// The whole-spread and whole-page families: full spread (bleed, and to the margin), full left page, full right page.
for (const t of m.showcaseCandidates(photos('L'), 1, null, 'all', 1.5).filter(t => /Full Spread/.test(t.name))) assert.ok(t.placeholders[0].width === 1 && t.placeholders[0].height === 1, `${t.id} fills the spread`)
{
  const names = new Set(m.showcaseCandidates(photos('L'), 1, null, 'all', 1.5).map(t => t.name))
  assert.ok(names.has('Showcase · Full Spread Bleed') && names.has('Showcase · Full Spread'), 'a landscape photograph has a full spread, bleed and to the margin')
  const pages = new Set(m.showcaseCandidates(photos('P'), 1, null, 'all', 1.5).map(t => t.name))
  assert.ok(pages.has('Showcase · Full Left Page Bleed') && pages.has('Showcase · Full Right Page Bleed'), 'an upright photograph has a full page on either side, bleed')
  assert.ok(m.showcaseCandidates(photos('P'), 1, null, 'all', 1.5).filter(t => /Bleed/.test(t.name)).every(t => t.placeholders[0].bleed), 'bleed layouts are marked as such')
}
// Page layouts: all on the left page, all on the right, or split between them, for every mix, at least ten of them.
for (const aspect of [1.5, 1, 1.25]) for (const word of ['LPL', 'LLL', 'LPLP', 'LLLL', 'LPLPLP', 'LLLLLLLL']) {
  const ph = photos(word), found = m.showcaseCandidates(ph, ph.length, null, 'all', aspect)
  const pages = found.filter(t => /Page/.test(t.name)), kinds = new Set(pages.map(t => t.name))
  assert.ok(pages.length >= 10, `${word} at ${aspect}: ${pages.length} page layouts, ten wanted`)
  // Photographs that fit on one page of the album at their own proportions get single page layouts on each side; a longer or more
  // mixed set always has layouts shared between the two pages.
  if (word.length <= 3) assert.ok(kinds.has('Showcase · Left Page') && kinds.has('Showcase · Right Page'), `${word}: single page layouts on each side`)
  if (word.length >= 4) assert.ok(kinds.has('Showcase · Two Pages'), `${word}: layouts shared between the two pages`)
  for (const t of pages.filter(t => /Left Page/.test(t.name))) assert.ok(t.placeholders.every(p => p.x + p.width <= 0.5 + 1e-9), `${t.id} stays on the left page`)
  for (const t of pages.filter(t => /Right Page/.test(t.name))) assert.ok(t.placeholders.every(p => p.x >= 0.5 - 1e-9), `${t.id} stays on the right page`)
  for (const t of pages.filter(t => /Two Pages/.test(t.name))) assert.ok(t.placeholders.some(p => p.x < 0.5) && t.placeholders.some(p => p.x >= 0.5), `${t.id} uses both pages`)
}
console.log(`Showcase layout checks passed: ${total} layouts, each in order with its photograph's shape, creative, on the page, none a staircase.`)
