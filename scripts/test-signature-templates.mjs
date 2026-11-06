// The hand-written signature layouts, checked against the rules they were designed to: nothing
// crosses the fold, every frame is photo-shaped, margins stay inside the page, asymmetric layouts
// exist both ways round, and each one offers somewhere for an upright as well as a wide.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: { contents: `export {SIGNATURE_TEMPLATES} from './src/engine/signatureTemplates'`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', write: false,
})
const { SIGNATURE_TEMPLATES } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

assert.ok(SIGNATURE_TEMPLATES.length >= 25, `enough layouts to be a set (got ${SIGNATURE_TEMPLATES.length})`)

const ASPECT = 2 // a spread of two square pages, which every album size this app ships produces
const ids = new Set()

for (const t of SIGNATURE_TEMPLATES) {
  assert.ok(!ids.has(t.id), `${t.id} appears once`)
  ids.add(t.id)
  assert.ok(t.placeholders.length > 0, `${t.id} has frames`)
  assert.equal(t.photoCount, t.placeholders.length, `${t.id} counts its own frames`)
  assert.ok(t.isBuiltIn, `${t.id} is built in`)

  const bleed = t.placeholders.every((p) => p.bleed)
  for (const p of t.placeholders) {
    // Inside the sheet.
    assert.ok(p.x >= -1e-9 && p.y >= -1e-9 && p.x + p.width <= 1 + 1e-9 && p.y + p.height <= 1 + 1e-9,
      `${t.id}: ${p.id} stays on the sheet (${p.x}, ${p.y}, ${p.width}, ${p.height})`)

    // Nothing straddles the gutter, unless the whole thing is a full-bleed spread.
    if (!bleed) {
      assert.ok(p.x + p.width <= 0.5 + 1e-9 || p.x >= 0.5 - 1e-9,
        `${t.id}: ${p.id} stays on one page (x ${p.x} to ${p.x + p.width})`)
    }

    // Photo-shaped: between 2:3 upright and 2:1 wide, which is the range photographs come in.
    const ratio = p.width / p.height * ASPECT
    assert.ok(ratio >= 0.6 && ratio <= 2.2,
      `${t.id}: ${p.id} is photo-shaped (${ratio.toFixed(2)}:1)`)
  }
}

// Asymmetric layouts come as a mirrored pair, so a run of spreads can alternate.
const lefts = SIGNATURE_TEMPLATES.filter((t) => t.id.endsWith('-left'))
assert.ok(lefts.length >= 8, `there are asymmetric layouts (got ${lefts.length})`)
for (const t of lefts) {
  const mirror = SIGNATURE_TEMPLATES.find((o) => o.id === t.id.replace(/-left$/, '-right'))
  assert.ok(mirror, `${t.id} has a mirror`)
  assert.equal(mirror.photoCount, t.photoCount, `${t.id} and its mirror hold the same number of photos`)
  // Mirroring reflects every frame about the fold, so each reflected box has a partner in the
  // mirror. Compared numerically: rounding to a fixed number of places makes a box whose edge
  // lands mid-digit flip between two spellings and fails a string comparison for no reason.
  const sortKey = (b) => b.x * 10 + b.y
  const reflected = t.placeholders.map((p) => ({ x: 1 - p.x - p.width, y: p.y, width: p.width, height: p.height })).sort((a, b) => sortKey(a) - sortKey(b))
  const actual = mirror.placeholders.map((p) => ({ x: p.x, y: p.y, width: p.width, height: p.height })).sort((a, b) => sortKey(a) - sortKey(b))
  reflected.forEach((want, i) => {
    for (const edge of ['x', 'y', 'width', 'height']) {
      assert.ok(Math.abs(want[edge] - actual[i][edge]) < 1e-9,
        `${t.id} really is the mirror of ${mirror.id} (frame ${i} ${edge}: ${want[edge]} vs ${actual[i][edge]})`)
    }
  })
}

// Photo counts a wedding spread actually uses are all covered.
const counts = new Set(SIGNATURE_TEMPLATES.map((t) => t.photoCount))
for (const n of [1, 2, 3, 4, 5, 6]) assert.ok(counts.has(n), `the set covers ${n}-photo spreads`)

// Across the set there is somewhere for every shape of photo, otherwise a mixed spread has no
// signature layout to fall back on.
const shapes = new Set()
for (const t of SIGNATURE_TEMPLATES) for (const p of t.placeholders) {
  const ratio = p.width / p.height * ASPECT
  shapes.add(ratio > 1.15 ? 'landscape' : ratio < 1 / 1.15 ? 'portrait' : 'square')
}
assert.deepEqual([...shapes].sort(), ['landscape', 'portrait', 'square'], 'the set offers all three frame shapes')

console.log(`Signature layout checks passed: ${SIGNATURE_TEMPLATES.length} layouts, none crossing the fold, every frame photo-shaped and on the sheet, asymmetric ones mirrored, counts 1-6 covered, all three frame shapes present.`)
