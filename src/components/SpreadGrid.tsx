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
  /** Where the drop would land: an index and which side of it, so the insertion line sits in the
   *  gap the spread will move into rather than outlining a card it is only passing over. */
  const [over, setOver] = useState<{ index: number; after: boolean } | null>(null)

  const spreads = project.spreads.filter(s => !s.isCover).sort((a, b) => a.order - b.order)
  const photosById = useMemo(() => new Map(project.photos.map(p => [p.id, p])), [project.photos])
  if (!spreads.length) return <p className="muted">No spreads yet. Drop photos onto the timeline to make one.</p>

  // First page number of each spread, so a card is labelled by the pages it prints as rather than
  // by its position in a list. A single-sided spread takes one page, a full spread two.
  let page = 1
  const firstPage = spreads.map(s => { const start = page; page += s.pageSide === 'spread' ? 2 : 1; return start })

  const drop = (index: number, after: boolean) => {
    const to = after ? index + 1 : index
    if (dragging !== null) {
      // Removing the dragged card first shifts everything after it down by one.
      const target = Math.max(0, Math.min(spreads.length - 1, dragging < to ? to - 1 : to))
      if (target !== dragging) reorderSpreads(dragging, target)
    }
    setDragging(null); setOver(null)
  }

  const move = (index: number, delta: number) => {
    const to = index + delta
    if (to < 0 || to >= spreads.length) return
    reorderSpreads(index, to)
    selectSpread(spreads[index].id)
  }

  return <>
    <ol className="spread-grid" aria-label="Spread grid" style={{ '--spread-aspect': project.size.widthIn / project.size.heightIn } as React.CSSProperties}>
      {spreads.map((spread, index) => {
        const photos = spread.placements.filter(p => p.photoId).length
        const pages = spread.pageSide === 'spread' ? `${firstPage[index]}–${firstPage[index] + 1}` : `${firstPage[index]}`
        return <li
          key={spread.id}
          className={`spread-grid__item ${spread.id === selectedSpreadId ? 'is-selected' : ''} ${dragging === index ? 'is-dragging' : ''} ${over && dragging !== null && over.index === index ? (over.after ? 'is-drop-after' : 'is-drop-before') : ''}`}
          draggable
          onDragStart={e => { setDragging(index); e.dataTransfer.effectAllowed = 'move' }}
          onDragOver={e => {
            if (dragging === null) return
            e.preventDefault(); e.dataTransfer.dropEffect = 'move'
            const r = e.currentTarget.getBoundingClientRect()
            const after = e.clientX > r.left + r.width / 2
            setOver(current => (current?.index === index && current.after === after ? current : { index, after }))
          }}
          onDragLeave={() => setOver(current => (current?.index === index ? null : current))}
          onDrop={e => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); drop(index, e.clientX > r.left + r.width / 2) }}
          onDragEnd={() => { setDragging(null); setOver(null) }}
        >
          <button
            className="spread-grid__button"
            aria-current={spread.id === selectedSpreadId}
            aria-label={`Spread ${index + 1}, page${spread.pageSide === 'spread' ? 's' : ''} ${pages}, ${photos} photo${photos === 1 ? '' : 's'}`}
            title={`Spread ${index + 1} — click to select, double-click to open, drag or Alt+arrow to reorder`}
            onClick={() => selectSpread(spread.id)}
            onDoubleClick={() => enterDesignerView(spread.id)}
            // Reorder is otherwise drag-only, which no keyboard reaches.
            onKeyDown={e => {
              if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
              e.preventDefault()
              move(index, e.key === 'ArrowLeft' ? -1 : 1)
            }}
          >
            <LazyCell><SpreadThumbnail spread={spread} photosById={photosById} size={project.size} width={150} responsive /></LazyCell>
            <span className="spread-grid__caption">
              <span className="spread-grid__number">{index + 1}</span>
              <span className="spread-grid__pages">p. {pages}</span>
              <span className="spread-grid__count">{photos}</span>
            </span>
          </button>
        </li>
      })}
    </ol>
    <p className="muted spread-grid__hint">Drag a spread to reorder, or hold Alt and press ← →.</p>
  </>
}
