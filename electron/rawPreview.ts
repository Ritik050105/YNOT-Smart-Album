import { open } from 'fs/promises'

export const RAW_EXT = /\.(cr2|cr3|crw|nef|nrw|arw|srf|sr2|dng|raf|orf|rw2|rwl|pef|srw|raw|3fr|erf|mef|mos|mrw|x3f|kdc|dcr|iiq|fff|cap)$/i
const SCAN_LIMIT = 48 * 1024 * 1024
const MIN_JPEG = 40 * 1024

/** Walks JPEG markers from an SOI at `start`; returns the index just past EOI, or -1 if not a complete, decodable (non-lossless) JPEG. */
function jpegEnd(b: Buffer, start: number): number {
  let i = start + 2
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return -1
    const m = b[i + 1]
    if (m === 0xff) { i++; continue }
    if (m === 0xd9) return i + 2
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd8)) { i += 2; continue }
    if (m === 0xc3 || m === 0xc7 || m === 0xcb || m === 0xcf) return -1 // lossless JPEG = raw sensor tiles in DNG, not a preview
    const len = b.readUInt16BE(i + 2)
    if (len < 2 || i + 2 + len > b.length) return -1
    i += 2 + len
    if (m === 0xda) { // entropy-coded data runs until the next real marker
      while (i + 1 < b.length && !(b[i] === 0xff && b[i + 1] !== 0 && b[i + 1] !== 0xff && !(b[i + 1] >= 0xd0 && b[i + 1] <= 0xd7))) i++
      if (i + 1 >= b.length) return -1
    }
  }
  return -1
}

/** Largest complete JPEG embedded in a RAW buffer (the camera preview), or null. */
export function extractRawJpeg(b: Buffer): Buffer | null {
  const sig = Buffer.from([0xff, 0xd8, 0xff])
  let best: Buffer | null = null
  for (let at = b.indexOf(sig); at >= 0; at = b.indexOf(sig, at + 3)) {
    const end = jpegEnd(b, at)
    if (end < 0) continue
    if (end - at >= MIN_JPEG && (!best || end - at > best.length)) best = b.subarray(at, end)
    at = end - 3 // nested thumbnails inside this JPEG are never the preview we want
  }
  return best
}

export async function extractRawJpegFromFile(file: string): Promise<Buffer | null> {
  const handle = await open(file, 'r')
  try {
    const { size } = await handle.stat()
    const buf = Buffer.alloc(Math.min(size, SCAN_LIMIT))
    await handle.read(buf, 0, buf.length, 0)
    return extractRawJpeg(buf)
  } finally { await handle.close() }
}
