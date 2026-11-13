// How many balanced layouts each mix of wide/upright photographs yields per album shape: node scripts/balanced-yield.mjs [counts...]
import { build } from 'esbuild'
const r = await build({ stdin: { contents: `export {balancedTemplates} from './src/engine/balancedLayouts'`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false })
const m = await import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`)
const counts = process.argv.slice(2).map(Number); const list = counts.length ? counts : [2, 3, 4, 6, 8, 12, 16, 24]
for (const [name, a] of [['3:2', 1.5], ['5:4', 1.25], ['1:1', 1], ['portrait', 0.6777]]) {
  for (const n of list) {
    const t0 = Date.now(); const all = m.balancedTemplates(n, a)
    const per = Array.from({ length: n + 1 }, (_, l) => all.filter(t => t.id.includes(`-${n}-${l}l-`)).length)
    console.log(name.padEnd(8), 'n=' + String(n).padStart(2), per.join(' '), `(${Date.now() - t0} ms)`)
  }
}
