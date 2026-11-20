// Installer-time scan for the font files already on this computer. Run by the Windows installer window (through the app's bundled Node: ELECTRON_RUN_AS_NODE=1)
// right after the files are copied, so the app opens with every local font detected and ready, and nobody has to run the slow "Scan PC & connected drives" by hand
// (and sit through the lag it caused) afterwards. Prints a progress line now and then. Usage: scan-local-fonts.cjs <output json>
// The result is a list of { family, path } rows, the same shape the app keeps its own list in; the app adopts it the first time it starts.
// YNOT_FONT_SCAN_ROOTS (folders separated by the platform's path delimiter) replaces the usual places, for tests.
const fs = require('fs'), path = require('path')
const out = process.argv[2]
if (!out) { console.error('Usage: scan-local-fonts.cjs <output json>'); process.exit(2) }

const FONT = /\.(ttf|otf|woff2?)$/i
// Folders that hold programs, not fonts, or that are very large and never do: skipped, so the scan is minutes, not an hour.
const SKIP = process.platform === 'darwin'
  ? /^(node_modules|\.git|\.trash|library|applications|system|private|cores|opt|usr|bin|sbin|var|dev)$/i
  : /^(node_modules|\.git|\$recycle\.bin|system volume information|winsxs|windows\.old|\$windows\.~bt|programdata|appdata|windows|recovery|config\.msi|intel|perflogs)$/i

function roots() {
  if (process.env.YNOT_FONT_SCAN_ROOTS) return process.env.YNOT_FONT_SCAN_ROOTS.split(path.delimiter).filter(Boolean)
  const installed = [process.env.WINDIR && path.join(process.env.WINDIR, 'Fonts'), process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts')]
  const drives = []
  if (process.platform === 'win32') for (let i = 0; i < 26; i++) { const p = String.fromCharCode(65 + i) + ':\\'; try { if (fs.statSync(p).isDirectory()) drives.push(p) } catch { /* no such drive */ } }
  else {
    const home = require('os').homedir()
    // The Mac's installed font folders, then the user's folders and any mounted drives.
    installed.push('/System/Library/Fonts', '/Library/Fonts', path.join(home, 'Library', 'Fonts'))
    drives.push(home)
    try { for (const volume of fs.readdirSync('/Volumes')) drives.push(path.join('/Volumes', volume)) } catch { /* no volumes folder */ }
  }
  // Installed fonts first (they matter most), then every drive; the user's own profile folders are searched as part of their drive.
  return [...installed.filter(Boolean), ...drives]
}

;(async () => {
  const found = new Map(), seen = new Set()
  let visited = 0
  const pending = roots().reverse()
  const topLevel = new Set(roots().map(r => r.toLowerCase()))
  while (pending.length) {
    const dir = pending.pop()
    if (seen.has(dir.toLowerCase())) continue
    seen.add(dir.toLowerCase())
    let entries
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }) } catch { continue }
    visited++
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // A drive's own top-level folders are filtered; folders the user pointed at (and the installed font folders) are searched whatever they are called.
        if (!topLevel.has(file.toLowerCase()) && SKIP.test(entry.name)) continue
        pending.push(file)
      } else if (entry.isFile() && FONT.test(entry.name)) {
        try { const info = await fs.promises.stat(file); if (info.size && info.size <= 10 * 1024 * 1024) found.set(file, { family: path.basename(file, path.extname(file)), path: file }) } catch { /* unreadable */ }
      }
    }
    if (visited % 400 === 0) console.log(`Looked in ${visited} folders, found ${found.size} font files`)
  }
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const tmp = out + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify([...found.values()]))
  fs.renameSync(tmp, out) // written last, whole: a half-finished scan never leaves a half-read list
  console.log(`Done: ${found.size} font files in ${visited} folders`)
})().catch(error => { console.error(String(error)); process.exit(1) })
