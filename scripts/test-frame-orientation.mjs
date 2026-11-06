// A photo only drops into a frame of its own shape. The rule runs both ways — a portrait photo is
// kept out of a landscape frame and a landscape photo out of a portrait one — because either way
// the crop throws away most of the picture. Square is the exception at both ends.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: { contents: `export {orientationFits,shapeOf} from './src/engine/layoutMath'`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', write: false,
})
const { orientationFits, shapeOf } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const landscape = { width: 6000, height: 4000 }
const portrait = { width: 4000, height: 6000 }
const square = { width: 4000, height: 4000 }

assert.equal(shapeOf(6000, 4000), 'landscape')
assert.equal(shapeOf(4000, 6000), 'portrait')
assert.equal(shapeOf(4000, 4000), 'square')

// Both directions are refused — this is the half that was easy to leave out.
assert.equal(orientationFits(portrait, landscape), false, 'a portrait photo is kept out of a landscape frame')
assert.equal(orientationFits(landscape, portrait), false, 'a landscape photo is kept out of a portrait frame')

// Matching shapes go in.
assert.equal(orientationFits(landscape, landscape), true, 'landscape into landscape')
assert.equal(orientationFits(portrait, portrait), true, 'portrait into portrait')

// Square is permissive at both ends, so a near-square crop is never refused on a technicality.
assert.equal(orientationFits(square, landscape), true, 'a square photo fits a landscape frame')
assert.equal(orientationFits(square, portrait), true, 'a square photo fits a portrait frame')
assert.equal(orientationFits(landscape, square), true, 'a landscape photo fits a square frame')
assert.equal(orientationFits(portrait, square), true, 'a portrait photo fits a square frame')

// The deadband: 4:3 and 3:4 are decidedly landscape and portrait, but 1.1:1 is still square, so a
// frame that is a hair off square does not start refusing photos.
assert.equal(shapeOf(1100, 1000), 'square', 'a hair off square is still square')
assert.equal(orientationFits({ width: 1000, height: 1100 }, { width: 1100, height: 1000 }), true,
  'two near-square shapes fit each other')
assert.equal(orientationFits({ width: 4000, height: 3000 }, { width: 3000, height: 4000 }), false,
  '4:3 and 3:4 are opposite shapes and are refused')

// Degenerate sizes never block a drop.
assert.equal(orientationFits({ width: 0, height: 0 }, landscape), true, 'a photo with no size is not refused')

console.log('Frame orientation checks passed: both directions refused, matching shapes allowed, square permissive at both ends, near-square inside the deadband.')
