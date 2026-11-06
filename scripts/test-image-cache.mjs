// Decoded images are reused instead of decoded again for every redraw, and the cache stays inside
// its memory budget. Both halves matter: without the first the app re-decodes 24MP photos on every
// template change, and without the second a long session holds every photo ever opened.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: { contents: `export {loadImage,clearImageCache} from './src/engine/renderSpread'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})

/** Counts how many times a src is actually decoded. */
let decodes = []
class FakeImage {
  constructor() { this.naturalWidth = 0; this.naturalHeight = 0 }
  set src(value) {
    decodes.push(value)
    const size = Number(value.split('#')[1] ?? 1000)
    this.naturalWidth = size
    this.naturalHeight = size
    queueMicrotask(() => { if (value.includes('broken')) this.onerror?.(new Error('nope')); else this.onload?.() })
  }
}
globalThis.Image = FakeImage
globalThis.document = { createElement: () => ({ getContext: () => null }), fonts: { add() {}, has: () => true } }
globalThis.window = { addEventListener() {}, removeEventListener() {} }

const { loadImage, clearImageCache } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

// A repeat request is served from the cache: one decode, not two.
decodes = []
const a1 = await loadImage('photo-a#1000')
const a2 = await loadImage('photo-a#1000')
assert.equal(decodes.length, 1, `the same photo is decoded once (decoded ${decodes.length} times)`)
assert.equal(a1, a2, 'and the same decoded image comes back')

// Different photos are each decoded.
decodes = []
await loadImage('photo-b#1000')
assert.equal(decodes.length, 1, 'a different photo is decoded')

// The budget is 80MP. Six 5000x5000 photos are 150MP, so the earliest must have been evicted —
// and asking for it again decodes it again.
clearImageCache()
decodes = []
for (let i = 0; i < 6; i++) await loadImage(`big-${i}#5000`)
assert.equal(decodes.length, 6, 'each big photo decoded once on the way in')
await loadImage('big-0#5000')
assert.equal(decodes.length, 7, 'the oldest big photo was evicted and had to be decoded again')
// The most recent one is still there.
await loadImage('big-5#5000')
assert.equal(decodes.length, 7, 'the newest big photo is still cached')

// A photo larger than the whole budget is not held at all, and does not evict everything first.
clearImageCache()
decodes = []
await loadImage('small#1000')
await loadImage('enormous#20000')
await loadImage('small#1000')
assert.equal(decodes.length, 2, 'a photo too large to cache does not evict the small one')

// A failed decode is not cached, so a retry really retries.
clearImageCache()
decodes = []
await assert.rejects(() => loadImage('broken#100'))
await assert.rejects(() => loadImage('broken#100'))
assert.equal(decodes.length, 2, 'a failed load is retried rather than remembered as a failure')

console.log('Image cache checks passed: repeats are reused, the pixel budget evicts oldest first, an oversized photo is not held, and failures are not cached.')
