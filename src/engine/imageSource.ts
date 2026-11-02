import { readPsd } from 'ag-psd'

export const IMAGE_FILE_ACCEPT = 'image/*,.psd,.tif,.tiff,.cr2,.cr3,.crw,.nef,.nrw,.arw,.srf,.sr2,.dng,.raf,.orf,.rw2,.rwl,.pef,.srw,.raw,.3fr,.erf,.mef,.mos,.mrw,.x3f,.kdc,.dcr,.iiq,.fff,.cap'

export function isImageFile(file: File) {
  return file.type.startsWith('image/') || /\.(psd|tiff?|jpe?g|png|webp|avif|cr2|cr3|crw|nef|nrw|arw|srf|sr2|dng|raf|orf|rw2|rwl|pef|srw|raw|3fr|erf|mef|mos|mrw|x3f|kdc|dcr|iiq|fff|cap)$/i.test(file.name)
}

export async function imageFileSource(file: File): Promise<string> {
  if (/\.psd$/i.test(file.name)) {
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
