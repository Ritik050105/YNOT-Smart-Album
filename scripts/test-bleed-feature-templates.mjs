import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({
  stdin: {
    contents: `export {BLEED_FEATURE_TEMPLATES,isBleedFeatureTemplate} from './src/engine/bleedFeatureTemplates'
export {templatesForCount,runsToTheTrim,hasPhotoShapedFrames,hasSeparateFrames,uniqueTemplates} from './src/engine/templates'
export {resolveTemplateFrames,supportsUniformGap} from './src/engine/templateLayout'
export {templateCategory} from './src/engine/templateTransfer'`,
    resolveDir: process.cwd(),
  },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const {
  BLEED_FEATURE_TEMPLATES: family, isBleedFeatureTemplate, templatesForCount, runsToTheTrim,
  hasPhotoShapedFrames, hasSeparateFrames, uniqueTemplates, resolveTemplateFrames, supportsUniformGap, templateCategory,
} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)

// A square album: its `size` is the whole open spread, so the template's 0-1 box is a square.
const ASPECT = 1, MARGIN = 10, GAP = 10

assert.ok(family.length >= 50, `the family is worth having (${family.length})`)

for (const t of family) {
  assert.ok(isBleedFeatureTemplate(t.id), `${t.id} is recognised by its own predicate`)
  assert.equal(t.placeholders.length, t.photoCount, `${t.id} photoCount matches its frames`)
  assert.equal(new Set(t.placeholders.map(p => p.id)).size, t.photoCount, `${t.id} frame ids are unique`)
  assert.ok(hasSeparateFrames(t), `${t.id} never stacks one photo on another`)
  assert.ok(hasPhotoShapedFrames(t, ASPECT), `${t.id} has no band-shaped frame`)

  const bleeding = t.placeholders.filter(p => p.bleed)
  assert.ok(bleeding.length >= 1 && bleeding.length <= 2, `${t.id} features one photograph, or a pair of bookends`)
  assert.ok(t.placeholders.some(p => !p.bleed), `${t.id} keeps inset photographs beside the feature`)

  // This is the whole promise of the family: the feature touches the trim, the rest stay inside the
  // album margin, and the seam between any two inset frames is the album's own gap.
  const resolved = resolveTemplateFrames(t.placeholders, ASPECT, MARGIN, GAP)
  const width = 900, height = width / ASPECT
  const px = p => ({ left: p.x * width, top: p.y * height, right: (p.x + p.width) * width, bottom: (p.y + p.height) * height })
  for (const [i, p] of resolved.entries()) {
    const b = px(p)
    const onTrim = b.left < 0.5 || b.top < 0.5 || b.right > width - 0.5 || b.bottom > height - 0.5
    if (t.placeholders[i].bleed) assert.ok(onTrim, `${t.id}: ${p.id} is the feature and must reach the trim`)
    else {
      assert.ok(!onTrim, `${t.id}: ${p.id} is inset and must stay inside the margin`)
      assert.ok(b.left >= MARGIN - 0.5 && b.top >= MARGIN - 0.5 && b.right <= width - MARGIN + 0.5 && b.bottom <= height - MARGIN + 0.5,
        `${t.id}: ${p.id} sits inside the album margin`)
    }
  }
}

// Raising the album's gap must move the inset photographs and leave the feature where it is: that
// is the difference between this family and the full-bleed one, and the reason it was authored.
const sample = family.find(t => t.id === 'ref-bleed-panel-left-6')
assert.ok(sample, 'ref-bleed-panel-left-6 exists')
const tight = resolveTemplateFrames(sample.placeholders, ASPECT, MARGIN, 0)
const airy = resolveTemplateFrames(sample.placeholders, ASPECT, MARGIN, 40)
assert.equal(tight[0].x, 0, 'the feature starts on the trim at any gap')
assert.equal(airy[0].x, 0, 'the feature starts on the trim at any gap')
assert.ok(airy[0].width < tight[0].width, 'the feature gives up its interior edge to the gap, not its outer ones')
assert.ok(airy[2].width < tight[2].width, 'the inset photographs shrink as the gap grows')

// The browsers gate built-in layouts on a uniform gap, which a bleeding feature can never satisfy.
// Without the exemption the entire family is invisible, which is exactly what shipped once.
for (const t of family) assert.ok(runsToTheTrim(t), `${t.id} is exempted from the uniform-gap check`)
assert.ok(family.filter(t => !supportsUniformGap(t.placeholders, ASPECT, MARGIN, GAP)).length > family.length / 2,
  'most of the family genuinely needs that exemption — otherwise this is testing nothing')

// And they survive into the per-count browser, in front of the generated grids.
for (let count = 3; count <= 11; count++) {
  const offered = uniqueTemplates(templatesForCount(count, null, 'all', ASPECT))
    .filter(t => templateCategory(t) !== 'reference' || runsToTheTrim(t) || supportsUniformGap(t.placeholders, ASPECT, MARGIN, GAP))
  const bleeding = offered.filter(t => isBleedFeatureTemplate(t.id))
  assert.ok(bleeding.length >= 3, `count ${count} offers the family in the browser (got ${bleeding.length})`)
}

console.log(`Bleed-feature checks passed: ${family.length} layouts, feature on the trim, the rest inside the margin and moving with the gap.`)
