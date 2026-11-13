// Previous / Next on a spread's font templates replaces the template layer being worked on and nothing
// else. Reaching a template that is already on the spread as another layer adds a new layer of it; the
// layer that was there is not deleted, and the new one is set apart so it can be told apart.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({ stdin: { contents: `export {stepFontTemplate} from './src/engine/fontTemplateStep'`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false })
const { stepFontTemplate } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const NAMES = ['Scary', 'Paint', 'Rock', 'Bold', 'Spooky', 'Glitch']
let counter = 0
const box = (text, i) => ({ id: 'b' + (counter++), text, x: 0.3, y: 0.3 + i * 0.1, width: 0.3, height: 0.08, fontFamily: 'X', fontSize: 20, color: '#000', align: 'center' })
// "Bold" is a two-line template; the rest are one line.
const templates = NAMES.map(n => ({ id: n, boxes: n === 'Bold' ? [box('BOLD', 0), box('MOVES', 1)] : [box(n, 0)] }))
const groupFor = id => 'quote:' + id
const copy = (b, groupId) => ({ ...b, id: 'n' + (counter++), groupId })
const place = (textBoxes, id) => { const boxes = templates.find(t => t.id === id).boxes.map(b => copy(b, groupFor(id))); return { textBoxes: [...textBoxes, ...boxes], placedIds: boxes.map(b => b.id) } }
const names = textBoxes => textBoxes.map(b => b.text).join(',')
const layersOf = (textBoxes, id) => textBoxes.filter(b => b.groupId && (b.groupId === groupFor(id) || b.groupId.startsWith(groupFor(id) + '#')))
// The app selects whole groups: picking one layer of a group picks every layer in it. Reproduced here,
// because two layers of one template sharing a group is exactly how the old Spooky layer got replaced too.
const selectedLikeTheApp = (ids, textBoxes) => { const groups = new Set(textBoxes.filter(b => ids.includes(b.id) && b.groupId).map(b => b.groupId)); return textBoxes.filter(b => ids.includes(b.id) || (b.groupId && groups.has(b.groupId))).map(b => b.id) }

let state = { textBoxes: [], placedIds: [], templateId: null }
const stepFrom = (direction, overrides = {}) => {
  const r = stepFontTemplate({ textBoxes: state.textBoxes, templates, direction, selectedIds: selectedLikeTheApp(state.placedIds, state.textBoxes), lastPlacedIds: state.placedIds, activeId: state.templateId, groupFor, copy, ...overrides })
  state = { textBoxes: r.textBoxes, placedIds: r.placedIds, templateId: r.templateId }
  return r
}

// 1. The report: Spooky is on the spread, then Bold (a template before it) is chosen as well. Stepping on
//    from Bold reaches Spooky, which is already there.
let placed = place([], 'Spooky'); state = { ...placed, templateId: 'Spooky' }
const oldSpooky = state.textBoxes[0]
placed = place(state.textBoxes, 'Bold'); state = { ...placed, templateId: 'Bold' }
assert.equal(layersOf(state.textBoxes, 'Spooky').length, 1)
assert.equal(layersOf(state.textBoxes, 'Bold').length, 2)

let r = stepFrom(1)
assert.equal(r.templateId, 'Spooky', 'Next from Bold reaches Spooky')
assert.equal(layersOf(r.textBoxes, 'Bold').length, 0, 'the stepped layer is replaced')
const spookies = layersOf(r.textBoxes, 'Spooky')
assert.equal(spookies.length, 2, 'the Spooky layer that was there is still there, and the stepped layer is a new one beside it')
assert.deepEqual(spookies[0], oldSpooky, 'the old layer is untouched: same id, same place')
assert.ok(spookies[1].id !== oldSpooky.id && spookies[1].x > oldSpooky.x && spookies[1].y > oldSpooky.y, 'the new layer is set down and to the right so it can be told apart')
assert.notEqual(spookies[1].groupId, oldSpooky.groupId, 'each layer is its own group, so selecting the new one does not select the old one')

