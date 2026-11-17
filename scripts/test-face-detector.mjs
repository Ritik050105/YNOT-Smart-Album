// How the faces the detector finds become the one face box a photograph keeps (the model itself is exercised in the real app).
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: { contents: `export {faceBoxFrom} from './src/engine/faceDetector'`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'esm', write: false, external: ['@vladmandic/face-api*'], alias: { '@': process.cwd() + '/src' },
})
const { faceBoxFrom } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-6, `${what}: ${a} vs ${b}`)

// One face: the box is kept, the eyes sit 40% down it.
{
  const box = faceBoxFrom([{ x: 400, y: 100, width: 100, height: 120, score: 0.9 }], 1000, 1000)
  near(box.focusX, 0.45, 'x'); near(box.focusY, (100 + 120 * 0.4) / 1000, 'eyes'); near(box.focusW, 0.1, 'w'); near(box.focusH, 0.12, 'h')
}
// A couple: both faces are kept together, the eyes at the middle of the joined box.
{
  const box = faceBoxFrom([{ x: 300, y: 200, width: 100, height: 120, score: 0.9 }, { x: 480, y: 210, width: 90, height: 110, score: 0.8 }], 1000, 1000)
  near(box.focusX, (300 + 570) / 2 / 1000, 'joined x'); near(box.focusW, 0.27, 'joined width'); near(box.focusY, 0.26, 'joined eyes') // the joined box runs 200-320, eyes at its middle
}
// A small face beside a big one is a bystander: only the big one counts.
{
  const box = faceBoxFrom([{ x: 300, y: 200, width: 200, height: 240, score: 0.9 }, { x: 700, y: 300, width: 40, height: 50, score: 0.9 }], 1000, 1000)
  near(box.focusW, 0.2, 'bystander ignored')
}
// A crowd spread over the picture is not one box: the biggest face alone is kept.
{
  const faces = [0, 1, 2, 3].map(i => ({ x: 50 + i * 250, y: i % 2 ? 100 : 700, width: 100, height: 120, score: 0.9 }))
  const box = faceBoxFrom(faces, 1000, 1000)
  assert.ok(box.focusW <= 0.1 + 1e-9 && box.focusH <= 0.12 + 1e-9, 'a crowd keeps one face')
}
// Doubtful detections are ignored.
assert.equal(faceBoxFrom([{ x: 10, y: 10, width: 50, height: 50, score: 0.3 }], 500, 500), null)
assert.equal(faceBoxFrom([], 500, 500), null)
console.log('Face detector checks passed: one face, a couple together, bystanders and crowds, doubtful detections ignored.')
