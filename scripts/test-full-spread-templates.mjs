// Built-in full-spread templates (one side full-bleed, the other side photos/caption) survive dedup
// and land in the right browser: the mixed ones classify as 'generated' so the mixed browser shows
// them with no checkbox to tick, while the image-only ones classify as 'reference' so they appear
// under "Smart design", which is on by default (categories.generated starts false). Imported designs
// are offered at any photo count, not only the one they were drawn for.
import assert from 'node:assert/strict'
import { build } from 'esbuild'
const result = await build({
  stdin: { contents: `export {BUILT_IN_TEMPLATES,importedDesignTemplates,setUserTemplateRegistry} from './src/engine/templates';export {templateCategory} from './src/engine/templateTransfer';export {supportsUniformGap} from './src/engine/templateLayout';export {cyclingTemplates} from './src/state/templateBrowsing'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const { BUILT_IN_TEMPLATES, importedDesignTemplates, setUserTemplateRegistry, templateCategory, supportsUniformGap, cyclingTemplates } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const byId = id => BUILT_IN_TEMPLATES.find(t => t.id === id)

// The original hand-written six, plus the families generated from them.
const mixedIds = [
  'gen-mixed-full-left-caption', 'gen-mixed-full-right-caption',
  'gen-mixed-full-left-overlay', 'gen-mixed-full-right-overlay',
  'gen-mixed-full-left-caption-3', 'gen-mixed-full-right-overlay-3',
  'gen-mixed-band-top-2', 'gen-mixed-band-bottom-6',
]
// The 1- and 2-photo full-bleed variants are dropped by the dedup pass: those layouts already exist
// in the library under their original names, and the older entry deliberately wins.
const imageIds = ['gen-full-left-triple', 'gen-full-right-triple', 'gen-full-left-4', 'gen-full-right-4']
for (const id of [...mixedIds, ...imageIds]) {
  const t = byId(id)
  assert.ok(t, `${id} survives dedup`)
  assert.equal(t.placeholders.length, t.photoCount, `${id} photoCount matches placeholder count`)
  assert.equal(!!t.textBoxes?.length, mixedIds.includes(id), `${id} carries text only if it is a mixed template`)
  for (const p of t.placeholders) assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.width <= 1.0001 && p.y + p.height <= 1.0001, `${id} keeps ${p.id} inside the spread`)
  for (const b of t.textBoxes ?? []) assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= 1.0001 && b.y + b.height <= 1.0001, `${id} keeps its caption inside the spread`)
}
for (const id of mixedIds) assert.equal(templateCategory(byId(id)), 'generated', `${id} classifies as generated`)
// "Smart design" is the reference category, and it additionally requires that the album's own gap
// can be applied uniformly across the layout — otherwise the browser filters the template back out.
for (const id of imageIds) {
  assert.equal(templateCategory(byId(id)), 'reference', `${id} classifies as reference (Smart design)`)
  assert.ok(supportsUniformGap(byId(id).placeholders, 2, 10, 6), `${id} survives the Smart design uniform-gap check`)
}

// A spread with 2 photos and no prior "Random generation" toggle still cycles through the new
// generated mixed templates (default useTemplateBrowsing categories: {reference:true,creative:true,generated:false}).
const project = { enabledTemplateIds: null, photos: [], size: { widthIn: 12, heightIn: 12 } }
const spread = { id: 's1', isCover: false, pageSide: 'spread', templateId: 'two-vertical', placements: [
  { placeholderId: 'p1', photoId: 'a' }, { placeholderId: 'p2', photoId: 'b' },
], marginPx: 10, gapPx: 6 }
const mixedCandidates = cyclingTemplates(project, spread, 'all', [], 'mixed')
assert.ok(mixedCandidates.some(t => t.id === 'gen-mixed-full-left-caption' || t.id === 'gen-mixed-full-right-caption'), 'generated mixed templates are cyclable by default, no checkbox toggle needed')
assert.ok(mixedCandidates.every(t => t.textBoxes?.length), 'the mixed browser never offers a template without text')

// An imported PSD design keeps its own frame count. It must still be offered on a spread holding
// fewer photos (extra frames come up empty), and must not be offered where applying it would mean
// dropping photos, which retemplateSpread refuses to do anyway.
const imported = count => ({ id: `psd-${count}`, name: `psd-${count}`, photoCount: count, pageSide: 'spread', isBuiltIn: false,
  absoluteFrames: true, createdAt: new Date(0).toISOString(), thumbnailColor: '#fff', textBoxes: [{ text: 'Hi' }],
  placeholders: Array.from({ length: count }, (_, i) => ({ id: `f${i}`, x: 0, y: i / count, width: 1, height: 1 / count, preferredOrientation: 'any' })) })
setUserTemplateRegistry([imported(1), imported(2), imported(5)])
assert.deepEqual(importedDesignTemplates(2).map(t => t.id), ['psd-5'], 'only designs with more frames than the spread has photos are added')
assert.ok(cyclingTemplates(project, spread, 'all', [], 'mixed').some(t => t.id === 'psd-5'), 'an imported mixed design shows in the mixed browser at a different photo count')
setUserTemplateRegistry([])

console.log('Full-spread template checks passed: every family survives dedup, classifies into the right browser, keeps its geometry inside the spread, and imported designs show at any photo count.')
