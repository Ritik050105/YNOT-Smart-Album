import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import SpreadThumbnail from './SpreadThumbnail'

/** Drawing a spread means rendering it to a canvas, so a sixty-spread album would draw sixty of
 *  them the moment this panel opened — for the six that fit on screen. Each cell draws once it is
 *  near the viewport, and never undraws.
 *
 *  Measured rather than observed: an IntersectionObserver reports nothing until it has run its
 *  first callback, so anything that stops it firing leaves the visible cells blank. Reading the
 *  rectangle answers the same question now, and a scroll listener answers it again later. */
const MARGIN = 220
function LazyCell({ children }: { children: React.ReactNode }) {
  const host = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const check = () => {
      const box = el.getBoundingClientRect()
      if (box.bottom < -MARGIN || box.top > window.innerHeight + MARGIN) return false
      setNear(true)
      return true
    }
    if (check()) return
    const recheck = () => { if (check()) stop() }
    const stop = () => { document.removeEventListener('scroll', recheck, true); window.removeEventListener('resize', recheck) }
    document.addEventListener('scroll', recheck, true)
    window.addEventListener('resize', recheck)
    return stop
  }, [])
  return <div ref={host} className="spread-grid__cell">{near ? children : null}</div>
}

/** The sidebar's spread grid: every interior spread as a small page, in order, draggable to
 *  reorder. The timeline along the bottom of the editor reorders photos within and between
 *  spreads; this reorders the spreads themselves, which is the one thing that panel never did. */
export default function SpreadGrid() {
  const project = useProjectStore(s => s.project)
  const selectedSpreadId = useProjectStore(s => s.selectedSpreadId)
  const selectSpread = useProjectStore(s => s.selectSpread)
  const enterDesignerView = useProjectStore(s => s.enterDesignerView)
  const reorderSpreads = useProjectStore(s => s.reorderSpreads)
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  const spreads = project.spreads.filter(s => !s.isCover).sort((a, b) => a.order - b.order)
  const photosById = useMemo(() => new Map(project.photos.map(p => [p.id, p])), [project.photos])
  if (!spreads.length) return <p className="muted">No spreads yet. Drop photos onto the timeline to make one.</p>

  const drop = (to: number) => {
    if (dragging !== null && dragging !== to) reorderSpreads(dragging, to)
    setDragging(null); setOver(null)
  }

  return <ol className="spread-grid" aria-label="Spread grid">
    {spreads.map((spread, index) => (
      <li
        key={spread.id}
        className={`spread-grid__item ${spread.id === selectedSpreadId ? 'is-selected' : ''} ${over === index && dragging !== null && dragging !== index ? 'is-drop-target' : ''} ${dragging === index ? 'is-dragging' : ''}`}
        draggable
        onDragStart={e => { setDragging(index); e.dataTransfer.effectAllowed = 'move' }}
        onDragOver={e => { if (dragging === null) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(index) }}
        onDragLeave={() => setOver(current => (current === index ? null : current))}
        onDrop={e => { e.preventDefault(); drop(index) }}
        onDragEnd={() => { setDragging(null); setOver(null) }}
      >
        <button
          className="spread-grid__button"
          aria-current={spread.id === selectedSpreadId}
          title={`Spread ${index + 1} — click to select, double-click to open in the designer, drag to reorder`}
          onClick={() => selectSpread(spread.id)}
          onDoubleClick={() => enterDesignerView(spread.id)}
        >
          <LazyCell><SpreadThumbnail spread={spread} photosById={photosById} size={project.size} width={150} /></LazyCell>
          <span className="spread-grid__number">{index + 1}</span>
        </button>
      </li>
    ))}
  </ol>
}
