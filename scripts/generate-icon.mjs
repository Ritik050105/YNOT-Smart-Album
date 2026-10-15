// One-off build tool: rasterizes build/icon.svg into the PNG/ICO files electron-builder needs.
// Run with: node scripts/generate-icon.mjs
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const svgPath = path.join(root, 'build', 'icon.svg')
const svg = fs.readFileSync(svgPath)

const sizes = [16, 32, 48, 64, 128, 256, 512]

async function run() {
  const pngBuffers = {}
  for (const size of sizes) {
    const buf = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()
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

  console.log('Wrote build/icon.png (512x512) and build/icon.ico (16-256 multi-size)')
}

run()
