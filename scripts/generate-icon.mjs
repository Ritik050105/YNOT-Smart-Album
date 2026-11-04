// Generate every branded icon from the supplied YNOT ALBUMS PSD export.
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const markPath = path.join(root, 'build', 'brand', 'ynot-approved-logo.png')

const sizes = [16, 32, 48, 64, 128, 256, 512, 1024]

async function run() {
  const mark = fs.readFileSync(markPath)
  const pngBuffers = {}

  for (const size of sizes) {
    const buf = await sharp(mark).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    pngBuffers[size] = buf
  }

  fs.writeFileSync(path.join(root, 'build', 'icon.png'), pngBuffers[512])
  fs.writeFileSync(path.join(root, 'src', 'assets', 'ynot-badge.png'), pngBuffers[512])
  fs.writeFileSync(path.join(root, 'public', 'favicon.png'), pngBuffers[64])
  fs.writeFileSync(path.join(root, 'admin-license', 'logo.png'), pngBuffers[256])
  const chunks = [[128,'ic07'],[256,'ic08'],[512,'ic09'],[1024,'ic10']].map(([size,type]) => {
    const head=Buffer.alloc(8);head.write(type);head.writeUInt32BE(pngBuffers[size].length+8,4);return Buffer.concat([head,pngBuffers[size]])
  })
  const head=Buffer.alloc(8);head.write('icns');head.writeUInt32BE(8+chunks.reduce((n,c)=>n+c.length,0),4)
  fs.writeFileSync(path.join(root,'build','icon.icns'),Buffer.concat([head,...chunks]))

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
