import { useRef } from 'react'
import { useProjectStore } from '@/state/projectStore'
import SpreadThumbnail from './SpreadThumbnail'
import Icon from './Icon'

const THUMB_WIDTH = 68

/** View menu's "Timeline" panel — a horizontal strip of every spread (reusing the same
 *  lightweight thumbnail the Spreads panel uses) for quickly scrubbing through the album, plus
 *  the "Match Timeline Order" Auto-Build setting the reference app shows alongside it. Rearranging
 *  *within* a spread only matters once it has a mix of photo orientations — Auto-Build is the only
 *  thing that actually places photos into slots, so this panel's control takes effect on the next
 *  Auto-Build run rather than reshuffling an already-built spread live. */
export default function TimelinePanel() {
  const showTimelinePanel = useProjectStore((s) => s.showTimelinePanel)
  const project = useProjectStore((s) => s.project)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectSpread = useProjectStore((s) => s.selectSpread)
  const autoLayoutOptions = useProjectStore((s) => s.autoLayoutOptions)
  const setAutoLayoutOptions = useProjectStore((s) => s.setAutoLayoutOptions)
  const runAutoBuild = useProjectStore((s) => s.runAutoBuild)
  const stripRef = useRef<HTMLDivElement>(null)

  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const spreads = [...project.spreads].sort((a, b) => a.order - b.order)
  const selected = project.spreads.find((s) => s.id === selectedSpreadId)
  const selectedOrientations = new Set(
    selected?.placements
      .map((p) => (p.photoId ? photosById.get(p.photoId)?.orientation : undefined))
      .filter((o): o is NonNullable<typeof o> => !!o)
  )
  const hasMixedOrientations = selectedOrientations.has('landscape') && selectedOrientations.has('portrait')

  function scroll(dir: -1 | 1) {
    stripRef.current?.scrollBy({ left: dir * (THUMB_WIDTH + 40), behavior: 'smooth' })
  }

  if (!showTimelinePanel || spreads.length === 0) return null

  const rearrangeHint = hasMixedOrientations
    ? 'Rearrange Timeline: this spread has a mix of vertical and horizontal images.'
    : 'Rearrange Timeline: can be rearranged only if there is a mix of vertical and horizontal images.'

  return (
    <div className="timeline-panel">
      <div className="timeline-panel__strip-row" title={rearrangeHint}>
        <button className="btn btn--icon btn--tiny" onClick={() => scroll(-1)} title="Scroll left">
          <Icon name="chevronLeft" size={12} />
        </button>
        <div className="timeline-panel__strip" ref={stripRef}>
          {spreads.map((spread) => (
            <button
              key={spread.id}
              className={`timeline-panel__thumb ${spread.id === selectedSpreadId ? 'is-selected' : ''}`}
              onClick={() => selectSpread(spread.id)}
              title={spread.isCover ? 'Cover' : `Spread`}
            >
              <SpreadThumbnail spread={spread} photosById={photosById} size={project.size} width={THUMB_WIDTH} />
            </button>
          ))}
        </div>
        <button className="btn btn--icon btn--tiny" onClick={() => scroll(1)} title="Scroll right">
          <Icon name="chevronRight" size={12} />
        </button>
      </div>

      <div className="timeline-panel__rearrange">
        <span className="timeline-panel__label">Match Timeline Order:</span>
        <label className="checkbox-row" style={{ marginTop: 0 }}>
          <input
            type="checkbox"
            checked={autoLayoutOptions.matchTimelineOrder}
            onChange={(e) => setAutoLayoutOptions({ matchTimelineOrder: e.target.checked })}
          />
          Keep photos in strict chronological order
        </label>
        <button className="btn btn--tiny" title="Re-run Auto-Build with this setting" onClick={runAutoBuild}>
          <Icon name="sparkles" size={11} />
          Re-run Auto-Build
        </button>
      </div>
    </div>
  )
}
