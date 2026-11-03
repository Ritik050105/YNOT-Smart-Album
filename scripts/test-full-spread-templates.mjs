// New built-in full-spread templates (one side full-bleed, the other side photos/caption) survive
// dedup, carry the right photoCount/textBoxes, and classify as 'generated' so they are visible in
// the mixed-templates browser without the Smart Design ("reference") checkbox.
import assert from 'node:assert/strict'
import { build } from 'esbuild'
const result = await build({
  stdin: { contents: `export {BUILT_IN_TEMPLATES} from './src/engine/templates';export {templateCategory} from './src/engine/templateTransfer'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const { BUILT_IN_TEMPLATES, templateCategory } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const ids = ['gen-mixed-full-left-caption', 'gen-mixed-full-right-caption', 'gen-mixed-full-left-overlay', 'gen-mixed-full-right-overlay', 'gen-full-left-triple', 'gen-full-right-triple']
for (const id of ids) {
  const t = BUILT_IN_TEMPLATES.find(t => t.id === id)
  assert.ok(t, `${id} survives dedup`)
  assert.equal(templateCategory(t), 'generated', `${id} classifies as generated`)
  assert.equal(t.placeholders.length, t.photoCount, `${id} photoCount matches placeholder count`)
  const mixed = id.includes('mixed')
  assert.equal(!!t.textBoxes?.length, mixed, `${id} textBoxes presence matches its name`)
}
console.log('Full-spread template checks passed: all six survive dedup, classify as generated, and have consistent geometry/text.')
