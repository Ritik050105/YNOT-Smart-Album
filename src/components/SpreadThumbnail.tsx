import { usePreferences } from '@/state/preferences'
import { useEffect, useRef, useState } from 'react'
import { Spread, PhotoAsset, AlbumSize } from '@/types'
import { computePlaceholderBoxes } from '@/engine/layoutMath'
import { renderSpreadToCanvas } from '@/engine/renderSpread'

interface Props {
  spread: Spread
  photosById: Map<string, PhotoAsset>
  size: AlbumSize
  width?: number
  responsive?: boolean
  selectedPlaceholderId?: string | null
}

/** Use the export renderer so crops, text, flips and adjustments survive leaving Designer View. */
export default function SpreadThumbnail({ spread, photosById, size, width = 420, responsive, selectedPlaceholderId }: Props) {
  const highResolution=usePreferences(s=>s.values.highResolution)
  size = spread.size ?? size
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  const [renderWidth, setRenderWidth] = useState(width)
  useEffect(() => {
    const element = canvasRef.current?.parentElement
    if (!responsive || !element) { setRenderWidth(width); return }
    const observer = new ResizeObserver(() => setRenderWidth(Math.min(2400, Math.max(width, Math.ceil(element.clientWidth * window.devicePixelRatio)))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [responsive, width])
  useEffect(() => {
    let cancelled = false
    setFailed(false)
    void renderSpreadToCanvas(spread, photosById, size, (highResolution ? renderWidth : Math.min(420,renderWidth)) / size.widthIn).then((rendered) => {
      const canvas = canvasRef.current
      if (cancelled || !canvas) return
      canvas.width = rendered.width
      canvas.height = rendered.height
      canvas.getContext('2d')?.drawImage(rendered, 0, 0)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [spread, photosById, size, renderWidth, highResolution])

  const previewHeight = 100 * size.heightIn / size.widthIn
  const selectedBox = computePlaceholderBoxes(spread, 100, previewHeight).find(box => box.placeholderId === selectedPlaceholderId)
  const selectedPlacement = spread.placements.find(p => p.placeholderId === selectedPlaceholderId)

  return (
    <div className="spread-thumb" style={{ width: responsive ? '100%' : width, aspectRatio: size.widthIn / size.heightIn, background: spread.backgroundHidden ? '#fff' : spread.backgroundColor }}>
      <canvas ref={canvasRef} role="img" aria-label="Spread preview" style={{ width: '100%', height: '100%', display: 'block' }} />
      {!spread.isCover && spread.pageSide === 'spread' && <span className="spread-thumb__fold" aria-hidden="true" />}
      {selectedBox && !selectedPlacement?.hidden && <span className="spread-thumb__selection" aria-hidden="true" style={{ left: `${selectedBox.x}%`, top: `${selectedBox.y / previewHeight * 100}%`, width: `${selectedBox.width}%`, height: `${selectedBox.height / previewHeight * 100}%`, transform: `rotate(${selectedPlacement?.rotationDeg ?? 0}deg)` }} />}
      {failed && <span role="status">Preview unavailable</span>}
    </div>
  )
}
