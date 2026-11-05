/** Generates the NSIS sidebar bitmaps from the brand logo.
 *
 *  electron-builder wants 164x314 (installer) and 164x314 (uninstaller) BMPs, and sharp cannot
 *  write BMP, so the 24-bit header below is hand-rolled over sharp's raw RGB output. Run it when
 *  the logo changes: `node scripts/make-installer-art.cjs`. */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const W = 164, H = 314
const BG = { r: 0x14, g: 0x14, b: 0x16 }
const root = path.join(__dirname, '..', 'build')

/** 24-bit bottom-up BMP from top-down RGB rows. */
function bmp(rgb) {
  const pad = (4 - (W * 3) % 4) % 4, rowBytes = W * 3 + pad
  const body = Buffer.alloc(rowBytes * H)
  for (let y = 0; y < H; y++) {
    const src = (H - 1 - y) * W * 3, dst = y * rowBytes
    for (let x = 0; x < W; x++) {
      body[dst + x * 3] = rgb[src + x * 3 + 2]
      body[dst + x * 3 + 1] = rgb[src + x * 3 + 1]
      body[dst + x * 3 + 2] = rgb[src + x * 3]
    }
  }
  const header = Buffer.alloc(54)
  header.write('BM', 0)
  header.writeUInt32LE(54 + body.length, 2)
  header.writeUInt32LE(54, 10)
  header.writeUInt32LE(40, 14)
  header.writeInt32LE(W, 18); header.writeInt32LE(H, 22)
  header.writeUInt16LE(1, 26); header.writeUInt16LE(24, 28)
  header.writeUInt32LE(body.length, 34)
  return Buffer.concat([header, body])
}

async function main() {
  const logo = await sharp(path.join(root, 'brand', 'ynot-approved-logo.png'))
    .resize(120, 120, { fit: 'contain', background: { ...BG, alpha: 0 } })
    .toBuffer()
  const { data, info } = await sharp({ create: { width: W, height: H, channels: 3, background: BG } })
    .composite([{ input: logo, top: 97, left: 22 }])
    .removeAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.channels !== 3) throw new Error(`expected RGB, got ${info.channels} channels`)
  const out = bmp(data)
  for (const name of ['installerSidebar.bmp', 'uninstallerSidebar.bmp']) {
    fs.writeFileSync(path.join(root, name), out)
    console.log('wrote build/' + name, out.length, 'bytes')
  }
}
main()
