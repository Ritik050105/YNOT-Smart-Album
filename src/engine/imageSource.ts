
export const IMAGE_FILE_ACCEPT = 'image/*,.psd,.tif,.tiff,.cr2,.cr3,.crw,.nef,.nrw,.arw,.srf,.sr2,.dng,.raf,.orf,.rw2,.rwl,.pef,.srw,.raw,.3fr,.erf,.mef,.mos,.mrw,.x3f,.kdc,.dcr,.iiq,.fff,.cap'

export function isImageFile(file: File) {
  return file.type.startsWith('image/') || /\.(psd|tiff?|jpe?g|png|webp|avif|cr2|cr3|crw|nef|nrw|arw|srf|sr2|dng|raf|orf|rw2|rwl|pef|srw|raw|3fr|erf|mef|mos|mrw|x3f|kdc|dcr|iiq|fff|cap)$/i.test(file.name)
}

/** Ceiling on a template artwork file. Bytes are a poor proxy for the work a PSD costs — what
 *  actually consumes memory is pixels times layers, which the 100 megapixel check below guards —
 *  so this only needs to stop something absurd. A layered 12x12in cover at 300dpi runs past 250MB,
 *  and decodes in under two seconds, so the old 128MB ceiling turned ordinary album artwork away. */
export const MAX_ARTWORK_BYTES = 512 * 1024 * 1024
export const MAX_ARTWORK_LABEL = '512 MB'

/** Documents beyond this are refused whatever the file size: every layer is decoded to a canvas of
 *  this many pixels, so it is the real memory ceiling. */
export const MAX_ARTWORK_PIXELS = 100_000_000

export async function imageFileSource(file: File): Promise<string> {
  if (/\.psd$/i.test(file.name)) {
    const { readPsd } = await import('ag-psd') // loaded on demand: the PSD reader is ~600 kB the home screen never needs
    const psd = readPsd(await file.arrayBuffer(), { skipLayerImageData: true })
    if (!psd.canvas) throw new Error('This PSD has no composite image. Save it with compatibility enabled.')
    return psd.canvas.toDataURL('image/png')
  }
  if (/\.tiff?$/i.test(file.name) || file.type === 'image/tiff') {
    if (!window.albumStudio?.decodeTiff) throw new Error('TIFF import is available in the desktop application.')
    return window.albumStudio.decodeTiff(new Uint8Array(await file.arrayBuffer()))
  }
  return URL.createObjectURL(file)
}
