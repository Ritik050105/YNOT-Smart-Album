// Page layouts keep even white space and no stamp-sized frames: on a page the white above, below and outside a group of frames is equal, on the spread the
// white above and below and at the two sides is equal, and a group covers at least 30% of its page. And a four-photograph shelf has every page split,
// one photograph on one page with three on the other, either way round, for the mixes whose shapes allow it.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: { contents: `export {showcaseForRatios,balancedWhite} from './src/engine/showcaseLayouts'
export {ratiosOf} from './src/engine/balancedLayouts'
export {templatesForCount,sequenceCandidates,mixCandidates,showcaseCandidates,uniqueTemplates} from './src/engine/templates'
export {offeredLayouts,varyPatterns} from './src/engine/layoutOffer'
export {supportsUniformGap} from './src/engine/templateLayout'
export {mustHoldGap} from './src/engine/templateTransfer'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.bin': 'dataurl', '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const m = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const photos = word => [...word].map((c, i) => c === 'L' ? { id: 'L' + i, width: 1500, height: 1000 } : c === 'P' ? { id: 'P' + i, width: 1000, height: 1500 } : { id: 'S' + i, width: 1000, height: 1000 })

// The rule itself.
const box = (x, y, w, h) => [x, y, w, h]
assert.ok(m.balancedWhite([box(0.02, 0.1, 0.3, 0.8)], 1.5, 0.03) === false, 'a photograph that floats off-centre on its page is refused')
assert.ok(m.balancedWhite([box(0.04, 0.2, 0.42, 0.6)], 1.5), 'a wide photograph centred on an upright page (the same white at both sides, above and below) passes')
assert.ok(m.balancedWhite([box(0.1 / 1.5, 0.1, 0.3, 0.8)], 1.5), 'equal white above, below and outside a page block passes')
assert.ok(m.balancedWhite([box(0, 0, 0.5, 1)], 1.5), 'a page that runs to the trim passes')
assert.ok(!m.balancedWhite([box(0.15, 0.4, 0.15, 0.2)], 1.5), 'a small frame on a page is refused')

// Every page layout the generator makes obeys it, on albums of several shapes.
for (const aspect of [1.5, 1, 3]) for (const word of ['L', 'P', 'LP', 'LPL', 'LLPP', 'LPLPL']) {
  for (const t of m.showcaseForRatios(m.ratiosOf(photos(word)), aspect)) {
    const boxes = t.placeholders.map(p => [p.x, p.y, p.width, p.height])
    assert.ok(m.balancedWhite(boxes, aspect), `${t.id} (${word}, album ${aspect}) has even white space and frames of a good size`)
  }
}

// Page splits for a mixed set of four, one photograph on a page and three on the other, either way round.
const aspect = 1.5, set = photos('LPLP'), n = 4
const pool = m.uniqueTemplates([...m.sequenceCandidates(set, n, null, 'all', aspect), ...m.mixCandidates(set, n, null, 'all', aspect), ...m.showcaseCandidates(set, n, null, 'all', aspect), ...m.templatesForCount(n, null, 'all', aspect)])
  .filter(t => !t.textBoxes?.length && (!m.mustHoldGap(t) || m.supportsUniformGap(t.placeholders, aspect, 3, 6)))
const shelf = m.varyPatterns(m.offeredLayouts(set, pool, aspect, 3, 6, false, true), t => t, aspect, 0)
const split = t => { const l = t.placeholders.filter(p => p.x + p.width <= 0.5001).length, r = t.placeholders.filter(p => p.x >= 0.4999).length; return l + r === t.placeholders.length ? `${l}|${r}` : 'across' }
const by = {}; for (const t of shelf) by[split(t)] = (by[split(t)] || 0) + 1
assert.ok(by['1|3'] >= 3, `one photograph on the left page and three on the right (${JSON.stringify(by)})`)
assert.ok(by['3|1'] >= 3, `three photographs on the left page and one on the right (${JSON.stringify(by)})`)
assert.ok(by['across'] >= 1, `and some across the whole spread (${JSON.stringify(by)})`)

// Every way of sharing the photographs between the two pages (1|1, 1|2, 2|1, 1|3, 2|2 ...) is on the shelf of every order of wide and tall photographs, on the
// 3:1 spread (an 18 x 12 inch page), and both ways round, with the layouts that put them all on one page kept to the end.
const shelfOf = (word, asp) => {
  const s = photos(word), k = s.length
  const all = m.uniqueTemplates([...m.sequenceCandidates(s, k, null, 'all', asp), ...m.mixCandidates(s, k, null, 'all', asp), ...m.showcaseCandidates(s, k, null, 'all', asp), ...m.templatesForCount(k, null, 'all', asp)])
    .filter(t => !t.textBoxes?.length && (!m.mustHoldGap(t) || m.supportsUniformGap(t.placeholders, asp, 3, 6)))
  return m.varyPatterns(m.offeredLayouts(s, all, asp, 3, 6, false, true), t => t, asp, 0)
}
for (const word of ['LL', 'LP', 'PP', 'LLL', 'LPL', 'PPP', 'LLLL', 'LPLP', 'PPLL', 'PPPP', 'LLPLP']) {
  const have = {}; for (const t of shelfOf(word, 3)) have[split(t)] = (have[split(t)] || 0) + 1
  for (let k = 1; k < word.length; k++) assert.ok(have[`${k}|${word.length - k}`], `${word} on a 3:1 spread: ${k} photograph(s) on the left page and ${word.length - k} on the right (${JSON.stringify(have)})`)
}
// And the shelf does not start with a block on one page and the other page empty.
for (const word of ['LPLP', 'LLL', 'LLLL']) assert.ok(!/^(\d+\|0|0\|\d+)$/.test(split(shelfOf(word, 1.5)[0])), `${word}: the first template shares the photographs between the pages or runs across the spread`)
console.log('Even white checks passed: page layouts keep equal white and good sizes on three album shapes, a mixed four has 1|3 and 3|1 page splits, and every split of every order up to five photographs is on the shelf.')
