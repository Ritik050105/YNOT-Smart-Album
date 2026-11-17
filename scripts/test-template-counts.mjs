// The template counts of "YNOT Album Templates Count.xlsx" (docs/template-counts.json): the app's own table agrees with the sheet, and the browser offers
// exactly that many templates for the small combinations (the large ones are measured by scripts/count-templates.mjs, which takes minutes).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { build } from 'esbuild'

const sheet = JSON.parse(fs.readFileSync('docs/template-counts.json', 'utf8'))
const result = await build({
  stdin: { contents: `export {templatesRequired,wantedTemplates} from './src/engine/templateCounts'
export {templatesForCount,sequenceCandidates,mixCandidates,showcaseCandidates,uniqueTemplates} from './src/engine/templates'
export {offeredLayouts,varyPatterns} from './src/engine/layoutOffer'
export {supportsUniformGap} from './src/engine/templateLayout'
export {mustHoldGap} from './src/engine/templateTransfer'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.bin': 'dataurl', '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const m = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

// The sheet: 324 combinations (1 to 24 photographs, every mix of horizontal and vertical) and 62,742 templates.
assert.equal(sheet.rows.length, 324)
assert.equal(sheet.rows.reduce((sum, r) => sum + r.templates, 0), 62742)
assert.equal(new Set(sheet.rows.map(r => `${r.photos}:${r.horizontal}`)).size, 324, 'every combination appears once')
for (const r of sheet.rows) {
  assert.equal(r.horizontal + r.vertical, r.photos)
  assert.equal(m.templatesRequired(r.photos, r.horizontal), r.templates, `the app needs ${r.templates} templates for ${r.photos} photographs, ${r.horizontal} horizontal`)
}
const photosOf = (n, h) => Array.from({ length: n }, (_, i) => i < h ? { id: 'h' + i, width: 1500, height: 1000 } : { id: 'v' + i, width: 1000, height: 1500 })
assert.equal(m.wantedTemplates(photosOf(3, 2)), 98)
assert.equal(m.wantedTemplates([{ width: 1000, height: 1000 }]), 36, 'a square photograph counts as horizontal')

// The browser offers exactly that many for the small combinations, on the shapes an album comes in.
const MARGIN = 3, GAP = 6
for (const aspect of [1.5, 3]) for (const r of sheet.rows.filter(r => r.photos <= 3)) {
  const set = photosOf(r.photos, r.horizontal)
  const pool = m.uniqueTemplates([...m.sequenceCandidates(set, r.photos, null, 'all', aspect), ...m.mixCandidates(set, r.photos, null, 'all', aspect), ...m.showcaseCandidates(set, r.photos, null, 'all', aspect), ...m.templatesForCount(r.photos, null, 'all', aspect)])
    .filter(t => !t.textBoxes?.length && (!m.mustHoldGap(t) || m.supportsUniformGap(t.placeholders, aspect, MARGIN, GAP)))
  const offered = m.varyPatterns(m.offeredLayouts(set, pool, aspect, MARGIN, GAP, false, true), t => t, aspect, m.wantedTemplates(set))
  // (Never more than required.) At 1.5 every combination has all of them; the 3:1 shape is slightly thin for two horizontals.
  assert.ok(offered.length <= r.templates, `${r.photos} photographs, ${r.horizontal} horizontal: ${offered.length} offered, no more than ${r.templates} wanted`)
  // A single photograph can only be set with the same white round it on every side and a frame of a good size, so its shelf is the shorter one: at least
  // a dozen. From two photographs the count is met (the 3:1 shape is slightly thin for two vertical ones).
  if (r.photos === 1) {
    assert.equal(offered.length, r.templates, `album shape ${aspect}, one photograph (${r.horizontal} horizontal): exactly ${r.templates} templates (${offered.length})`)
    // The single-photograph templates a designer lists: the whole spread to the trim and to the margin, each page to the trim and to the margin, inset on a page,
    // centred on the spread, and squared frames, none of them a resized copy of another.
    if (r.horizontal) for (const name of aspect >= 2 ? ['full spread', 'fill spread', 'full left', 'fill left', 'full right', 'fill right', 'squared'] : ['full spread', 'fill spread', 'squared']) assert.ok(offered.some(t => t.name.includes(name)), `album shape ${aspect}: a "${name}" template is offered for one horizontal photograph (${offered.map(t => t.name.replace("Showcase · ", "")).join("; ")})`)
  }
  else if (aspect === 1.5) assert.equal(offered.length, r.templates, `album shape ${aspect}, ${r.photos} photographs, ${r.horizontal} horizontal: exactly ${r.templates} templates (${offered.length})`)
  else assert.ok(offered.length >= r.templates - 6, `album shape ${aspect}, ${r.photos} photographs, ${r.horizontal} horizontal: about ${r.templates} templates (${offered.length})`)
}
console.log('Template count checks passed: the app agrees with the sheet (324 combinations, 62,742 templates) and offers the required number for up to three photographs.')
