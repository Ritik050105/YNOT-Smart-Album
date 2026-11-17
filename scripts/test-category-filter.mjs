// "Smart design" and "Creative design" are the two boxes above the template browser, and they decide what Next / Previous template step
// through. Every layout the app ships with is Smart design; Creative design is only what a designer saved or imported. So with only Smart
// design ticked the button works exactly as with both ticked, and with only Creative ticked (and nothing saved) there is nothing to step to.
// (The page layouts used to be filed as creative, which left Smart design with two layouts for a pair of photographs and none for six.)
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: {
    contents: `export {cyclingTemplates,cyclingCount,useTemplateBrowsing} from './src/state/templateBrowsing'
export {createBlankSpread,defaultPlacement} from './src/engine/autoLayout'
export {templateCategory} from './src/engine/templateTransfer'`,
    resolveDir: process.cwd(),
  },
  bundle: true, loader: { '.bin': 'dataurl', '.ttf': 'dataurl', '.png': 'dataurl', '.icc': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const m = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const shapes = [[900, 600], [600, 900], [700, 700], [1200, 800], [800, 1200], [900, 600]]
const make = n => {
  const photos = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, src: '', width: shapes[i % 6][0], height: shapes[i % 6][1], name: 'p' + i, bins: [], capturedAt: new Date().toISOString() }))
  const spread = { ...m.createBlankSpread(0, { backgroundColor: '#fff', marginPx: 3, gapPx: 6, borderWidth: 0, borderColor: '#fff' }), id: 's' + n, placements: photos.map((p, i) => m.defaultPlacement('f' + i, p.id)) }
  return { project: { size: { widthIn: 12, heightIn: 12 }, enabledTemplateIds: null, photos, spreads: [spread] }, spread }
}
const none = []
const boxes = (reference, creative) => m.useTemplateBrowsing.getState().setCategories({ reference, creative })

for (const n of [1, 2, 3, 4, 5, 6]) {
  const { project, spread } = make(n)
  boxes(true, true)
  const both = m.cyclingTemplates(project, spread, 'all', none)
  assert.ok(both.length >= 2, `${n} photo(s): there is something to step through`)
  for (const t of both) assert.equal(m.templateCategory(t), 'reference', `${n} photo(s): ${t.id} is a Smart design`)

  boxes(true, false)
  const smart = m.cyclingTemplates(project, spread, 'all', none)
  assert.equal(smart.length, both.length, `${n} photo(s): with only Smart design ticked Next template has every layout (${smart.length} of ${both.length})`)
  assert.ok(m.cyclingCount(project, spread, 'all', none) >= 2, `${n} photo(s): the button stays enabled`)

  boxes(false, true)
  assert.equal(m.cyclingTemplates(project, spread, 'all', none).length, 0, `${n} photo(s): nothing built in is a Creative design`)

  boxes(false, false)
  assert.equal(m.cyclingTemplates(project, spread, 'all', none).length, 0, `${n} photo(s): both boxes off offers nothing`)
}

boxes(true, true)
console.log('Category filter checks passed: every built-in layout is Smart design, Next template works with only Smart design ticked, nothing built in is Creative.')
