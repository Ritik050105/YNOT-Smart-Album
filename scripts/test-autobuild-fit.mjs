// What a user sees after Auto Build: every photograph sits in a frame of its own shape (a panorama
// never lands in a tall frame, an upright never in a wide one), and the spacing between frames is
// the album's gap rather than whatever the layout happened to be drawn with.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: {
    contents: `export {buildSpreadsFromGroups,groupPhotosForCount,spreadCountRange} from './src/engine/autoLayout'
export {MAX_PHOTOS_PER_SPREAD} from './src/engine/spreadLimits'
export {computePlaceholderBoxes,orientationFits} from './src/engine/layoutMath'
export {runsToTheTrim,findTemplate} from './src/engine/templates'
export {supportsUniformGap} from './src/engine/templateLayout'
export {templateCategory} from './src/engine/templateTransfer'`,
    resolveDir: process.cwd(),
  },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const { MAX_PHOTOS_PER_SPREAD, groupPhotosForCount, spreadCountRange, buildSpreadsFromGroups, computePlaceholderBoxes, orientationFits, runsToTheTrim, findTemplate, supportsUniformGap, templateCategory } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const shapes = [[900, 600], [600, 900], [700, 700], [1200, 400], [400, 1000], [900, 600]]
const photo = (i) => {
  const [width, height] = shapes[i % shapes.length]
  return { id: 'p' + i, name: `p${i}.jpg`, src: '', width, height, orientation: width > height ? 'landscape' : width < height ? 'portrait' : 'square', capturedAt: new Date(2026, 9, 22, 8, i).toISOString(), bins: [], favorite: false, megapixels: 1, mimeType: 'image/jpeg' }
}

for (const aspect of [1, 1.5, 0.75]) {
  for (const gapPx of [6, 12]) {
    const marginPx = gapPx / 2
    const photos = Array.from({ length: 24 }, (_, i) => photo(i))
    const groups = [photos.slice(0, 6), photos.slice(6, 9), photos.slice(9, 12), photos.slice(12, 16), photos.slice(16, 20), photos.slice(20, 24)]
    const appearance = { backgroundColor: '#fff', gapPx, marginPx, borderWidth: 0, borderColor: '#fff' }
    const spreads = buildSpreadsFromGroups(groups, appearance, null, { ...{ aspect, frameFilter: 'all', includeFullSpreadTemplates: true, start: 'spread', end: 'spread' }, matchTimelineOrder: true })
    spreads.forEach((spread, s) => {
      const template = findTemplate(spread.templateId)
      assert.ok(runsToTheTrim(template) || templateCategory(template) !== 'reference' || supportsUniformGap(template.placeholders, aspect, marginPx, gapPx),
        `aspect ${aspect} gap ${gapPx}: spread ${s + 1} (${spread.templateId}) leaves the album's gap between frames`)
      const boxes = computePlaceholderBoxes(spread, 900, 900 / aspect)
      for (const placement of spread.placements) {
        const box = boxes.find(b => b.placeholderId === placement.placeholderId)
        const asset = photos.find(p => p.id === placement.photoId)
        assert.ok(orientationFits(asset, box),
          `aspect ${aspect} gap ${gapPx}: spread ${s + 1} puts ${asset.width}x${asset.height} in a ${Math.round(box.width)}x${Math.round(box.height)} frame (${spread.templateId})`)
      }
    })
  }
}
// The cap: no spread holds more than 24, however many photographs or however high a range is asked for.
assert.equal(MAX_PHOTOS_PER_SPREAD, 24)
assert.equal(spreadCountRange(60, 1, 99).min, 3)
const many = Array.from({ length: 60 }, (_, i) => photo(i))
const options = { gapMinutes: 1e9, maxPhotosPerSpread: 99 }
assert.ok(groupPhotosForCount(many, 1, options, 1, 99).every(g => g.length <= 24), 'groups never exceed 24')
assert.ok(groupPhotosForCount(many, 3, options, 1, 99).every(g => g.length <= 24))
console.log('Auto Build fit checks passed: every photograph gets a frame of its own shape and built-in layouts keep the album gap, on three album shapes and two gaps.')
