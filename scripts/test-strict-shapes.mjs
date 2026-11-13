// Template choice never puts a photograph in a frame of the opposite shape: a landscape photo only
// gets landscape or square frames, a portrait photo only portrait or square frames, and a square photo
// only square frames. This is what the next/previous buttons and the template browser offer; a frame
// that is wrong for a photograph is changed by hand in Designer View, never picked by the app.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: {
    contents: `export {templatesForCount,sequenceCandidates,uniqueTemplates} from './src/engine/templates'
export {offeredLayouts} from './src/engine/layoutOffer'
export {templateOrderMismatches,templateShapeMismatches,templateFramesInReadingOrder} from './src/engine/templateMatching'
export {resolveTemplateFrames,supportsUniformGap} from './src/engine/templateLayout'
export {shapeOf} from './src/engine/layoutMath'
export {templateCategory} from './src/engine/templateTransfer'`,
    resolveDir: process.cwd(),
  },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const { templatesForCount, sequenceCandidates, uniqueTemplates, offeredLayouts, templateOrderMismatches, templateShapeMismatches, templateFramesInReadingOrder, resolveTemplateFrames, supportsUniformGap, shapeOf, templateCategory } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const dims = { L: [1500, 1000], U: [1000, 1500], S: [1000, 1000] }
const photos = word => [...word].map((c, i) => ({ id: c + i, width: dims[c][0], height: dims[c][1] }))
const MARGIN = 3, GAP = 6
// A square photograph also takes a frame up to a quarter off square; nothing takes the opposite shape.
const fits = (photo, frame) => frame.shape === 'square' || photo === frame.shape || (photo === 'square' && frame.ratio >= 0.8 && frame.ratio <= 1.25)
const name = { L: 'landscape', U: 'portrait', S: 'square' }

let checked = 0
for (const aspect of [1.5, 1, 12.007 / 17.717]) {
  for (const word of ['L', 'U', 'S', 'LL', 'UU', 'SS', 'LU', 'LS', 'US', 'LLL', 'UUU', 'SSS', 'LUL', 'SUS', 'LSU', 'LLUU', 'LSLS', 'UUUUU', 'LLLLLL', 'SSSSSS', 'LUSLUS']) {
    const set = photos(word), count = set.length
    const candidates = uniqueTemplates([...sequenceCandidates(set, count, null, 'all', aspect), ...templatesForCount(count, null, 'all', aspect)])
      .filter(t => !t.textBoxes?.length)
      .filter(t => templateCategory(t) !== 'reference' || supportsUniformGap(t.placeholders, aspect, MARGIN, GAP))
    for (const keepOrder of [false, true]) {
      const offered = offeredLayouts(set, candidates, aspect, MARGIN, GAP, keepOrder, true)
      for (const t of offered.filter(t => t.placeholders.length === count)) {
        const frames = resolveTemplateFrames(t.placeholders, aspect, MARGIN, GAP).map(f => ({ shape: shapeOf(f.width * aspect, f.height), ratio: f.width * aspect / f.height }))
        if (keepOrder) {
          // Each photograph against the frame it would really get, in the matcher's reading order.
          templateFramesInReadingOrder(t).forEach((frame, k) => {
            const shape = frames[t.placeholders.indexOf(frame)]
            assert.ok(fits(name[word[k]], shape), `${t.id} (${word}, keep order, aspect ${aspect}): photo ${k} is ${name[word[k]]} but its frame is ${shape.shape} (${shape.ratio.toFixed(2)})`)
          })
          assert.equal(templateOrderMismatches(set, t, aspect, MARGIN, GAP), 0)
        } else {
          // Free to rearrange: some assignment must give nobody a frame of the opposite shape. Checked by
          // search over the (few) photographs rather than by the counting rule the app uses.
          const usable = (photo, frame) => fits(photo, frame)
          const assign = (i, taken) => i === word.length || frames.some((f, j) => !taken.has(j) && usable(name[word[i]], f) && assign(i + 1, new Set([...taken, j])))
          assert.ok(assign(0, new Set()), `${t.id} (${word}, aspect ${aspect}): no assignment avoids the opposite shape`)
          assert.equal(templateShapeMismatches(set, t, aspect, MARGIN, GAP), 0)
        }
        checked++
      }
    }
  }
}
assert.ok(checked > 500, `many layouts were checked (${checked})`)
console.log(`Strict shape checks passed: ${checked} layouts, none gives a photograph a frame of the opposite shape (landscape: landscape or square; portrait: portrait or square; square: square).`)
