// A face is kept whole in every frame a layout gives it: the crop is centred on the face, moved the least that keeps the head (with
// headroom) inside, and a tiny face comes in a little. Locked frames are left alone.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: { contents: `export {faceFraming,applyFaceFraming} from './src/engine/faceFraming'
export {computeCoverCrop} from './src/engine/cropFit'
export {retemplateSpread,createBlankSpread,defaultPlacement} from './src/engine/autoLayout'
export {findTemplate} from './src/engine/templates'
export {swapMismatch} from './src/engine/layoutMath'
export {withMeasuredSubject} from './src/engine/subjectBackfill'`, resolveDir: process.cwd() }, external: ['@vladmandic/face-api*'],
  bundle: true, loader: { '.bin':'dataurl', '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})
const m = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

const crop = (photo, ratio, f) => m.computeCoverCrop(photo.width, photo.height, ratio, 1, f.focalX, f.focalY, f.zoom)
const holdsHead = (photo, ratio) => {
  const f = m.faceFraming(photo, ratio), c = crop(photo, ratio, f)
  const top = Math.max(0, photo.focusY - photo.focusH * 0.7) * photo.height, bottom = Math.min(1, photo.focusY + photo.focusH * 0.55) * photo.height
  const left = (photo.focusX - photo.focusW * 0.65) * photo.width, right = (photo.focusX + photo.focusW * 0.65) * photo.width
  return top >= c.cropY - 1 && bottom <= c.cropY + c.cropHeight + 1 && left >= c.cropX - 1 && right <= c.cropX + c.cropWidth + 1
}
// Faces high in a landscape photograph (a couple standing), a very wide frame, a tall one, a square one: the head is always in the crop.
for (const [fx, fy, fw, fh] of [[0.5, 0.2, 0.08, 0.14], [0.3, 0.15, 0.1, 0.16], [0.75, 0.3, 0.06, 0.1], [0.5, 0.12, 0.12, 0.2]]) {
  const photo = { width: 3000, height: 2000, focusX: fx, focusY: fy, focusW: fw, focusH: fh }
  for (const ratio of [2.4, 1.5, 1, 0.75, 0.45]) assert.ok(holdsHead(photo, ratio), `face at ${fx},${fy} in a ${ratio} frame stays whole`)
}
// An upright photograph in a wide frame, face near the top.
assert.ok(holdsHead({ width: 2000, height: 3000, focusX: 0.5, focusY: 0.18, focusW: 0.18, focusH: 0.12 }, 2), 'a tall photograph in a wide frame keeps the head')
// A tiny face comes in, but never past 1.4x; a big one does not.
{
  const tiny = m.faceFraming({ width: 4000, height: 3000, focusX: 0.5, focusY: 0.4, focusW: 0.02, focusH: 0.03 }, 1.5)
  assert.ok(tiny.zoom > 1 && tiny.zoom <= 1.4, `a speck of a face comes in a little (${tiny.zoom})`)
  assert.equal(m.faceFraming({ width: 4000, height: 3000, focusX: 0.5, focusY: 0.4, focusW: 0.2, focusH: 0.3 }, 1.5).zoom, 1, 'a large face keeps the whole picture')
}
// No subject measured: the crop stays centred; a point without a size is used as it is.
assert.equal(m.faceFraming({ width: 3000, height: 2000 }, 1.5).focalY, 0.5)
assert.deepEqual(m.faceFraming({ width: 3000, height: 2000, focusX: 0.4, focusY: 0.3 }, 1.5), { focalX: 0.4, focalY: 0.3, zoom: 1 })

// Applying a layout frames every photograph for its own frame, except a locked one.
{
  const photos = [
    { id: 'a', width: 3000, height: 2000, focusX: 0.5, focusY: 0.2, focusW: 0.08, focusH: 0.14 },
    { id: 'b', width: 2000, height: 3000, focusX: 0.5, focusY: 0.15, focusW: 0.16, focusH: 0.1 },
  ]
  const blank = m.createBlankSpread(0, { backgroundColor: '#fff', gapPx: 6, marginPx: 3, borderWidth: 0, borderColor: '#000' })
  const spread = { ...blank, placements: photos.map((p, i) => m.defaultPlacement('f' + i, p.id)) }
  const template = ['gen-mixed-full-right-2', 'ref-signature-hero-two-wides-left', 'editorial-preview-5'].map(id => m.findTemplate(id)).find(t => t && t.photoCount === 2) ?? m.findTemplate('full-bleed')
  const placed = m.retemplateSpread(spread, template.id, photos, 1.5, true)
  for (const pl of placed.placements) if (pl.photoId) assert.ok(Number.isFinite(pl.focalX) && Number.isFinite(pl.focalY) && pl.zoom >= 1, 'every photograph gets a framing')
  const locked = m.retemplateSpread({ ...spread, placements: spread.placements.map(p => ({ ...p, locked: true, focalY: 0.9 })) }, template.id, photos, 1.5, true)
  assert.ok(locked.placements.every(p => p.focalY === 0.9) || locked === spread, 'a locked frame keeps its own crop')
}
// A photograph with only a point (no face was found) is centred on the point when a layout is applied, and keeps its zoom; one with nothing measured is left alone.
{
  const blank = m.createBlankSpread(0, { backgroundColor: '#fff', gapPx: 6, marginPx: 3, borderWidth: 0, borderColor: '#000' })
  const spread = { ...blank, placements: [{ ...blank.placements[0], photoId: 'a', zoom: 1.6, focalX: 0.5, focalY: 0.5 }] }
  const withPoint = m.applyFaceFraming(spread, [{ id: 'a', width: 2000, height: 3000, focusX: 0.5, focusY: 0.3 }], 1.5)
  assert.equal(withPoint.placements[0].focalY, 0.3, 'the crop goes to the measured point')
  assert.equal(withPoint.placements[0].zoom, 1.6, 'and the zoom is kept')
  assert.equal(m.applyFaceFraming(spread, [{ id: 'a', width: 2000, height: 3000 }], 1.5), spread, 'nothing measured: untouched')
}
// An older album: a photograph measured again moves the crop of the frames still at its old starting point, and no other.
{
  const project = { photos: [{ id: 'a', width: 2000, height: 3000, focusX: 0.5, focusY: 0.5 }], spreads: [{ placements: [
    { photoId: 'a', focalX: 0.5, focalY: 0.5, zoom: 1 },       // untouched since import: follows
    { photoId: 'a', focalX: 0.5, focalY: 0.5, zoom: 1.4 },     // zoomed by hand: stays
    { photoId: 'a', focalX: 0.2, focalY: 0.6, zoom: 1 },       // placed by hand: stays
    { photoId: 'a', focalX: 0.5, focalY: 0.5, zoom: 1, locked: true }, // locked: stays
  ] }] }
  const next = m.withMeasuredSubject(project, 'a', { focusX: 0.5, focusY: 0.28 })
  assert.equal(next.photos[0].focusY, 0.28)
  assert.deepEqual(next.spreads[0].placements.map(p => p.focalY), [0.28, 0.5, 0.6, 0.5], 'only the frame still at the old starting crop follows')
}
// A swap needs both photographs to suit the other's frame (empty frames take anything; squares suit all).
{
  const wide = { width: 1500, height: 1000 }, tall = { width: 1000, height: 1500 }, square = { width: 1000, height: 1000 }
  assert.equal(m.swapMismatch(wide, wide, tall, tall), 'a', 'a landscape photograph does not go into a portrait frame')
  assert.equal(m.swapMismatch(wide, wide, wide, wide), null)
  assert.equal(m.swapMismatch(wide, wide, square, wide), null, 'a square photograph suits either')
  assert.equal(m.swapMismatch(undefined, wide, tall, tall), 'b', 'the photograph moving into the empty frame is still judged')
  assert.equal(m.swapMismatch(wide, wide, undefined, tall), 'a')
}
console.log('Face framing checks passed: head kept whole at five frame shapes, tiny faces come in at most 1.4x, locked frames untouched.')