// 2. Stepping on again replaces only the new layer; the old Spooky is still not touched.
r = stepFrom(1)
assert.equal(r.templateId, 'Glitch')
assert.equal(layersOf(r.textBoxes, 'Spooky').length, 1)
assert.deepEqual(layersOf(r.textBoxes, 'Spooky')[0], oldSpooky)
assert.equal(layersOf(r.textBoxes, 'Glitch').length, 1)

// 3. And back again, through the template it came from, to where it started.
r = stepFrom(-1); assert.equal(r.templateId, 'Spooky'); assert.equal(layersOf(r.textBoxes, 'Spooky').length, 2)
r = stepFrom(-1); assert.equal(r.templateId, 'Bold'); assert.equal(layersOf(r.textBoxes, 'Spooky').length, 1); assert.equal(layersOf(r.textBoxes, 'Bold').length, 2)
assert.deepEqual(layersOf(r.textBoxes, 'Spooky')[0], oldSpooky)

// 4. However many steps in either direction, only the stepped layer ever changes: every other layer on the
//    spread is the same object it was when the walk began.
{
  state = { ...place(place([], 'Spooky').textBoxes, 'Rock'), templateId: 'Rock' }
  const bystander = state.textBoxes.find(b => b.groupId === groupFor('Spooky'))
  let allBystanders = [bystander]
  // a third, unrelated layer the designer typed
  const typed = { ...box('typed by hand', 3), groupId: undefined }
  state.textBoxes = [...state.textBoxes, typed]
  for (let i = 0; i < 40; i++) {
    r = stepFrom(i % 7 < 4 ? 1 : -1)
    assert.ok(r.textBoxes.includes(typed), `step ${i}: the layer typed by hand is untouched`)
    assert.ok(r.textBoxes.includes(bystander), `step ${i}: the layer that was not being stepped is untouched`)
    // exactly one template's worth of layers was added by the walk
    const others = r.textBoxes.filter(b => b !== typed && b !== bystander)
    assert.equal(others.length, templates.find(t => t.id === r.templateId).boxes.length, `step ${i}: the walk holds exactly one template layer`)
  }
}

// 5. The selection wins: with the old Spooky layer selected, Next replaces that one and leaves the other.
{
  state = { ...place([], 'Spooky'), templateId: 'Spooky' }
  const first = state.textBoxes[0]
  state = { ...place(state.textBoxes, 'Bold'), templateId: 'Bold' }
  r = stepFrom(1)   // Bold -> Spooky: a second Spooky layer, in a group of its own
  assert.equal(layersOf(r.textBoxes, 'Spooky').length, 2)
  r = stepFrom(1, { selectedIds: selectedLikeTheApp([first.id], state.textBoxes), lastPlacedIds: state.placedIds })
  assert.ok(!r.textBoxes.some(b => b.id === first.id), 'the selected layer was the one replaced')
  assert.equal(layersOf(r.textBoxes, 'Spooky').length, 1, 'the other Spooky layer stays')
  assert.equal(layersOf(r.textBoxes, 'Glitch').length, 1)
}

// 6. Nothing selected and nothing remembered: the first template layer on the spread is the one stepped.
{
  state = { ...place([], 'Rock'), templateId: null }
  r = stepFromNothing()
  function stepFromNothing() { const out = stepFontTemplate({ textBoxes: state.textBoxes, templates, direction: 1, selectedIds: [], lastPlacedIds: [], activeId: null, groupFor, copy }); return out }
  assert.equal(r.templateId, 'Bold'); assert.equal(layersOf(r.textBoxes, 'Rock').length, 0)
}

// 7. An empty spread starts at the first template going forward and the last going back.
assert.equal(stepFontTemplate({ textBoxes: [], templates, direction: 1, selectedIds: [], lastPlacedIds: [], activeId: null, groupFor, copy }).templateId, 'Scary')
assert.equal(stepFontTemplate({ textBoxes: [], templates, direction: -1, selectedIds: [], lastPlacedIds: [], activeId: null, groupFor, copy }).templateId, 'Glitch')

console.log('Font template step checks passed: Previous/Next replace only the layer being stepped, a template already on the spread becomes a new layer beside the old one, and nothing else on the spread is ever removed.')
