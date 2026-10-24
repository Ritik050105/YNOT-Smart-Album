// Builds the app icon from YNOT Photography's own logo mark (build/brand/ynot-mark.png,
// cropped from their site logo) on a transparent canvas — this app is built
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

async function blueMark() {
  const alphaSource = sharp(markPath).ensureAlpha()
  const { width, height } = await alphaSource.metadata()
  const color = await sharp({ create: { width, height, channels: 4, background: { r: 49, g: 87, b: 200, alpha: 1 } } })
    .png()
    .toBuffer()
  return sharp(color)
    .composite([{ input: await alphaSource.toBuffer(), blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function run() {
  const mark = await blueMark()
  const pngBuffers = {}

  for (const size of sizes) {
    const markSize = Math.round(size * 0.86)
    const markResized = await sharp(mark).resize(markSize, markSize, { fit: 'inside' }).toBuffer()
    const offset = Math.round((size - markSize) / 2)

    const buf = await sharp({ create: { width:size, height:size, channels:4, background:{r:0,g:0,b:0,alpha:0} } })
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
