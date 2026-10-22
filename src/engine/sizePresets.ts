import { AlbumSize } from '@/types'

const KEY = 'albumstudio.customSizePresets'

export interface SizePreset extends AlbumSize {
  presetName: string
  units?: 'in' | 'cm' | 'px'
  layoutStart?: 'spread' | 'single'
  layoutEnd?: 'spread' | 'single'
  includeFullSpreadTemplates?: boolean
}

export function loadSizePresets(): SizePreset[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SizePreset[]) : []
  } catch {
    return []
  }
}

function saveSizePresets(presets: SizePreset[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(presets))
  } catch {
    // Storage unavailable — presets just won't persist across sessions.
  }
}

export function addSizePreset(preset: SizePreset): SizePreset[] {
  const existing = loadSizePresets()
  const previous = existing.find(p => p.presetName === preset.presetName)
  const next = [...existing.filter(p => p.presetName !== preset.presetName), { ...previous, ...preset }]
  saveSizePresets(next)
  return next
}

export function deleteSizePreset(presetName: string): SizePreset[] {
  const next = loadSizePresets().filter((p) => p.presetName !== presetName)
  saveSizePresets(next)
  return next
}
