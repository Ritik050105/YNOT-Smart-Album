// The focal point a photo gets at import. A frame rarely matches the photo's aspect ratio, so a
// centred crop cuts through whatever is off-centre; this is what moves the crop onto the people.
import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({
  stdin: { contents: `export {subjectFocusFromImage,subjectBoxFromImage} from './src/engine/subjectFocus';export {computeCoverCrop} from './src/engine/cropFit'`, resolveDir: process.cwd() },
  bundle: true, loader: { '.ttf': 'dataurl' }, platform: 'node', format: 'esm', write: false,
})

// A canvas stub: subjectFocusFromImage only needs drawImage to land the pixels and getImageData to
// read them back, so the "image" here is just the pixel block it should see.
function fakeDocument(pixels, width, height) {
  return {
    createElement() {
      let w = 0, h = 0
      return {
        set width(v) { w = v }, get width() { return w },
        set height(v) { h = v }, get height() { return h },
        getContext() {
          return {
            drawImage() {},
            getImageData() {
              // Nearest-neighbour the source block into the w*h sample the function asked for.
              const data = new Uint8ClampedArray(w * h * 4)
              for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                const sx = Math.min(width - 1, Math.floor(x / w * width)), sy = Math.min(height - 1, Math.floor(y / h * height))
                const from = (sy * width + sx) * 4, to = (y * w + x) * 4
                data[to] = pixels[from]; data[to + 1] = pixels[from + 1]; data[to + 2] = pixels[from + 2]; data[to + 3] = pixels[from + 3]
              }
              return { data }
            },
          }
        },
      }
    },
  }
}

/** A flat photo with a block of skin tone somewhere in it. */
function photoWithFaceAt(fx, fy, { width = 120, height = 80, faceSize = 18 } = {}) {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = 150; pixels[i * 4 + 1] = 150; pixels[i * 4 + 2] = 150; pixels[i * 4 + 3] = 255
  }
  const cx = Math.round(fx * width), cy = Math.round(fy * height)
  for (let y = cy - faceSize / 2; y < cy + faceSize / 2; y++) {
    for (let x = cx - faceSize / 2; x < cx + faceSize / 2; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue
      const i = (Math.floor(y) * width + Math.floor(x)) * 4
      pixels[i] = 215; pixels[i + 1] = 165; pixels[i + 2] = 135; pixels[i + 3] = 255
    }
  }
  return { pixels, width, height }
}

const { subjectFocusFromImage, subjectBoxFromImage, computeCoverCrop } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

for (const [fx, fy, label] of [[0.5, 0.22, 'high'], [0.22, 0.5, 'left'], [0.78, 0.5, 'right'], [0.5, 0.78, 'low']]) {
  const { pixels, width, height } = photoWithFaceAt(fx, fy)
  globalThis.document = fakeDocument(pixels, width, height)
  const focus = subjectFocusFromImage({})
  assert.ok(focus, `${label}: a photo with a face gets a focal point`)
  // It must move toward the face, and stay on the same side of centre as the face.
  assert.ok(Math.sign(focus.focusX - 0.5) === Math.sign(fx - 0.5) || Math.abs(fx - 0.5) < 0.01, `${label}: focusX leans toward the subject (got ${focus.focusX})`)
  assert.ok(Math.sign(focus.focusY - 0.5) === Math.sign(fy - 0.5) || Math.abs(fy - 0.5) < 0.01, `${label}: focusY leans toward the subject (got ${focus.focusY})`)
  // Never pinned to an edge: the crop has to keep some of the surroundings.
  assert.ok(focus.focusX >= 0.2 && focus.focusX <= 0.8, `${label}: focusX stays off the edge`)
  assert.ok(focus.focusY >= 0.2 && focus.focusY <= 0.8, `${label}: focusY stays off the edge`)
}

