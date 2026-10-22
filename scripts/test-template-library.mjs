import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
const bundle = await build({ stdin: { contents: `export * from './src/engine/templates';export {GENERATED_TEMPLATES} from './src/engine/templateGenerator';export * from './src/engine/templateLayout';export * from './src/engine/templateMatching'`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false })
const { BUILT_IN_TEMPLATES: templates, geometrySignature, findTemplate, rankTemplates, GENERATED_TEMPLATES, uniqueTemplates } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const templateSource = readFileSync('src/engine/templates.ts', 'utf8')
const handNames = templateSource.match(/const HAND_CRAFTED_TEMPLATES[^=]*= \[([\s\S]*?)\]/)[1].split(',').map(s=>s.trim()).filter(Boolean)
const handIds = handNames.map(name=>templateSource.match(new RegExp('const '+name+"[^=]*= \\{\\s*id: '([^']+)'"))[1])
const legacy = [...handIds.map(findTemplate), ...GENERATED_TEMPLATES]
console.log('Legacy geometry:', legacy.length, createHash('sha256').update(JSON.stringify(legacy.map(t => [t.id, t.placeholders]))).digest('hex'))
assert.equal(legacy.length, 1744)
assert.equal(createHash('sha256').update(JSON.stringify(legacy.map(t => [t.id, t.placeholders]))).digest('hex'), 'adb468255cbbd34b4321428def71754e86e3cc3e5c277fbb6b66bb9614a6a2ff', 'Saved album geometry must stay unchanged')
for (const t of legacy) assert.deepEqual(findTemplate(t.id),t,'Saved layouts still resolve')
assert.equal(uniqueTemplates(templates).length,templates.length,'Only unique compositions are browsable')
assert.equal(new Set(templates.map(t => t.id)).size, templates.length)
for (let count = 1; count <= 30; count++) {
  const candidates = templates.filter(t => t.photoCount === count && t.id !== 'cover-front-spine-back')
  assert.ok(candidates.length > 0, `${count} photos`)
  if (count > 1) assert.ok(candidates.some(t => t.id.startsWith('ref-paired-') && Math.abs(t.placeholders.filter(p=>p.x+p.width<=0.5).length-count/2)<=0.5), `Balanced paired pages for ${count} photos`)
  const newSignatures = new Set()
  for (const t of candidates) {
    assert.equal(t.placeholders.length, count)
    assert.equal(new Set(t.placeholders.map(p => p.id)).size, count)
    assert.equal(findTemplate(t.id), t)
    for (const p of t.placeholders) {
      assert.ok([p.x, p.y, p.width, p.height].every(Number.isFinite), t.id)
      assert.ok(p.width > 0 && p.height > 0 && p.x >= -1e-6 && p.y >= -1e-6 && p.x + p.width <= 1.000001 && p.y + p.height <= 1.000001, t.id)
    }
    if (!t.id.startsWith('ref-') && !t.id.startsWith('editorial-')) continue
    const signature = geometrySignature(t.placeholders)
    assert.ok(!newSignatures.has(signature), `Duplicate ${t.id}`)
    assert.ok(!legacy.some(old => old.photoCount === count && geometrySignature(old.placeholders) === signature), `Duplicate legacy ${t.id}`)
    newSignatures.add(signature)
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
      const a = t.placeholders[i], b = t.placeholders[j]
      assert.ok(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x) <= 1e-6 || Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y) <= 1e-6, `Overlapping frames ${t.id}`)
    }
  }
  const photos = Array.from({length: count}, (_, i) => ({ id: String(i), width: [600,900,700,1200][i%4], height: [900,600,700,400][i%4] }))
  for (const aspect of [0.75,1.5,3]) {
    const ranked = rankTemplates(photos, candidates, aspect, false)
    assert.equal(ranked.length, candidates.length)
    assert.ok(ranked.every(r => Number.isFinite(r.score)))
    assert.equal(new Set(ranked[0].photos.map(p => p.id)).size, count)
  }
}
console.log('Template checks passed: Unique layouts for all 30 photo counts, stable legacy frames, finite bounds, no new duplicates/overlaps, mixed-photo matching at three aspect ratios.')

