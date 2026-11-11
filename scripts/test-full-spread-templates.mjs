// Built-in full-spread templates (one side full-bleed, the other side photos/caption) survive dedup
// and land in the right browser: the mixed ones classify as 'reference' so the mixed browser shows
// them with no checkbox to tick, while the image-only ones classify as 'reference' so they appear
// under "Smart design", which is on by default (categories.generated starts false). Imported designs
// are offered at any photo count, not only the one they were drawn for.
import assert from 'node:assert/strict'
import { build } from 'esbuild'
const result = await build({
  stdin: { contents: `export {builtInTemplates,findTemplate,importedDesignTemplates,setUserTemplateRegistry,templatesForCount} from './src/engine/templates';export {templateCategory} from './src/engine/templateTransfer';export {isFullSpreadTemplate} from './src/engine/templates';export {cyclingTemplates} from './src/state/templateBrowsing';export {resolveTemplateFrames} from './src/engine/templateLayout'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const { builtInTemplates, findTemplate, importedDesignTemplates, setUserTemplateRegistry, templatesForCount, templateCategory, isFullSpreadTemplate, cyclingTemplates, resolveTemplateFrames } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const byId = id => builtInTemplates().find(t => t.id === id)

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
const imageIds = ['gen-full-right-4',
  'gen-full-left-cascade-3', 'gen-full-right-cascade-3', 'gen-full-left-hero-4']
// Three of this family now lose the dedup pass to an edge-to-edge layout of the same arrangement,
// which is the same design drawn flush to the trim. Saved albums still resolve them by id; they
// are simply no longer the copy shown in the browser.
for (const [id, replacement] of [['gen-full-left-3', 'ref-edge-hero-trio'], ['gen-full-right-3', 'ref-edge-hero-trio-mirror'], ['gen-full-left-2', 'ref-edge-hero-pair']]) {
  assert.ok(findTemplate(id), `${id} still resolves for saved albums`)
  assert.ok(byId(replacement), `${replacement} stands in for ${id}`)
}
for (const id of [...mixedIds, ...imageIds]) {
  const t = byId(id)
  assert.ok(t, `${id} survives dedup`)
  assert.equal(t.placeholders.length, t.photoCount, `${id} photoCount matches placeholder count`)
  assert.equal(!!t.textBoxes?.length, mixedIds.includes(id), `${id} carries text only if it is a mixed template`)
  for (const p of t.placeholders) assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.width <= 1.0001 && p.y + p.height <= 1.0001, `${id} keeps ${p.id} inside the spread`)
  for (const b of t.textBoxes ?? []) assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= 1.0001 && b.y + b.height <= 1.0001, `${id} keeps its caption inside the spread`)
}
for (const id of mixedIds) assert.equal(templateCategory(byId(id)), 'reference', `${id} classifies as a built-in Smart design`)
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

// The album's own margin and image gap must not put a white border back round this family: its
// frames are authored full-bleed, so they resolve to exactly the geometry they were drawn with,
// whatever margin and gap the album carries. Every one of them still reaches all four page edges,
// and the ones meant to tile still cover the spread exactly. The two that do not tile are
// deliberate: a cascade leaves the step above each shorter photo open, and a caption variant gives
// the facing page's lower band over to the text.
for (const [margin, gap] of [[0, 0], [24, 12], [60, 40]]) {
  for (const n of [2, 4, 9, 20, 30]) {
    for (const t of templatesForCount(n, null, 'all', 1.5).filter(isFullSpreadTemplate)) {
      const frames = resolveTemplateFrames(t.placeholders, 1.5, margin, gap)
      const at = (margin ? ` at margin ${margin}/gap ${gap}` : '')
      assert.ok(Math.min(...frames.map(p => p.x)) < 1e-6, `${t.id} reaches the left page edge${at}`)
      assert.ok(Math.min(...frames.map(p => p.y)) < 1e-6, `${t.id} reaches the top edge${at}`)
      assert.ok(Math.max(...frames.map(p => p.x + p.width)) > 1 - 1e-6, `${t.id} reaches the right page edge${at}`)
      assert.ok(Math.max(...frames.map(p => p.y + p.height)) > 1 - 1e-6, `${t.id} reaches the bottom edge${at}`)
      if (/-cascade|-caption-/.test(t.id)) continue
      const area = frames.reduce((sum, p) => sum + p.width * p.height, 0)
      // With no gap the frames tile the sheet exactly. A gap is space the designer asked for
      // BETWEEN photographs, so it comes out of the frames — including the full-bleed page, which
      // used to ignore it and butt straight against its neighbours. How much depends on the gap
      // and on how many seams the layout has, so this is measured against the same layout at
      // gap 0 rather than against a fixed number.
      const tiled = resolveTemplateFrames(t.placeholders, 1.5, margin, 0)
        .reduce((sum, p) => sum + p.width * p.height, 0)
      assert.ok(Math.abs(tiled - 1) < 1e-6, `${t.id} tiles the whole spread with no gap (covered ${tiled})`)
      assert.ok(area <= tiled + 1e-6, `${t.id} gives up area to the gap${at} (covered ${area})`)
      if (gap) assert.ok(area < tiled - 1e-6, `${t.id} actually opens a gap${at} (covered ${area})`)
    }
  }
}

// A full-bleed page always has companions to choose from, and the page facing it is made of
// photo-shaped frames — never the row of letterbox bands a flush grid produces at these counts.
// There is no fixed number of them: how many survive depends on the album's own proportions,
// since the same grid is tidy squares on one shape and bands on another.
for (let n = 4; n <= 30; n++) {
  const full = templatesForCount(n, null, 'all', 1.5).filter(t => !t.textBoxes?.length && isFullSpreadTemplate(t))
  assert.ok(full.length >= 4, `count ${n} offers full-spread image templates (got ${full.length})`)
  for (const t of full) for (const ph of t.placeholders) {
    const ratio = ph.width / ph.height * 1.5
    assert.ok(ratio <= 3.2 && ratio >= 1 / 3.2,
      `count ${n}: ${t.id} has a band-shaped frame (${ratio.toFixed(2)}:1)`)
  }
  for (const t of full) assert.equal(templateCategory(t), 'reference', `${t.id} is in Smart design`)
}

// Trimming must not thin Smart design itself: every count still offers a shelf of genuinely
// different arrangements. The floor was 200, then 120 once band-shaped frames were dropped, and is
// 20 now that dedup collapses layouts differing only in their proportions — a shelf of tiles that
// look the same at different sizes was the complaint, so the drop is the point, not a regression.
for (const n of [3, 8, 20, 30]) {
  const smart = templatesForCount(n, null, 'all', 1.5).filter(t => !t.textBoxes?.length && templateCategory(t) === 'reference')
  assert.ok(smart.length > 20, `count ${n} keeps its Smart design catalogue (got ${smart.length})`)
}

// Every album photo count has somewhere to go: ten-plus image layouts, a mixed layout, and a
// full-bleed variant of each. This is the promise the template browser makes at any spread size.
// It was 30+ until dedup started collapsing layouts that differ only in their proportions; one
// photograph does not have thirty genuinely different arrangements, and pretending otherwise is
// what filled the browser with tiles that looked identical.
for (let n = 1; n <= 30; n++) {
  const all = templatesForCount(n, null, 'all', 2)
  const image = all.filter(t => !t.textBoxes?.length), mixed = all.filter(t => t.textBoxes?.length)
  assert.ok(image.length >= 10, `count ${n} offers 10+ image templates (got ${image.length})`)
  assert.ok(mixed.length >= 1, `count ${n} offers a mixed template (got ${mixed.length})`)
  if (n === 1) continue
  const full = builtInTemplates().filter(t => t.photoCount === n && isFullSpreadTemplate(t))
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