// The point of all this: a tall frame cut from a wide photo of a high-standing subject must keep
// the subject, where a centred crop would slice through it.
{
  const { pixels, width, height } = photoWithFaceAt(0.5, 0.2, { width: 160, height: 90, faceSize: 14 })
  globalThis.document = fakeDocument(pixels, width, height)
  const focus = subjectFocusFromImage({})
  const faceY = 0.2 * height
  const centred = computeCoverCrop(width, height, 60, 90, 0.5, 0.5, 3)
  const focused = computeCoverCrop(width, height, 60, 90, focus.focusX, focus.focusY, 3)
  const inside = crop => faceY >= crop.cropY && faceY <= crop.cropY + crop.cropHeight
  assert.ok(!inside(centred), 'the centred crop misses a subject standing high in the frame')
  assert.ok(inside(focused), 'the measured focal point keeps it')
}

// A flat photo with nothing in it has no subject, and says so rather than inventing one.
{
  const width = 40, height = 40
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255)
  globalThis.document = fakeDocument(pixels, width, height)
  assert.equal(subjectFocusFromImage({}), null, 'a blank photo reports no subject')
}

// The head box is centred on the face itself, not pulled toward the middle, and it takes the head
// that stands highest when a lower patch of skin (a hand) is also in the frame.
{
  const { pixels, width, height } = photoWithFaceAt(0.3, 0.25, { width: 160, height: 160, faceSize: 32 })
  for (let y = 120; y < 134; y++) for (let x = 100; x < 114; x++) { const i = (y * width + x) * 4; pixels[i] = 215; pixels[i + 1] = 165; pixels[i + 2] = 135 }
  globalThis.document = fakeDocument(pixels, width, height)
  const box = subjectBoxFromImage({})
  assert.ok(box, 'a face is found')
  assert.ok(Math.abs(box.focusX - 0.3) < 0.03 && Math.abs(box.focusY - 0.25) < 0.03, `the box is centred on the face (got ${box.focusX}, ${box.focusY})`)
  assert.ok(Math.abs(box.width - 0.2) < 0.04 && Math.abs(box.height - 0.2) < 0.04, `the box is the size of the face (got ${box.width} x ${box.height})`)
  const focus = subjectFocusFromImage({})
  assert.ok(Math.abs(focus.focusX - 0.3) < 0.03, 'the import focal point sits on the face, not pulled to the middle')
}

// A violet-grey studio backdrop is not skin, however much of the picture it covers: it used to read as
// one enormous face and put the subject at the middle of the page.
{
  const width = 160, height = 100, pixels = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) { pixels[i * 4] = 112; pixels[i * 4 + 1] = 102; pixels[i * 4 + 2] = 118; pixels[i * 4 + 3] = 255 }
  globalThis.document = fakeDocument(pixels, width, height)
  assert.equal(subjectBoxFromImage({ naturalWidth: width, naturalHeight: height }), null, 'a violet-grey backdrop is not a face')
}

// Skin runs on below the chin into the neck and chest, and the whole run is one region. The face is the
// top of it, so the box stops where a face would, not at the bottom of the neck.
{
  const width = 160, height = 160, pixels = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) { pixels[i * 4] = 112; pixels[i * 4 + 1] = 102; pixels[i * 4 + 2] = 118; pixels[i * 4 + 3] = 255 }
  const skin = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * width + x) * 4; pixels[i] = 215; pixels[i + 1] = 165; pixels[i + 2] = 135 } }
  skin(56, 16, 104, 76)   // a face 48 wide, 60 tall
  skin(72, 76, 88, 150)   // a neck 16 wide running to the bottom of the picture
  globalThis.document = fakeDocument(pixels, width, height)
  const box = subjectBoxFromImage({ naturalWidth: width, naturalHeight: height })
  assert.ok(box, 'the face is found')
  assert.ok(box.height < 0.55, `the box stops at the chin, not the end of the neck (height ${box.height})`)
  assert.ok(Math.abs(box.focusX - 0.5) < 0.03 && box.focusY < 0.4, `the focal point is on the face (got ${box.focusX}, ${box.focusY})`)
}

console.log('Subject focus checks passed: the crop follows the subject, stays off the edges, keeps a high subject a centred crop would cut, and reports nothing on a blank frame.')
