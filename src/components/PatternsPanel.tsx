import { useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { BackgroundPattern, builtInPatterns, isBackgroundPattern } from '@/engine/patterns'
import { IMAGE_FILE_ACCEPT, imageFileSource } from '@/engine/imageSource'
import ContextMenu from './ContextMenu'
import Icon from './Icon'

export default function PatternsPanel({ onShowPhotos }: { onShowPhotos: () => void }) {
  const project = useProjectStore((s) => s.project)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const updateSpread = useProjectStore((s) => s.updateSpread)
  const applyToAll = useProjectStore((s) => s.applyBackgroundToAllSpreads)
  const [patterns, setPatterns] = useState(() => {
    const defaults = builtInPatterns()
    try {
      const stored = JSON.parse(localStorage.getItem('albumstudio.patterns') ?? '[]')
      return [...defaults, ...(Array.isArray(stored) ? stored.filter(isBackgroundPattern) : [])]
    } catch { return defaults }
  })
  const [error, setError] = useState('')
  const [menu, setMenu] = useState<{ x: number; y: number; pattern: BackgroundPattern } | null>(null)
  const target = project.spreads.find((s) => s.id === selectedSpreadId) ?? project.spreads.find((s) => !s.isCover)
  function apply(pattern?: BackgroundPattern) {
    if (target) updateSpread(target.id, { backgroundPattern: pattern })
  }
  async function importPattern(file?: File) {
    if (!file) return
    setError('')
    let src = ''
    try {
      src = await imageFileSource(file)
      const image = new Image()
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not read this pattern image.')); image.src = src })
      const canvas = document.createElement('canvas')
      const ratio = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight))
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Pattern preview unavailable.')
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      const pattern = { name: file.name, src: canvas.toDataURL(), tileSizePx: 128 }
      setPatterns((current) => [...current.filter((p) => p.name !== pattern.name), pattern])
      try {
        const stored = JSON.parse(localStorage.getItem('albumstudio.patterns') ?? '[]')
        const current: BackgroundPattern[] = Array.isArray(stored) ? stored.filter(isBackgroundPattern) : []
        localStorage.setItem('albumstudio.patterns', JSON.stringify([...current.filter((p) => p.name !== pattern.name), pattern]))
      } catch { setError('Pattern imported for this session; the pattern library could not be saved.') }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not import this pattern.') }
    finally { if (src.startsWith('blob:')) URL.revokeObjectURL(src) }
  }
  return <div className="photo-dock">
    <div className="photo-dock__toolbar">
      <button className="btn btn--tiny" onClick={onShowPhotos}><Icon name="image" size={14} />Images</button>
      <strong>Patterns</strong>
      <label className="btn btn--tiny">Import Pattern<input type="file" accept={IMAGE_FILE_ACCEPT} hidden onChange={(e) => { void importPattern(e.target.files?.[0]); e.target.value = '' }} /></label>
      <button className="btn btn--tiny" disabled={!target} onClick={() => apply()}>Remove Pattern</button>
      {target?.backgroundPattern && <label>Scale<input type="range" min={8} max={512} value={target.backgroundPattern.tileSizePx} onChange={(e) => apply({ ...target.backgroundPattern!, tileSizePx: Number(e.target.value) })} /></label>}
      {error && <span role="alert">{error}</span>}
    </div>
    <div className="pattern-strip">{patterns.map((pattern) => <button key={pattern.name} className="pattern-tile" draggable title={`${pattern.name} — drag onto a spread or double-click to apply`}
      style={{ backgroundImage: `url("${pattern.src}")`, backgroundSize: `${pattern.tileSizePx}px` }}
      onDragStart={(e) => e.dataTransfer.setData('application/x-album-pattern', JSON.stringify(pattern))}
      onDoubleClick={() => apply(pattern)} onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, pattern }) }}><span>{pattern.name}</span></button>)}</div>
    {menu && <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)} items={[
      { label: 'Apply to Selected Spread', disabled: !target, onClick: () => apply(menu.pattern) },
      { label: 'Apply to All Interior Spreads', disabled: !target, onClick: () => { if (target) applyToAll(target.id, menu.pattern) } },
    ]} />}
  </div>
}
