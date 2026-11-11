// Repacks the Employee Mac kit's app.asar with the code in this checkout, keeping everything that
// makes it a Mac build: its Mac node_modules (sharp/libvips for darwin, left unpacked), its licence
// identity, its runtime, its install scripts. Windows can do this — no Mac is needed — because an
// asar is a container and the renderer and main-process code in it is platform-neutral JavaScript.
//
//   node scripts/assemble-employee-mac-kit.cjs "<path to 03 Employee Mac - Apple Silicon>"
//
// Run `npm run build` first: this packages whatever dist/ and dist-electron/ hold right now.
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert/strict'), crypto = require('crypto')
const asar = require('@electron/asar')

const kit = path.resolve(process.argv[2] || '')
assert(process.argv[2] && fs.existsSync(path.join(kit, 'payload', 'app.asar')), 'Pass the path of a kit folder that has payload/app.asar')
const repo = process.cwd()
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

function files(root, rel = '') {
  return fs.readdirSync(path.join(root, rel), { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, rel, entry.name)
    assert(!fs.lstatSync(full).isSymbolicLink(), `symbolic link in a kit: ${full}`)
    const relative = rel ? rel + '/' + entry.name : entry.name
    return entry.isDirectory() ? files(root, relative) : [relative]
  })
}
function manifest(dir) {
  const lines = files(dir).filter((f) => f !== 'SHA256SUMS.txt').sort().map((f) => hash(path.join(dir, f)) + '  ' + f)
  fs.writeFileSync(path.join(dir, 'SHA256SUMS.txt'), lines.join('\n') + '\n')
  return lines.length
}

;(async () => {
  const archive = path.join(kit, 'payload', 'app.asar')
  const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'))

  // The kit has to be a build of this app: same dependencies, same licence verification key.
  assert.deepEqual(JSON.parse(asar.extractFile(archive, 'package.json')).dependencies, pkg.dependencies,
    'The kit was built with different dependencies than this checkout — its unpacked node_modules would not match')
  assert(asar.extractFile(archive, path.join('dist-electron', 'licensePublicKey.js')).equals(fs.readFileSync(path.join(repo, 'dist-electron', 'licensePublicKey.js'))),
    'The licence public key differs — this kit would reject every licence that was issued for the last one')

  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'mac-kit-stage-'))
  try {
    asar.extractAll(archive, stage)
    for (const dir of ['dist', 'dist-electron']) {
      const destination = path.resolve(stage, dir)
      assert(destination.startsWith(stage + path.sep))
      fs.rmSync(destination, { recursive: true, force: true })
      fs.cpSync(path.join(repo, dir), destination, { recursive: true })
    }
    for (const icon of ['icon.png', 'icon.ico', 'icon.icns']) fs.copyFileSync(path.join(repo, 'build', icon), path.join(stage, 'build', icon))

    await asar.createPackageWithOptions(stage, archive, { unpackDir: 'node_modules/{sharp,@img}' })
    asar.uncache(archive)
  } finally {
    fs.rmSync(stage, { recursive: true, force: true })
  }

  for (const file of asar.listPackage(archive)) {
    const name = file.replace(/\\/g, '/').replace(/^\//, '')
    // Nothing that belongs to the owner's side may ride along in an employee build.
    assert(!/admin-license|signing-private|owner-vault|\.pem$/i.test(name), `owner material in the employee kit: ${name}`)
  }
  for (const f of ['projectPackage.js', 'licensePublicKey.js', 'main.js']) {
    if (fs.existsSync(path.join(repo, 'dist-electron', f)))
      assert(asar.extractFile(archive, path.join('dist-electron', f)).equals(fs.readFileSync(path.join(repo, 'dist-electron', f))), `${f} in the kit differs from this build`)
  }
  assert(asar.extractFile(archive, path.join('dist', 'index.html')).equals(fs.readFileSync(path.join(repo, 'dist', 'index.html'))), 'index.html differs from this build')

  // The installer checks the archive's header against this value before it trusts the archive.
  fs.writeFileSync(path.join(kit, 'payload', 'asar-header.sha256'), crypto.createHash('sha256').update(asar.getRawHeader(archive).headerString).digest('hex') + '\n')
  const count = manifest(kit)
  console.log(`PASS: ${kit}\n      app.asar repacked with this checkout, header hash rewritten, ${count} files in SHA256SUMS.txt`)
})().catch((error) => { console.error(error); process.exitCode = 1 })
