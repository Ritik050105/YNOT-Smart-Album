import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'
import { stat } from 'fs/promises'

export async function decodeTiff(data: Uint8Array): Promise<string> {
  if (!(data instanceof Uint8Array) || data.byteLength > 512 * 1024 * 1024) throw new Error('Invalid image data or image file larger than 512 MB.')
  const image = sharp(Buffer.from(data), { limitInputPixels: 100_000_000, sequentialRead: true })
  const metadata = await image.metadata()
  if (metadata.format !== 'tiff') throw new Error('This file is not a valid TIFF image.')
  const png = await image.rotate().withIccProfile('srgb').png().toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}

export async function imagePreview(data: Uint8Array | string) {
  if (typeof data === 'string') {
    if (data.startsWith('file:')) data = fileURLToPath(data)
    if (!path.isAbsolute(data) || !/\.(jpe?g|png|webp|gif|bmp|tiff?|avif|heic)$/i.test(data)) throw new Error('Invalid image path')
    const info = await stat(data)
    if (!info.isFile() || info.size > 512 * 1024 * 1024) throw new Error('Invalid image file')
  } else if (!(data instanceof Uint8Array) || data.byteLength > 512 * 1024 * 1024) throw new Error('Invalid image data')
  const input = sharp(typeof data === 'string' ? data : Buffer.from(data), { limitInputPixels: 100_000_000 })
  const meta = await input.metadata()
  const rotated = (meta.orientation ?? 1) >= 5
  const preview = await input.rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).webp({quality:85,effort:2}).toBuffer()
  // Thumbnail and B/W check come from the small preview, so the huge original is decoded only once.
  const small = sharp(preview)
  const thumb = await small.clone().resize(480,480,{fit:'inside'}).webp({quality:78,effort:2}).toBuffer()
  const { data: pixels } = await small.clone().resize(48,48,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true})
  let colored = 0, visible = 0
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue
    visible++
    if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) > 12) colored++
  }
  return {width:rotated?meta.height!:meta.width!,height:rotated?meta.width!:meta.height!,hasColorProfile:!!meta.icc,src:`data:image/webp;base64,${preview.toString('base64')}`,thumb:`data:image/webp;base64,${thumb.toString('base64')}`,isBlackAndWhite:visible>0?colored/visible<0.015:undefined}
}
