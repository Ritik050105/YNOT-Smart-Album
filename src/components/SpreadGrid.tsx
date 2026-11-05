import { useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import SpreadThumbnail from './SpreadThumbnail'

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
  const photosById = new Map(project.photos.map(p => [p.id, p]))
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
          <SpreadThumbnail spread={spread} photosById={photosById} size={project.size} width={150} />
          <span className="spread-grid__number">{index + 1}</span>
        </button>
      </li>
    ))}
  </ol>
}
