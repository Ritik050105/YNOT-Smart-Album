import { useEffect, useRef, useState } from 'react'
import { Spread, PhotoAsset, AlbumSize } from '@/types'
import { renderSpreadToCanvas } from '@/engine/renderSpread'

interface Props {
  spread: Spread
  photosById: Map<string, PhotoAsset>
  size: AlbumSize
  width?: number
  responsive?: boolean
}

/** Use the export renderer so crops, text, flips and adjustments survive leaving Designer View. */
export default function SpreadThumbnail({ spread, photosById, size, width = 420, responsive }: Props) {
  size = spread.size ?? size
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    setFailed(false)
    void renderSpreadToCanvas(spread, photosById, size, width / size.widthIn).then((rendered) => {
      const canvas = canvasRef.current
      if (cancelled || !canvas) return
      canvas.width = rendered.width
      canvas.height = rendered.height
      canvas.getContext('2d')?.drawImage(rendered, 0, 0)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [spread, photosById, size, width])

  return (
    <div className="spread-thumb" style={{ width: responsive ? '100%' : width, aspectRatio: size.widthIn / size.heightIn, background: spread.backgroundColor }}>
      <canvas ref={canvasRef} role="img" aria-label="Spread preview" style={{ width: '100%', height: '100%', display: 'block' }} />
      {failed && <span role="status">Preview unavailable</span>}
    </div>
  )
}
