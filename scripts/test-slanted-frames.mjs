// A frame a designer drew at an angle keeps its angle and its real proportions, instead of being
// read as the larger upright box that happens to enclose it. Upright shapes are untouched by this,
// which is the half that matters most: they are what nearly every template is made of.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: { contents: `export {vectorMaskGeometry} from './src/engine/templateGeometry'`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', write: false,
})
const { vectorMaskGeometry } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

/** Only the anchor point is read, from points[2] and points[3] — the control points either side of
 *  it are ignored, so this fills them with the anchor too. */
const knot = (x, y) => ({ points: [x, y, x, y, x, y] })
const rect = (points) => vectorMaskGeometry(points.map(([x, y]) => knot(x, y)))

// A rectangle turned 30°, 400 x 200, centred on (500, 400).
const turn = (w, h, deg, cx, cy) => {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a)
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c])
}

{
  const found = rect(turn(400, 200, 30, 500, 400))
  assert.ok(found, 'a turned rectangle is read')
  assert.ok(Math.abs(found.rotationDeg - 30) < 0.01, `the angle is 30 (got ${found.rotationDeg})`)
  assert.ok(Math.abs(found.width - 400) < 0.01 && Math.abs(found.height - 200) < 0.01,
    `the box keeps its own 400x200 (got ${found.width}x${found.height})`)
  // Centred where the artwork put it, so rotating about the centre lands it back on the shape.
  assert.ok(Math.abs(found.x + found.width / 2 - 500) < 0.01 && Math.abs(found.y + found.height / 2 - 400) < 0.01,
    'the box is centred on the shape')
  // The upright box enclosing this shape is much larger — that is the reading being avoided.
  assert.ok(400 * 200 < (400 * Math.cos(Math.PI / 6) + 200 * Math.sin(Math.PI / 6)) * (400 * Math.sin(Math.PI / 6) + 200 * Math.cos(Math.PI / 6)) * 0.95,
    'the upright box really is bigger, so this test is testing something')
}

// Negative angles read as negative, not as their mirror.
{
  const found = rect(turn(300, 300, -20, 400, 400))
  assert.ok(found && Math.abs(found.rotationDeg + 20) < 0.01, `a counter-clockwise turn is negative (got ${found?.rotationDeg})`)
}

// An upright rectangle is NOT treated as turned: it keeps the existing reading, corner radii and all.
for (const deg of [0, 90, 180, -90]) {
  const found = rect(turn(300, 180, deg, 400, 300))
  assert.ok(found, `${deg}deg is still read`)
  assert.ok(!found.rotationDeg, `${deg}deg is upright, not turned (got ${found.rotationDeg})`)
}

// A rounded upright rectangle still reports its radii — the path this change must not disturb.
{
  const r = 40, x = 100, y = 100, w = 400, h = 300
  const found = rect([
    [x + r, y], [x + w - r, y], [x + w, y + r], [x + w, y + h - r],
    [x + w - r, y + h], [x + r, y + h], [x, y + h - r], [x, y + r],
  ])
  assert.ok(found, 'a rounded rectangle is read')
  assert.ok(!found.rotationDeg, 'a rounded upright rectangle is not turned')
  assert.ok(found.radii.every((v) => Math.abs(v - r) < 1), `its corners are ${r} (got ${found.radii.join(', ')})`)
}

// A shape that is not a rectangle has no angle to report, so the upright reading stands.
{
  const found = rect([[0, 0], [400, 20], [380, 300], [20, 260]])
  assert.ok(!found || !found.rotationDeg, 'a lopsided quadrilateral is not called a turned rectangle')
}

console.log('Slanted frame checks passed: a turned rectangle keeps its angle, size and centre; upright and rounded rectangles read exactly as before; a non-rectangle is left alone.')
