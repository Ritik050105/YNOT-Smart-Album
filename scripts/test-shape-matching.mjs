// A mixed drop of uprights and landscapes should land in a layout that has an upright frame for
// each upright and a landscape frame for each landscape. Where no layout manages that, the one
// that gets the most of them right wins — not whichever ranked first among all the wrong ones.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: {
    contents: `export {templateShapeMismatches,templateShapesFit} from './src/engine/templateMatching'
export {templatesForCount} from './src/engine/templates'
export {resolveTemplateFrames} from './src/engine/templateLayout'
export {shapeOf} from './src/engine/layoutMath'`,
    resolveDir: process.cwd(),
  },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const { templateShapeMismatches, templateShapesFit, templatesForCount, resolveTemplateFrames, shapeOf } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const ASPECT = 1, MARGIN = 10, GAP = 10
const landscape = i => ({ id: 'l' + i, width: 900, height: 600 })
const upright = i => ({ id: 'p' + i, width: 600, height: 900 })

const template = (id, boxes) => ({
  id, name: id, photoCount: boxes.length, pageSide: 'spread', isBuiltIn: true,
  createdAt: new Date(0).toISOString(), thumbnailColor: '#000',
  placeholders: boxes.map(([x, y, width, height], i) => ({ id: `${id}-${i}`, x, y, width, height, preferredOrientation: 'any' })),
})

// Two uprights side by side, and two landscapes stacked. On a square spread each is the exact
// opposite of the other, so each suits one pair of photographs and not the other.
const twoUpright = template('two-upright', [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]])
const twoLandscape = template('two-landscape', [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]])

const shapesOf = t => resolveTemplateFrames(t.placeholders, ASPECT, MARGIN, GAP).map(f => shapeOf(f.width * ASPECT, f.height))
assert.deepEqual(shapesOf(twoUpright), ['portrait', 'portrait'], 'the fixture is what this test thinks it is')
assert.deepEqual(shapesOf(twoLandscape), ['landscape', 'landscape'], 'the fixture is what this test thinks it is')

const uprights = [upright(0), upright(1)], landscapes = [landscape(0), landscape(1)]
assert.equal(templateShapeMismatches(uprights, twoUpright, ASPECT, MARGIN, GAP), 0, 'two uprights fit two upright frames')
assert.equal(templateShapeMismatches(uprights, twoLandscape, ASPECT, MARGIN, GAP), 2, 'and neither fits a landscape frame')
assert.equal(templateShapeMismatches(landscapes, twoLandscape, ASPECT, MARGIN, GAP), 0, 'the mirror holds')
assert.equal(templateShapeMismatches(landscapes, twoUpright, ASPECT, MARGIN, GAP), 2, 'the mirror holds')

// One of each: neither layout suits both, and both get exactly one wrong. That is the case the
// count exists for — a boolean says only "no" to both and leaves the choice to chance.
const mixed = [landscape(0), upright(0)]
assert.equal(templateShapeMismatches(mixed, twoUpright, ASPECT, MARGIN, GAP), 1, 'one of the two is cropped')
assert.equal(templateShapeMismatches(mixed, twoLandscape, ASPECT, MARGIN, GAP), 1, 'either way round')
assert.equal(templateShapesFit(mixed, twoUpright, ASPECT, MARGIN, GAP), false, 'and neither counts as a fit')

// A square frame takes whatever the layout is short of, so it never counts against a layout.
const oneSquareOneUpright = template('square-and-upright', [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 1]])
assert.equal(templateShapeMismatches(mixed, oneSquareOneUpright, ASPECT, MARGIN, GAP), 0, 'a square frame absorbs the landscape')

// The count agrees with the boolean everywhere in the real library, so nothing that used to be
// offered has quietly stopped being offered.
const photos = [landscape(0), upright(0), landscape(1), upright(1), landscape(2), upright(2)]
let perfect = 0
for (const t of templatesForCount(6, null, 'all', ASPECT)) {
  const misses = templateShapeMismatches(photos, t, ASPECT, MARGIN, GAP)
  assert.equal(templateShapesFit(photos, t, ASPECT, MARGIN, GAP), misses === 0, `${t.id}: fit and count agree`)
  assert.ok(misses >= 0 && misses <= photos.length, `${t.id}: the count is a count`)
  if (misses === 0) perfect++
}
assert.ok(perfect > 0, 'three uprights and three landscapes have somewhere to go')

console.log(`Shape matching checks passed: mismatches counted, squares absorb the shortfall, ${perfect} layouts take a mixed six exactly.`)
