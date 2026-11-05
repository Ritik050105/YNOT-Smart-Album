// Justified text: every line but the last is set flush to both edges, and the last line of each
// paragraph follows whichever justify variant is set. This is the layout the export renderer,
// the spread thumbnails and the template previews all use.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: { contents: `export {drawTextBox,plainTextAlign} from './src/engine/renderSpread'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})

/** Every glyph is this wide, so a word's width is its length — which makes the expected positions
 *  arithmetic rather than guesswork. */
const GLYPH = 10

function stubContext(record) {
  const ctx = {
    font: '', textBaseline: '', textAlign: 'start', fillStyle: '', letterSpacing: '',
    globalAlpha: 1, globalCompositeOperation: 'source-over', lineWidth: 1, lineCap: 'butt',
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, setLineDash() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {},
    ellipse() {}, arcTo() {}, clip() {}, drawImage() {}, strokeRect() {},
    measureText: text => ({ width: text.length * GLYPH }),
    fillText(text, x, y) { record.push({ text, x, y, align: ctx.textAlign }) },
    fillRect(x, y, w) { record.push({ rule: true, x, w }) },
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData() {}, createLinearGradient: () => ({ addColorStop() {} }),
  }
  return ctx
}

function stubDocument(record) {
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => stubContext(record),
      toDataURL: () => 'data:,',
    }),
  }
  globalThis.FontFace = class { load() { return Promise.resolve(this) } }
  globalThis.document.fonts = { add() {}, delete() {}, has: () => true }
  globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} }
}

const { drawTextBox } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const WIDTH = 900, HEIGHT = 900
/** Lays out `text` in a box `width` of the design wide and returns what was drawn. */
async function layout(text, align, width = 0.2) {
  const record = []
  stubDocument(record)
  const ctx = stubContext([])
  await drawTextBox(ctx, {
    id: 't', x: 0, y: 0, width, height: 0.3, text, fontFamily: 'Test', fontSize: 20,
    color: '#000', align, bold: false, italic: false, previewOnly: true,
  }, WIDTH, HEIGHT)
  return { words: record.filter(r => !r.rule), rules: record.filter(r => r.rule), boxWidth: width * WIDTH }
}

// At 10px a glyph in a 180px box, 18 characters fit on a line, so this wraps into two: the first
// is justified and the second is the last line of the paragraph.
const TEXT = 'aaaa bbbb cccc dddd eeee ffff'

{
  const { words, boxWidth } = await layout(TEXT, 'justify-left')
  const first = words[0]
  assert.equal(first.align, 'left', 'a justified line is drawn word by word from the left')
  // Words on the same line share a y. The first line must end exactly at the far edge.
  const line = words.filter(w => w.y === first.y)
  assert.ok(line.length > 1, 'the first line holds more than one word')
  const last = line[line.length - 1]
  const right = last.x + last.text.length * GLYPH
  assert.ok(Math.abs(right - (first.x + boxWidth)) < 0.001,
    `the justified line reaches the far edge (ended ${right - first.x} of ${boxWidth})`)
  // And the gaps between words are equal.
  const gaps = line.slice(1).map((w, i) => w.x - (line[i].x + line[i].text.length * GLYPH))
  for (const gap of gaps) assert.ok(Math.abs(gap - gaps[0]) < 0.001, 'the gaps are even')
  assert.ok(gaps[0] > 0, 'the words do not overlap')
}

// The last line of a paragraph is the only thing the four variants differ in.
for (const [align, expected] of [['justify-left', 'left'], ['justify-center', 'center'], ['justify-right', 'right']]) {
  const { words } = await layout(TEXT, align)
  const lastY = Math.max(...words.map(w => w.y))
  const lastLine = words.filter(w => w.y === lastY)
  assert.equal(lastLine.length, 1, `${align}: the last line is drawn in one piece, not word by word`)
  assert.equal(lastLine[0].align, expected, `${align}: the last line is set ${expected}`)
}

// "Justify all lines" sets the last line flush too, so it is drawn word by word like the rest.
{
  const { words, boxWidth } = await layout(TEXT, 'justify')
  const lastY = Math.max(...words.map(w => w.y))
  const lastLine = words.filter(w => w.y === lastY)
  assert.ok(lastLine.length > 1, 'justify all: the last line is justified too')
  const last = lastLine[lastLine.length - 1]
  assert.ok(Math.abs((last.x + last.text.length * GLYPH) - (lastLine[0].x + boxWidth)) < 0.001,
    'justify all: the last line reaches the far edge')
}

// A line with one word has nowhere to put the slack, so it stays flush left rather than being
// stretched letter by letter.
{
  const { words } = await layout('aaaaaaaaaaaa', 'justify')
  assert.equal(words.length, 1, 'a single word is drawn in one piece')
  assert.equal(words[0].align, 'left', 'a single word is not stretched')
}

// The plain alignments are untouched by any of this.
for (const align of ['left', 'center', 'right']) {
  const { words } = await layout('aaaa bbbb', align, 0.9)
  assert.equal(words.length, 1, `${align}: a short line is drawn in one piece`)
  assert.equal(words[0].align, align, `${align}: drawn with that alignment`)
}

console.log('Justify checks passed: flush lines reach both edges with even gaps, each variant sets its last line, a lone word is left alone, and plain alignments are unchanged.')
