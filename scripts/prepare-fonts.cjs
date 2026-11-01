// Installer-time Google Fonts download. Run by the Windows installer window and by the Mac
// INSTALL UPDATE.command (via the app's bundled Node: ELECTRON_RUN_AS_NODE=1). Resumable:
// families already complete on disk are skipped. Prints one progress line per family.
// Usage: prepare-fonts.cjs <catalog.json> <output dir>
const fs = require('fs'), path = require('path')
const [catalogFile, outDir] = process.argv.slice(2)
if (!catalogFile || !outDir) { console.error('Usage: prepare-fonts.cjs <catalog.json> <output dir>'); process.exit(2) }
const catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'))
const slug = (family) => family.replace(/[^A-Za-z0-9]+/g, '_')
const timeout = () => AbortSignal.timeout(30000)
async function get(url, text) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, { signal: timeout(), headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' } })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return text ? await r.text() : Buffer.from(await r.arrayBuffer())
    } catch (e) { if (attempt >= 2) throw e }
  }
}
async function prepare(entry) {
  const dir = path.join(outDir, slug(entry.family)), index = path.join(dir, 'faces.json')
  if (fs.existsSync(index)) return
  const variants = entry.variants.map(v => [v.endsWith('i') ? 1 : 0, parseInt(v, 10)]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const css = await get('https://fonts.googleapis.com/css2?family=' + entry.family.replace(/ /g, '+') + ':ital,wght@' + variants.map(v => v.join(',')).join(';') + '&display=swap', true)
  const faces = []
  fs.mkdirSync(dir, { recursive: true })
  for (const block of css.match(/@font-face\s*\{[^}]+\}/g) ?? []) {
    const url = block.match(/url\(([^)]+)\)/)?.[1]?.replace(/["']/g, '')
    if (!url || new URL(url).hostname !== 'fonts.gstatic.com' || new URL(url).protocol !== 'https:') throw new Error('Invalid font source')
    const file = faces.length + '.font'
    fs.writeFileSync(path.join(dir, file), await get(url))
    faces.push({ file, weight: block.match(/font-weight:\s*([^;]+)/)?.[1] ?? '400', style: block.match(/font-style:\s*([^;]+)/)?.[1] ?? 'normal', unicodeRange: block.match(/unicode-range:\s*([^;]+)/)?.[1] ?? 'U+0-10FFFF' })
  }
  if (!faces.length) throw new Error('No font files returned')
  fs.writeFileSync(index, JSON.stringify(faces)) // written last: marks the family complete
}
;(async () => {
  fs.mkdirSync(outDir, { recursive: true })
  let next = 0, done = 0, failed = 0
  console.log('Downloading ' + catalog.length + ' Google font families to ' + outDir)
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < catalog.length) {
      const entry = catalog[next++]
      try { await prepare(entry) } catch (e) { failed++; console.log('  skipped ' + entry.family + ': ' + e.message) }
      done++
      if (done % 10 === 0 || done === catalog.length) console.log('Fonts ' + done + '/' + catalog.length + ' - ' + entry.family)
    }
  }))
  console.log(failed ? 'Finished with ' + failed + ' family(ies) skipped; the app downloads those on first use.' : 'All fonts ready.')
})().catch(e => { console.error(e); process.exit(1) })
