import sharp from 'sharp'

export async function decodeTiff(data: Uint8Array): Promise<string> {
  if (!(data instanceof Uint8Array) || data.byteLength > 512 * 1024 * 1024) throw new Error('Invalid image data or image file larger than 512 MB.')
  const image = sharp(Buffer.from(data), { limitInputPixels: 100_000_000 })
  const metadata = await image.metadata()
  if (metadata.format !== 'tiff') throw new Error('This file is not a valid TIFF image.')
  const png = await image.rotate().withIccProfile('srgb').png().toBuffer()
  return `data:image/png;base64,${png.toString('base64')}`
}
