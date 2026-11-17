// Writes docs/template-combinations.md: every combination of photographs over a spread for 1 to 24 photographs, and for a representative set of
// photographs which of those families the generator really fills (so the gaps are on record, not guessed).
//   node scripts/list-combinations.mjs [--check]
import { build } from 'esbuild'
import fs from 'node:fs'
const check = process.argv.includes('--check')
const result = await build({
  stdin: { contents: `export {combinationsFor,allowedAtCount} from './src/engine/templateCombinations'
export {showcaseForRatios} from './src/engine/showcaseLayouts'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.bin':'dataurl', '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const m = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const RATIO = { L: 1.5, P: 2 / 3, S: 1 }
const mixes = n => ({ 'all landscape': 'L'.repeat(n), 'landscape and portrait alternating': Array.from({ length: n }, (_, i) => (i % 2 ? 'P' : 'L')).join(''), 'all portrait': 'P'.repeat(n) })
const lines = ['# Template combinations, 1 to 24 photographs', '',
  'Every way the photographs of a spread can be shared out is a *combination*, and each combination is a family of templates (every template in a family a different arrangement; none repeated across families).', '',
  '- **Where**: all on the left page, all on the right page, the first *k* on the left and the rest on the right (every *k* from 1 to *n*-1), or across the whole spread.',
  '- **How each page (or the spread) is set**: **full** = photographs run to the trim; **fill** = they fill it to the album margin; **loose** = they sit on it with white round them (named with the page alone, e.g. "2 photos left").',
  '- So there are 3 (spread) + 3 (left) + 3 (right) + 9 x (n-1) (splits) = **9n** combinations for n photographs.',
  '- Across the whole spread (the three spread combinations) is only offered up to 4 photographs, because with more than 4 nothing may cross the fold.', '']
let total = 0, filledTotal = 0
for (let n = 1; n <= 24; n++) {
  const all = m.combinationsFor(n), allowed = all.filter(m.allowedAtCount)
  total += all.length
  lines.push(`## ${n} photograph${n === 1 ? '' : 's'} (${all.length} combinations${allowed.length < all.length ? `, ${allowed.length} offered` : ''})`, '')
  if (check) {
    for (const [name, word] of Object.entries(mixes(n))) {
      const have = new Set(m.showcaseForRatios([...word].map(c => RATIO[c]), 1.5).map(t => t.name.replace('Showcase · ', '').replace(/ \(rearranged\)$/, '')))
      const got = allowed.filter(c => have.has(c.label)), missing = allowed.filter(c => !have.has(c.label))
      if (name === 'landscape and portrait alternating') { filledTotal += got.length }
      lines.push(`- ${name} (18x12): ${got.length} of ${allowed.length} combinations have templates${missing.length ? `; none for: ${missing.slice(0, 6).map(c => c.label).join(' / ')}${missing.length > 6 ? ' ...' : ''}` : ''}`)
    }
    lines.push('')
  }
  lines.push('| kind | combination |', '|---|---|')
  for (const c of all) lines.push(`| ${c.kind}${c.split ? ' ' + c.split : ''} | ${c.label}${m.allowedAtCount(c) ? '' : ' (not offered: fold rule)'} |`)
  lines.push('')
}
lines.splice(10, 0, `Total: **${total}** combinations over 1 to 24 photographs.`, '')
fs.mkdirSync('docs', { recursive: true })
fs.writeFileSync('docs/template-combinations.md', lines.join('\n'))
console.log('written', total, 'combinations', check ? `(filled for the alternating mix: ${filledTotal})` : '')
