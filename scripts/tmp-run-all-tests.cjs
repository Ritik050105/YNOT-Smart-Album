const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const dir = path.join(__dirname)
const files = fs.readdirSync(dir).filter(f => /^test-.*\.(cjs|mjs)$/.test(f) && f !== 'tmp-run-all-tests.cjs').sort()
const electronFiles = new Set(files.filter(f => f.endsWith('.cjs')))
// .mjs tests are plain node unless they import electron; check quickly.
const results = []
for (const f of files) {
  const full = path.join(dir, f)
  const src = fs.readFileSync(full, 'utf8')
  const needsElectron = f.endsWith('.cjs') || /from\s+'electron'|require\(['"]electron['"]\)/.test(src)
  const cmd = needsElectron ? 'npx' : 'node'
  const args = needsElectron ? ['electron', full] : [full]
  const start = Date.now()
  const r = spawnSync(cmd, args, { cwd: dir, encoding: 'utf8', timeout: 150000, shell: true })
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  const ok = r.status === 0
  results.push({ f, ok, elapsed, out: (r.stdout || '') + (r.stderr || '') })
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${f} (${elapsed}s)`)
  if (!ok) console.log('---\n' + (r.stdout || '').slice(-2000) + '\n' + (r.stderr || '').slice(-2000) + '\n---')
}
const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed.`)
if (failed.length) console.log('FAILED: ' + failed.map(f => f.f).join(', '))
fs.writeFileSync(path.join(dir, 'tmp-test-results.json'), JSON.stringify(results.map(({f,ok,elapsed})=>({f,ok,elapsed})), null, 2))
