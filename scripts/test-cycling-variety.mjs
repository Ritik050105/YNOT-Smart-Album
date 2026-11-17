// Next/Previous must walk different templates (not the same arrangement mirrored or moved), nothing on the shelf may put a photograph
// across the fold, and the layout a spread starts with after a split, merge, drop or removal must follow the same rules.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: { contents: `export {sequenceCandidates,templatesForCount,showcaseCandidates} from './src/engine/templates'
export {offeredLayouts,varyPatterns,lookKey,crossesTheFold} from './src/engine/layoutOffer'
export {defaultLayouts,buildSpreadFromPlacements,splitSpreadIntoPages,mergeSpreads,createBlankSpread,defaultPlacement} from './src/engine/autoLayout'
export {templateOrderMismatches} from './src/engine/templateMatching'
export {findTemplate} from './src/engine/templates'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.bin':'dataurl', '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const m = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const dims = { L: [1500, 1000], P: [1000, 1500], S: [1000, 1000] }
const photos = word => [...word].map((c, i) => ({ id: `${c}${i}`, width: dims[c][0], height: dims[c][1] }))
const MARGIN = 3, GAP = 6

for (const aspect of [1.5, 1.25, 1]) for (const word of ['LP', 'LL', 'LPL', 'LLP', 'LPLP', 'LLLL', 'LPLPLP', 'LLPPLL']) {
  const ph = photos(word), n = ph.length
  const list = [...m.sequenceCandidates(ph, n, null, 'all', aspect), ...m.templatesForCount(n, null, 'all', aspect), ...m.showcaseCandidates(ph, n, null, 'all', aspect)].filter(t => !t.textBoxes?.length)
  const shelf = m.varyPatterns(m.offeredLayouts(ph, list, aspect, MARGIN, GAP, true, true), t => t, aspect)
  assert.ok(shelf.length >= 20, `${word} at ${aspect}: a good shelf to cycle (${shelf.length})`)
  for (const t of shelf) assert.ok(!m.crossesTheFold(t), `${word} at ${aspect}: ${t.id} puts a photograph across the fold`)
  // The distinct part of the shelf: no two the same look (mirrored or moved). Only a short shelf is topped up with copies, after all of those.
  const looks = shelf.map(t => m.lookKey(t) && `${t.pageSide}:${m.lookKey(t)}`)
  const firstRepeat = looks.findIndex((k, i) => k && looks.indexOf(k) < i)
  const distinct = firstRepeat < 0 ? shelf.length : firstRepeat
  if (process.env.VERBOSE) console.log("")
  for (let i = 1; i < Math.min(distinct, 40); i++) assert.notEqual(looks[i], looks[i - 1], `${word}: step ${i} is another template`)
  console.log(`${String(aspect).padEnd(5)} ${word.padEnd(8)} shelf ${String(shelf.length).padStart(3)}, ${String(distinct).padStart(3)} different before a repeat`)
}

// Splitting, merging, dropping: the layout a spread starts with follows the rules, in order.
const asset = photos('LPLPLP')
const blank = m.createBlankSpread(0, { backgroundColor: '#fff', gapPx: GAP, marginPx: MARGIN, borderWidth: 0, borderColor: '#000' })
const place = ph => ph.map(p => m.defaultPlacement(`f-${p.id}`, p.id))
for (const aspect of [1.5, 1.25, 1]) {
  const ctx = { photos: asset, aspect, enabledTemplateIds: null }
  for (let n = 1; n <= 6; n++) {
    const sub = asset.slice(0, n), spread = m.buildSpreadFromPlacements(place(sub), 'spread', blank, ctx), t = m.findTemplate(spread.templateId)
    assert.ok(t && !m.crossesTheFold(t), `${n} photos at ${aspect}: ${spread.templateId} keeps off the fold`)
    assert.equal(m.templateOrderMismatches(sub, t, aspect, MARGIN, GAP), 0, `${n} photos at ${aspect}: ${t.id} gives each photograph a frame of its own shape`)
  }
  const full = { ...blank, placements: place(asset) }
  const [left, right] = m.splitSpreadIntoPages(full, undefined, ctx)
  for (const [page, side, sub] of [[left, 'left', asset.slice(0, 3)], [right, 'right', asset.slice(3)]]) {
    const t = m.findTemplate(page.templateId)
    const onLeft = t.placeholders.every(p => p.x + p.width <= 0.5001), onRight = t.placeholders.every(p => p.x >= 0.4999)
    // A design on the other half is mirrored onto the page.
    assert.ok(t && (side === 'left' ? (page.flipped ? onRight : onLeft) : (page.flipped ? onLeft : onRight)), `${side} page at ${aspect}: ${page.templateId} sits on its own page`)
    assert.equal(page.placements.length, sub.length)
    // What a split starts a page with is on that page's own shelf, so the browse panel shows it.
    assert.ok(m.defaultLayouts(sub, side, aspect, MARGIN, GAP).some(c => c.id === page.templateId), `${side} page at ${aspect}: ${page.templateId} is on the page's shelf`)
  }
  const merged = m.mergeSpreads({ ...blank, placements: place(asset.slice(0, 3)) }, { ...blank, id: 'b', placements: place(asset.slice(3)) }, ctx)
  assert.ok(!m.crossesTheFold(m.findTemplate(merged.templateId)), `merged spread at ${aspect} keeps off the fold`)
}
// Without photographs to judge (older callers) a spread still starts off the fold.
for (let i = 0; i < 40; i++) assert.ok(!m.crossesTheFold(m.findTemplate(m.buildSpreadFromPlacements(place(asset.slice(0, 3)), 'spread', blank).templateId)), 'fallback keeps off the fold')
console.log('Cycling variety checks passed: Next/Previous steps through different templates, none across the fold, defaults follow the rules.')
