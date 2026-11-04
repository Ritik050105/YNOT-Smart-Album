// Built-in full-spread templates (one side full-bleed, the other side photos/caption) survive dedup
// and land in the right browser: the mixed ones classify as 'generated' so the mixed browser shows
// them with no checkbox to tick, while the image-only ones classify as 'reference' so they appear
// under "Smart design", which is on by default (categories.generated starts false). Imported designs
// are offered at any photo count, not only the one they were drawn for.
import assert from 'node:assert/strict'
import { build } from 'esbuild'
const result = await build({
  stdin: { contents: `export {BUILT_IN_TEMPLATES,importedDesignTemplates,setUserTemplateRegistry,templatesForCount} from './src/engine/templates';export {templateCategory} from './src/engine/templateTransfer';export {isFullSpreadTemplate} from './src/engine/templates';export {cyclingTemplates} from './src/state/templateBrowsing'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const { BUILT_IN_TEMPLATES, importedDesignTemplates, setUserTemplateRegistry, templatesForCount, templateCategory, isFullSpreadTemplate, cyclingTemplates } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const byId = id => BUILT_IN_TEMPLATES.find(t => t.id === id)

// The generated family. It now runs edge to edge, which makes its 1-3 photo members identical to
// the six hand-written layouts it grew out of, so dedup keeps the generated ones (they are first
// in the library) and drops the originals. The old ids stay resolvable through findTemplate, so
// albums that already reference one keep their geometry.
const mixedIds = [
  'gen-mixed-full-left-caption-1', 'gen-mixed-full-right-caption-1',
  'gen-mixed-full-left-overlay-1', 'gen-mixed-full-right-overlay-1',
  'gen-mixed-full-left-caption-3', 'gen-mixed-full-right-overlay-3',
  'gen-mixed-band-top-2', 'gen-mixed-band-bottom-6',
]
const imageIds = ['gen-full-left-3', 'gen-full-right-3', 'gen-full-left-2', 'gen-full-right-4',
  'gen-full-left-cascade-3', 'gen-full-right-cascade-3', 'gen-full-left-hero-4']
for (const id of [...mixedIds, ...imageIds]) {
  const t = byId(id)
  assert.ok(t, `${id} survives dedup`)
  assert.equal(t.placeholders.length, t.photoCount, `${id} photoCount matches placeholder count`)
  assert.equal(!!t.textBoxes?.length, mixedIds.includes(id), `${id} carries text only if it is a mixed template`)
  for (const p of t.placeholders) assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.width <= 1.0001 && p.y + p.height <= 1.0001, `${id} keeps ${p.id} inside the spread`)
  for (const b of t.textBoxes ?? []) assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= 1.0001 && b.y + b.height <= 1.0001, `${id} keeps its caption inside the spread`)
}
for (const id of mixedIds) assert.equal(templateCategory(byId(id)), 'generated', `${id} classifies as generated`)
// "Smart design" is the reference category. It normally also requires that the album's own gap can
// be applied uniformly across the layout, which a full-bleed page can never satisfy — one page runs
// to the edge by design — so the browsers exempt this family by id instead of dropping it.
for (const id of imageIds) {
  assert.equal(templateCategory(byId(id)), 'reference', `${id} classifies as reference (Smart design)`)
  assert.ok(isFullSpreadTemplate(byId(id)), `${id} is exempt from the uniform-gap check`)
}

// The cascade family: one page full-bleed, the facing photos on a common baseline, each a step
// shorter as it moves away from that page. Both pages then read as one descending run.
for (const side of ['left', 'right']) {
  const t = byId(`gen-full-${side}-cascade-3`)
  const [page, ...row] = t.placeholders
  assert.deepEqual([page.x, page.y, page.width, page.height], [side === 'left' ? 0 : 0.5, 0, 0.5, 1], `${side} cascade keeps one page full-bleed`)
  const baseline = row.map(p => +(p.y + p.height).toFixed(4))
  assert.equal(new Set(baseline).size, 1, `${side} cascade sits the facing photos on one baseline`)
  const heights = row.map(p => p.height)
  const stepping = side === 'left' ? heights : [...heights].reverse()
  for (let i = 1; i < stepping.length; i++) assert.ok(stepping[i] < stepping[i - 1], `${side} cascade steps down away from the full page`)
}

// No white border anywhere: the facing page's photos reach the gutter, the outer edge, the top and
// the bottom, and they meet each other with no gutter between them. A cascade is the one exception
// — its steps are meant to leave the top corner open — so it only has to reach three edges.
for (const side of ['left', 'right']) {
  for (const n of [2, 3, 5, 9]) {
    for (const kind of ['', 'hero-']) {
      const t = byId(`gen-full-${side}-${kind}${n}`)
      if (!t) continue
      const facing = t.placeholders.filter(p => (side === 'left' ? p.x >= 0.5 - 1e-6 : p.x + p.width <= 0.5 + 1e-6))
      assert.ok(facing.length, `${t.id} puts photos on the facing page`)
      const near = (a, b) => Math.abs(a - b) < 1e-6
      assert.ok(facing.some(p => near(p.y, 0)), `${t.id} reaches the top of the facing page`)
      assert.ok(facing.some(p => near(p.y + p.height, 1)), `${t.id} reaches the bottom of the facing page`)
      assert.ok(facing.some(p => near(p.x, side === 'left' ? 0.5 : 0)), `${t.id} reaches the gutter`)
      assert.ok(facing.some(p => near(p.x + p.width, side === 'left' ? 1 : 0.5)), `${t.id} reaches the outer edge`)
      const area = facing.reduce((sum, p) => sum + p.width * p.height, 0)
      assert.ok(near(area, 0.5), `${t.id} tiles the facing page with no gaps (covered ${area})`)
    }
  }
  const cascade = byId(`gen-full-${side}-cascade-4`)
  assert.ok(cascade.placeholders.slice(1).every(p => Math.abs(p.y + p.height - 1) < 1e-6), `${cascade.id} sits flush on the bottom edge`)
}

// Every album photo count has somewhere to go: 30+ image layouts, a mixed layout, and a full-bleed
// variant of each. This is the promise the template browser makes at any spread size.
for (let n = 1; n <= 30; n++) {
  const all = templatesForCount(n, null, 'all', 2)
  const image = all.filter(t => !t.textBoxes?.length), mixed = all.filter(t => t.textBoxes?.length)
  assert.ok(image.length >= 30, `count ${n} offers 30+ image templates (got ${image.length})`)
  assert.ok(mixed.length >= 1, `count ${n} offers a mixed template (got ${mixed.length})`)
  if (n === 1) continue
  const full = BUILT_IN_TEMPLATES.filter(t => t.photoCount === n && isFullSpreadTemplate(t))
  assert.ok(full.some(t => !t.textBoxes?.length), `count ${n} offers a full-bleed image template`)
  assert.ok(full.some(t => t.textBoxes?.length), `count ${n} offers a full-bleed mixed template`)
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
