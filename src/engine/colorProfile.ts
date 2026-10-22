const PROFILE_MARKERS: { mime: RegExp; needle: string }[] = [
  { mime: /jpeg/, needle: 'ICC_PROFILE' },
  { mime: /png/, needle: 'iCCP' },
]

async function hasTiffProfile(file: File) {
  const header = new DataView(await file.slice(0,16).arrayBuffer())
  const little = header.getUint16(0) === 0x4949
  if (!little && header.getUint16(0) !== 0x4d4d) return false
  const magic = header.getUint16(2,little)
  if (magic !== 42 && magic !== 43) return false
  const big = magic === 43
  const offset = big ? Number(header.getBigUint64(8,little)) : header.getUint32(4,little)
  if (!Number.isSafeInteger(offset) || offset < 8 || offset >= file.size) return false
  const countBytes = big ? 8 : 2
  const countView = new DataView(await file.slice(offset,offset+countBytes).arrayBuffer())
  const count = big ? Number(countView.getBigUint64(0,little)) : countView.getUint16(0,little)
  if (!Number.isInteger(count) || count < 1 || count > 4096) return false
  const entrySize = big ? 20 : 12
  const entries = new DataView(await file.slice(offset+countBytes,offset+countBytes+count*entrySize).arrayBuffer())
  for (let i=0;i<count;i++) {
    const at=i*entrySize
    if (entries.getUint16(at,little) !== 34675) continue
    const length = big ? Number(entries.getBigUint64(at+4,little)) : entries.getUint32(at+4,little)
    const start = big ? Number(entries.getBigUint64(at+12,little)) : entries.getUint32(at+8,little)
    if (length < 128 || !Number.isSafeInteger(start) || start+length > file.size) return false
    return new TextDecoder().decode(await file.slice(start+36,start+40).arrayBuffer()) === 'acsp'
  }
  return false
}

async function hasPsdProfile(file: File) {
  const header = new DataView(await file.slice(0,30).arrayBuffer())
  if (header.getUint32(0) !== 0x38425053) return false
  const lengthAt = 30+header.getUint32(26)
  const length = new DataView(await file.slice(lengthAt,lengthAt+4).arrayBuffer()).getUint32(0)
  let at = lengthAt+4
  const end = at+length
  if (end > file.size) return false
  for (let blocks=0;at+12<=end && blocks<4096;blocks++) {
    const block = new DataView(await file.slice(at,at+7).arrayBuffer())
    if (block.getUint32(0) !== 0x3842494d) return false
    const resourceId = block.getUint16(4)
    const sizeAt = at+6+Math.ceil((block.getUint8(6)+1)/2)*2
    const size = new DataView(await file.slice(sizeAt,sizeAt+4).arrayBuffer()).getUint32(0)
    const start = sizeAt+4
    if (start+size > end) return false
    if (resourceId === 1039 && size >= 128) return new TextDecoder().decode(await file.slice(start+36,start+40).arrayBuffer()) === 'acsp'
    at = start+size+(size%2)
  }
  return false
}

/** Check container profile metadata without decoding the full image. */
export async function hasColorProfile(file: File): Promise<boolean> {
  try {
    if (/\.tiff?$/i.test(file.name) || file.type === 'image/tiff') return await hasTiffProfile(file)
    if (/\.psd$/i.test(file.name)) return await hasPsdProfile(file)
  const marker = PROFILE_MARKERS.find((m) => m.mime.test(file.type))
  if (!marker) return false
  const head = await file.slice(0, 262144).arrayBuffer()
  const text = new TextDecoder('latin1').decode(head)
  return text.includes(marker.needle)
  } catch { return false }
}

const HIDE_KEY = 'album-studio:hide-missing-color-profile'

export function isMissingColorProfileDialogHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

export function hideMissingColorProfileDialog(): void {
  try {
    localStorage.setItem(HIDE_KEY, '1')
  } catch {
    // Storage unavailable — the dialog will just show again next import.
  }
}
