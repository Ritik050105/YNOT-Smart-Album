// Prints how many layouts the template browser offers for each photo count and mix of landscape (L), portrait (P) and square (S)
// photographs, for the four album shapes. Not a test: run it to see where the library is thin.
//   node scripts/coverage-report.mjs [--full]
import { build } from 'esbuild'
const result = await build({
  stdin: { contents: `export {templatesForCount,sequenceCandidates,mixCandidates,showcaseCandidates,uniqueTemplates} from './src/engine/templates'
export {offeredLayouts,varyPatterns} from './src/engine/layoutOffer'
export {supportsUniformGap} from './src/engine/templateLayout'
export {templateCategory} from './src/engine/templateTransfer'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.bin':'dataurl', '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const m = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const dims = { L: [1500, 1000], P: [1000, 1500], S: [1000, 1000] }
const photos = word => [...word].map((c, i) => ({ id: c + i, width: dims[c][0], height: dims[c][1] }))
const full = process.argv.includes('--full')
const MARGIN = 3, GAP = 6
const ASPECTS = [['18x12', 1.5], ['15x12', 1.25], ['15x15', 1], ['12x17.7', 12.007 / 17.717]]
function offered(word, aspect, keepOrder) {
  const set = photos(word), n = set.length
  const c = m.uniqueTemplates([...m.sequenceCandidates(set, n, null, 'all', aspect), ...m.mixCandidates(set, n, null, 'all', aspect), ...m.showcaseCandidates(set, n, null, 'all', aspect), ...m.templatesForCount(n, null, 'all', aspect)])
    .filter(t => !t.textBoxes?.length && (m.templateCategory(t) !== 'reference' || m.supportsUniformGap(t.placeholders, aspect, MARGIN, GAP)))
  return m.varyPatterns(m.offeredLayouts(set, c, aspect, MARGIN, GAP, keepOrder, true), t => t, aspect).length
}
// A representative set of mixes per count; --full tries every mix (slow).
function mixes(n) {
  const out = new Set()
  const add = (l, p, s, alternate) => {
    if (l < 0 || p < 0 || s < 0 || l + p + s !== n) return
    const grouped = 'L'.repeat(l) + 'P'.repeat(p) + 'S'.repeat(s)
    out.add(grouped)
    if (alternate) { const pool = { L: l, P: p, S: s }; let w = ''; while (w.length < n) for (const k of 'LPS') if (pool[k] > 0) { w += k; pool[k]-- } out.add(w) }
  }
  if (full) { for (let l = 0; l <= n; l++) for (let p = 0; p + l <= n; p++) add(l, p, n - l - p, true); return [...out] }
  add(n, 0, 0); add(0, n, 0); add(0, 0, n)
  add(Math.ceil(n / 2), Math.floor(n / 2), 0, true); add(n - 1, 1, 0, true); add(1, n - 1, 0, true)
  add(Math.floor(n / 3), Math.floor(n / 3), n - 2 * Math.floor(n / 3), true); add(n - 1, 0, 1, true); add(0, n - 1, 1, true); add(Math.ceil(n / 2), 0, Math.floor(n / 2), true); add(0, Math.ceil(n / 2), Math.floor(n / 2), true)
  return [...out]
}
const words = process.argv.filter(a => /^[LPS]+$/.test(a))
if (words.length) {
  for (const [name, aspect] of ASPECTS) for (const w of words) { const t0 = Date.now(); const f = offered(w, aspect, false), o = offered(w, aspect, true); console.log(name.padEnd(8), w.padEnd(26), 'rearranging', String(f).padStart(4), 'in your order', String(o).padStart(4), `(${Date.now() - t0} ms)`) }
  process.exit(0)
}
const counts = process.argv.filter(a => /^\d+$/.test(a)).map(Number)
for (const [name, aspect] of ASPECTS) {
  console.log(`\n=== ${name} (aspect ${aspect.toFixed(3)}): layouts offered per mix. rearranging row / in-your-order row`)
  for (let n = 1; n <= 24; n++) {
    if (counts.length && !counts.includes(n)) continue
    const rows = mixes(n).map(w => [w, offered(w, aspect, false), offered(w, aspect, true)])
    const free = rows.map(r => r[1]).sort((a, b) => a - b), ordered = rows.map(r => r[2]).sort((a, b) => a - b)
    const thin = rows.filter(r => Math.min(r[1], r[2]) < 50).map(r => `${r[0].length > 10 ? r[0].slice(0, 10) + '…' : r[0]}:${r[1]}/${r[2]}`)
    console.log(`n=${String(n).padStart(2)} mixes ${String(rows.length).padStart(3)} | free min ${String(free[0]).padStart(3)} med ${String(free[free.length >> 1]).padStart(3)} | ordered min ${String(ordered[0]).padStart(3)} med ${String(ordered[ordered.length >> 1]).padStart(3)} | either under 50: ${thin.length}${thin.length ? ' (' + thin.slice(0, 5).join(' ') + (thin.length > 5 ? ' …' : '') + ')' : ''}`)
  }
}
