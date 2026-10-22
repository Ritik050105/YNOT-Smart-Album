import { Spread } from '@/types'

export type BackgroundPattern = NonNullable<Spread['backgroundPattern']>

export function isBackgroundPattern(value: unknown): value is BackgroundPattern {
  if (!value || typeof value !== 'object') return false
  const pattern = value as Partial<BackgroundPattern>
  return typeof pattern.name === 'string' && typeof pattern.src === 'string' && /^data:image\/(png|jpeg);base64,/.test(pattern.src) && typeof pattern.tileSizePx === 'number' && Number.isFinite(pattern.tileSizePx) && pattern.tileSizePx >= 8 && pattern.tileSizePx <= 512
}

export function builtInPatterns(): BackgroundPattern[] {
  return ['Fine dots', 'Diagonal lines', 'Grid', 'Chevron'].map((name, index) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 16
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Pattern preview unavailable.')
    ctx.fillStyle = ctx.strokeStyle = '#9c6b49'
    ctx.globalAlpha = 0.25
    ctx.beginPath()
    if (index === 0) { ctx.arc(8, 8, 1, 0, Math.PI * 2); ctx.fill() }
    if (index === 1) { ctx.moveTo(0, 16); ctx.lineTo(16, 0); ctx.stroke() }
    if (index === 2) { ctx.moveTo(0, 16); ctx.lineTo(0, 0); ctx.lineTo(16, 0); ctx.stroke() }
    if (index === 3) { ctx.moveTo(-8, 4); ctx.lineTo(0, 12); ctx.lineTo(8, 4); ctx.lineTo(16, 12); ctx.lineTo(24, 4); ctx.stroke() }
    return { name, tileSizePx: 32, src: canvas.toDataURL('image/png') }
  })
}

export function readDraggedPattern(transfer: Pick<DataTransfer, 'getData'>): BackgroundPattern | null {
  try {
    const pattern = JSON.parse(transfer.getData('application/x-album-pattern'))
    return isBackgroundPattern(pattern) ? pattern : null
  } catch { return null }
}
