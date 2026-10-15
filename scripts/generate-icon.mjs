// Builds the app icon from YNOT Photography's own logo mark (build/brand/ynot-mark.png,
// cropped from their site logo) composited onto a dark rounded-square badge — this app is built
// exclusively for YNOT, so the installer/taskbar icon should carry their mark, not a generic one.
// Run with: node scripts/generate-icon.mjs
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const markPath = path.join(root, 'build', 'brand', 'ynot-mark.png')

const sizes = [16, 32, 48, 64, 128, 256, 512]

function roundedSquareSvg(size, radius) {
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="${size}" y2="${size}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#2b2b2e"/>
          <stop offset="1" stop-color="#0c0c0d"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
    </svg>`
  )
}

// Recolor the (grey, alpha-shaped) mark to pure white by using its alpha channel as a mask
// over a solid white layer — keeps the exact silhouette, just changes the fill color.
async function whiteMark() {
  const alphaSource = sharp(markPath).ensureAlpha()
  const { width, height } = await alphaSource.metadata()
  const white = await sharp({ create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .png()
    .toBuffer()
  return sharp(white)
    .composite([{ input: await alphaSource.toBuffer(), blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function run() {
  const mark = await whiteMark()
  const pngBuffers = {}

  for (const size of sizes) {
    const radius = Math.round(size * 0.22)
    const bg = roundedSquareSvg(size, radius)
    const markSize = Math.round(size * 0.62)
    const markResized = await sharp(mark).resize(markSize, markSize, { fit: 'inside' }).toBuffer()
    const offset = Math.round((size - markSize) / 2)

    const buf = await sharp(bg)
      .composite([{ input: markResized, left: offset, top: offset }])
      .png()
      .toBuffer()
    pngBuffers[size] = buf
  }

  fs.writeFileSync(path.join(root, 'build', 'icon.png'), pngBuffers[512])

  const icoBuffer = await pngToIco([
    pngBuffers[16],
    pngBuffers[32],
    pngBuffers[48],
    pngBuffers[64],
    pngBuffers[128],
    pngBuffers[256],
  ])
  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), icoBuffer)

  console.log('Wrote build/icon.png (512x512) and build/icon.ico (16-256 multi-size) from the YNOT mark')
}

run()
