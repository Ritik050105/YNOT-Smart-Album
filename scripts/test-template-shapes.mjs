// A layout is only offered for a set of photos if it can give each photo a frame of its own shape.
// Square frames are the give in the system: they take any photo, so they absorb whichever shape the
// layout is short of.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: { contents: `export {templateShapesFit} from './src/engine/templateMatching'`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', write: false,
})
const { templateShapesFit } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const photo = (shape, i) => ({
  id: 'p' + i, fileName: `${shape}-${i}.jpg`, src: '', bins: [], favorite: false,
  orientation: shape,
  width: shape === 'portrait' ? 4000 : shape === 'landscape' ? 6000 : 4000,
  height: shape === 'portrait' ? 6000 : shape === 'landscape' ? 4000 : 4000,
})
const photos = (...shapes) => shapes.map(photo)

/** A template on a 2:1 spread. Frame widths are halved so `width * aspect / height` is the real
 *  shape: 0.25 wide x 1 tall on a 2:1 sheet is a square. */
const template = (...frames) => ({
  id: 't', name: 't', photoCount: frames.length, pageSide: 'spread', isBuiltIn: true,
  createdAt: new Date(0).toISOString(), thumbnailColor: '#000',
  placeholders: frames.map((f, i) => ({ id: 'f' + i, preferredOrientation: 'any', x: i * 0.1, y: 0, ...f })),
})
const ASPECT = 2
// On a 2:1 sheet: width 0.25/height 1 => square; 0.5/1 => landscape 1:1... so use explicit numbers.
const square = { width: 0.25, height: 0.5 }      // 0.25*2/0.5 = 1.0  square
const landscapeFrame = { width: 0.4, height: 0.4 } // 0.4*2/0.4 = 2.0  landscape
const portraitFrame = { width: 0.1, height: 0.5 }  // 0.1*2/0.5 = 0.4  portrait

// Sanity: the frames really are the shapes this test claims.
assert.ok(templateShapesFit(photos('square'), template(square), ASPECT), 'the square frame is square')
assert.ok(templateShapesFit(photos('landscape'), template(landscapeFrame), ASPECT), 'the landscape frame is landscape')
assert.ok(templateShapesFit(photos('portrait'), template(portraitFrame), ASPECT), 'the portrait frame is portrait')

// The case from the report: a portrait photo must not be forced into a landscape frame.
assert.equal(templateShapesFit(photos('portrait'), template(landscapeFrame), ASPECT), false,
  'a portrait photo is not offered a landscape-only layout')
assert.equal(templateShapesFit(photos('landscape'), template(portraitFrame), ASPECT), false,
  'a landscape photo is not offered a portrait-only layout')

// A mixed spread needs a layout that holds both shapes.
assert.ok(templateShapesFit(photos('portrait', 'landscape'), template(portraitFrame, landscapeFrame), ASPECT),
  'one of each fits a layout with one of each')
assert.equal(templateShapesFit(photos('portrait', 'portrait'), template(portraitFrame, landscapeFrame), ASPECT), false,
  'two portraits do not fit one portrait frame and one landscape frame')

// Square frames absorb the shortfall, which is what makes a square-framed layout universal.
assert.ok(templateShapesFit(photos('portrait', 'portrait'), template(portraitFrame, square), ASPECT),
  'a square frame takes the second portrait')
assert.ok(templateShapesFit(photos('portrait', 'landscape'), template(square, square), ASPECT),
  'an all-square layout takes any mix')

// A square photo goes anywhere, so it never makes a layout infeasible.
assert.ok(templateShapesFit(photos('square', 'landscape'), template(landscapeFrame, landscapeFrame), ASPECT),
  'a square photo is happy in a landscape frame')

// Counts must line up: a layout for three photos is not offered for two.
assert.equal(templateShapesFit(photos('square', 'square'), template(square, square, square), ASPECT), false,
  'a three-frame layout is not offered to two photos')

console.log('Template shape checks passed: a photo is never forced into the opposite shape, square frames absorb the shortfall, square photos fit anywhere, and frame counts must match.')
