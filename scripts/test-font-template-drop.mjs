// Dropping a font template adds one group centred on the drop point and kept on the page.
import assert from 'node:assert/strict'
import { build } from 'esbuild'
const saved = new Map()
globalThis.localStorage = { getItem: k => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) }
globalThis.window ??= { dispatchEvent: () => true, addEventListener() {}, removeEventListener() {} }
const result = await build({
  stdin: { contents: `export {useProjectStore} from './src/state/projectStore'; export * from './src/engine/fontTemplateDrag'; export {createBlankSpread} from './src/engine/autoLayout'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const { useProjectStore: store, startFontTemplateDrag, isFontTemplateDrag, dropFontTemplate, createBlankSpread } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const spread = { ...createBlankSpread(0, { backgroundColor: '#fff', marginPx: 0, gapPx: 0, borderWidth: 0, borderColor: '#fff' }), id: 's' }
store.setState(s => ({ project: { ...s.project, spreads: [spread] } }))
const box = (id, x, y) => ({ id, x, y, width: 0.2, height: 0.1, text: id, fontFamily: 'Arial', fontSize: 20, color: '#000', align: 'left', bold: false, italic: false })
const types = []
const data = { types, setData: (type) => types.push(type) }
startFontTemplateDrag(data, [box('a', 0.1, 0.1), box('b', 0.2, 0.2)])
assert.equal(isFontTemplateDrag(data), true)
assert.equal(isFontTemplateDrag({ types: [] }), false, 'other drags are ignored')
assert.equal(dropFontTemplate('s', 0.5, 0.5), true)
const boxes = store.getState().project.spreads[0].textBoxes
assert.equal(boxes.length, 2)
assert.equal(new Set(boxes.map(b => b.groupId)).size, 1, 'one new group')
assert.ok(boxes.every(b => b.id !== 'a' && b.id !== 'b'), 'fresh ids')
const left = Math.min(...boxes.map(b => b.x)), right = Math.max(...boxes.map(b => b.x + b.width))
assert.ok(Math.abs((left + right) / 2 - 0.5) < 1e-9, 'centred on the drop point')
assert.deepEqual(store.getState().selectedLayerKeys.sort(), boxes.map(b => 'text:' + b.id).sort())
// Dropping at the edge keeps the whole group on the page.
startFontTemplateDrag(data, [box('c', 0.1, 0.1), box('d', 0.2, 0.2)])
dropFontTemplate('s', 1.4, -0.3)
const edge = store.getState().project.spreads[0].textBoxes.slice(2)
assert.ok(edge.every(b => b.x >= -1e-9 && b.x + b.width <= 1 + 1e-9 && b.y >= -1e-9 && b.y + b.height <= 1 + 1e-9), 'kept on the page')
assert.equal(dropFontTemplate('s', 0.5, 0.5), false, 'nothing left to drop')
console.log('Font template drop checks passed: one group, centred, on-page, selected, other drags ignored.')
