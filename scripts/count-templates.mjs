// Checks the template browser against docs/template-counts.json (the sheet "YNOT Album Templates Count.xlsx"): for every photo combination,
// how many templates the rearranging shelf offers, against how many the sheet requires. Not a test (it takes minutes): run it to see where a shelf
// falls short.
//   node scripts/count-templates.mjs [--aspect 3] [--aspect 1.5] [--photos 6,8] [--write docs/template-counts-achieved.md]
// Album shapes are width / height of the spread; 12x36 is 3 (36 wide, 12 high) and 12 wide by 36 high is 0.3333.
import { build } from 'esbuild'
import fs from 'node:fs'

const args = process.argv.slice(2)
const flag = name => { const out = []; args.forEach((a, i) => { if (a === name) out.push(args[i + 1]) }); return out }
const aspects = flag('--aspect').length ? flag('--aspect').map(Number) : [3, 1.5, 1]
const only = flag('--photos')[0]?.split(',').map(Number)
const write = flag('--write')[0]
const sheet = JSON.parse(fs.readFileSync('docs/template-counts.json', 'utf8'))

const result = await build({
  stdin: { contents: `export {templatesForCount,sequenceCandidates,mixCandidates,showcaseCandidates,uniqueTemplates} from './src/engine/templates'
export {offeredLayouts,varyPatterns} from './src/engine/layoutOffer'
export {supportsUniformGap} from './src/engine/templateLayout'
export {mustHoldGap} from './src/engine/templateTransfer'
export {templatesRequired,wantedTemplates} from './src/engine/templateCounts'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.bin': 'dataurl', '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const m = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const MARGIN = 3, GAP = 6
const photosOf = (n, h) => Array.from({ length: n }, (_, i) => i < h ? { id: 'h' + i, width: 1500, height: 1000 } : { id: 'v' + i, width: 1000, height: 1500 })

const report = []
for (const aspect of aspects) {
  let required = 0, offered = 0, met = 0, rows = 0
  const short = []
  const t0 = Date.now()
  for (const row of sheet.rows) {
    if (only && !only.includes(row.photos)) continue
    const set = photosOf(row.photos, row.horizontal)
    // the sheet and the app must agree on what a combination needs
    if (m.templatesRequired(row.photos, row.horizontal) !== row.templates) throw new Error(`templateCounts.ts disagrees with the sheet for ${row.photos}:${row.horizontal}`)
    const pool = m.uniqueTemplates([...m.sequenceCandidates(set, row.photos, null, 'all', aspect), ...m.mixCandidates(set, row.photos, null, 'all', aspect), ...m.showcaseCandidates(set, row.photos, null, 'all', aspect), ...m.templatesForCount(row.photos, null, 'all', aspect)])
      .filter(t => !t.textBoxes?.length && (!m.mustHoldGap(t) || m.supportsUniformGap(t.placeholders, aspect, MARGIN, GAP)))
    const count = m.varyPatterns(m.offeredLayouts(set, pool, aspect, MARGIN, GAP, false, true), t => t, aspect, m.wantedTemplates(set)).length
    rows++; required += row.templates; offered += count; if (count >= row.templates) met++; else short.push(`${row.photos} photos, ${row.horizontal} horizontal / ${row.vertical} vertical: ${count} of ${row.templates}`)
    process.stderr.write('.')
  }
  const line = `Album shape ${aspect}: ${met} of ${rows} combinations have the required count (${offered} templates offered of ${required} required) in ${Math.round((Date.now() - t0) / 1000)} s`
  console.log('\n' + line)
  if (short.length) console.log(short.map(s => '  short: ' + s).join('\n'))
  report.push({ aspect, line, short })
}
if (write) {
  const md = ['# Templates offered against templates required', '', 'Measured by `node scripts/count-templates.mjs` on the rearranging shelf (every photograph free to move to any frame of its shape), against the counts in `docs/template-counts.md`. A combination "has the required count" when the browser offers at least that many.', '',
    ...report.flatMap(r => [`## Album shape ${r.aspect} (spread width / height)`, '', r.line, '', ...(r.short.length ? ['Short:', '', ...r.short.map(s => '- ' + s), ''] : ['Every combination has the required count.', ''])])]
  fs.writeFileSync(write, md.join('\n'))
  console.log('written', write)
}
