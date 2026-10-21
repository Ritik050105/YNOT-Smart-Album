const PROFILE_MARKERS: { mime: RegExp; needle: string }[] = [
  { mime: /jpeg/, needle: 'ICC_PROFILE' },
  { mime: /png/, needle: 'iCCP' },
]

/** Lightweight sniff for an embedded ICC color profile — reads just the first chunk of the file
 *  and looks for the format's own profile marker (JPEG's "ICC_PROFILE" APP2 segment, PNG's
 *  "iCCP" chunk) rather than fully parsing the container. Profiles sit near the start of both
 *  formats, so this is reliable without decoding the whole file; formats we don't specifically
 *  check (webp, tiff, raw, psd…) are reported as having no profile, matching how rarely casual
 *  exports in those formats carry one. */
export async function hasColorProfile(file: File): Promise<boolean> {
  const marker = PROFILE_MARKERS.find((m) => m.mime.test(file.type))
  if (!marker) return false
  const head = await file.slice(0, 262144).arrayBuffer()
  const text = new TextDecoder('latin1').decode(head)
  return text.includes(marker.needle)
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
