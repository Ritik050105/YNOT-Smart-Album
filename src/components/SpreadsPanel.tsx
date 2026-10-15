import { useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import SpreadThumbnail from './SpreadThumbnail'

/** Left/right page rearrangement strip: reorder spreads by drag, click to open in the designer. */
export default function SpreadsPanel() {
  const project = useProjectStore((s) => s.project)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectSpread = useProjectStore((s) => s.selectSpread)
  const reorderSpreads = useProjectStore((s) => s.reorderSpreads)
  const splitSpread = useProjectStore((s) => s.splitSpread)
  const mergeWithNext = useProjectStore((s) => s.mergeWithNext)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const spreads = [...project.spreads].sort((a, b) => a.order - b.order)

  return (
    <div className="panel spreads-panel">
      <h3>Spreads ({spreads.length})</h3>
      <div className="spreads-panel__list">
        {spreads.map((spread, index) => (
          <div
            key={spread.id}
            className={`spreads-panel__item ${selectedSpreadId === spread.id ? 'is-selected' : ''}`}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex === null || dragIndex === index) return
              reorderSpreads(dragIndex, index)
              setDragIndex(null)
            }}
            onClick={() => selectSpread(spread.id)}
          >
            <SpreadThumbnail spread={spread} photosById={photosById} size={project.size} width={150} />
            <span className="spreads-panel__label">
              {index + 1}. {spread.pageSide} · {spread.placements.length} photo{spread.placements.length === 1 ? '' : 's'}
            </span>
            <div className="spreads-panel__actions">
              {spread.pageSide === 'spread' && (
                <button
                  className="btn btn--tiny"
                  onClick={(e) => {
                    e.stopPropagation()
                    splitSpread(spread.id)
                  }}
                >
                  Split
                </button>
              )}
              {index < spreads.length - 1 && (
                <button
                  className="btn btn--tiny"
                  onClick={(e) => {
                    e.stopPropagation()
                    mergeWithNext(spread.id)
                  }}
                >
                  Merge ↓
                </button>
              )}
            </div>
          </div>
        ))}
        {spreads.length === 0 && <p className="muted">Import photos and run Auto-Build to get started.</p>}
      </div>
    </div>
  )
}
