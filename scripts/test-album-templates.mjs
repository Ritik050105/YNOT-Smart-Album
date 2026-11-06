// Layouts read back out of YNOT's own delivered albums. The geometry came from a tracer, so these
// checks are about what the tracer could get wrong: frames off the sheet, frames overlapping each
// other, caption-sized scraps counted as photographs, and duplicate spreads.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: { contents: `export {ALBUM_TEMPLATES} from './src/engine/albumTemplates'`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', write: false,
})
const { ALBUM_TEMPLATES } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

assert.ok(ALBUM_TEMPLATES.length >= 10, `enough layouts to be worth having (got ${ALBUM_TEMPLATES.length})`)

const ALBUM_ASPECT = 3 // the album these came from is 36 x 12 inches
const signatures = new Set()

for (const t of ALBUM_TEMPLATES) {
  assert.ok(t.placeholders.length >= 2, `${t.id} holds more than one photo`)
  assert.equal(t.photoCount, t.placeholders.length, `${t.id} counts its own frames`)
  assert.ok(t.isBuiltIn, `${t.id} is built in`)
  assert.equal(t.textBoxes, undefined, `${t.id} is an image layout, with no text`)

  for (const p of t.placeholders) {
    assert.ok(p.x >= -1e-9 && p.y >= -1e-9 && p.x + p.width <= 1 + 1e-9 && p.y + p.height <= 1 + 1e-9,
      `${t.id}: ${p.id} is on the sheet (${p.x}, ${p.y}, ${p.width}, ${p.height})`)
    assert.ok(p.width > 0 && p.height > 0, `${t.id}: ${p.id} has size`)

    // A caption or a logo is not a photo frame; anything this small was filtered out.
    assert.ok(p.width * p.height >= 0.012, `${t.id}: ${p.id} is photo-sized (area ${(p.width * p.height).toFixed(4)})`)

    // And nothing stretched into a band.
    const ratio = p.width / p.height * ALBUM_ASPECT
    assert.ok(ratio >= 0.4 && ratio <= 3.0, `${t.id}: ${p.id} is photo-shaped (${ratio.toFixed(2)}:1)`)
  }

  // Frames may touch, but must not sit on top of each other — an overlap means the tracer split
  // one photo into two, or merged a background into a frame.
  const f = t.placeholders
  for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) {
    const a = f[i], b = f[j]
    const overlap = a.x < b.x + b.width - 0.004 && b.x < a.x + a.width - 0.004 &&
      a.y < b.y + b.height - 0.004 && b.y < a.y + a.height - 0.004
    assert.ok(!overlap, `${t.id}: ${a.id} and ${b.id} do not overlap`)
  }

  const signature = f.map((p) => [p.x, p.y, p.width, p.height].map((v) => Math.round(v * 50)).join(',')).sort().join('|')
  assert.ok(!signatures.has(signature), `${t.id} is not a repeat of another spread`)
  signatures.add(signature)
}

// A useful range of photo counts, or there is no point having them.
const counts = new Set(ALBUM_TEMPLATES.map((t) => t.photoCount))
assert.ok(counts.size >= 6, `the set covers a range of photo counts (got ${[...counts].sort((a, b) => a - b).join(', ')})`)

console.log(`Album layout checks passed: ${ALBUM_TEMPLATES.length} layouts from delivered spreads, all on the sheet, photo-sized, photo-shaped, non-overlapping and distinct, covering ${counts.size} photo counts.`)
