import { useMemo } from 'react'
import { useProjectStore } from '@/state/projectStore'
import Icon from './Icon'

/** Full-width photo dock at the bottom of the app — easiest spot to drag from onto the canvas
 *  above, and wide enough to show every imported photo in one scrollable row. Used photos (ones
 *  that in the album, i.e. placed in a spread) are dimmed with a check badge; unplaced ones stay
 *  bright so what still needs placing is obvious at a glance. */
export default function PhotoBin() {
  const photos = useProjectStore((s) => s.project.photos)
  const spreads = useProjectStore((s) => s.project.spreads)
  const setPlacementPhoto = useProjectStore((s) => s.setPlacementPhoto)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectedPlaceholderId = useProjectStore((s) => s.selectedPlaceholderId)

  const sorted = useMemo(
    () => [...photos].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()),
    [photos]
  )

  const usedPhotoIds = useMemo(
    () => new Set(spreads.flatMap((s) => s.placements.map((p) => p.photoId).filter((id): id is string => !!id))),
    [spreads]
  )

  if (sorted.length === 0) return null

  const unplacedCount = sorted.length - usedPhotoIds.size

  return (
    <div className="photo-dock">
      <div className="photo-dock__header">
        <Icon name="layers" size={14} />
        <span>Photos</span>
        <span className="muted">
          {sorted.length} total · {unplacedCount} unplaced
        </span>
      </div>
      <div className="photo-dock__strip">
        {sorted.map((photo) => {
          const used = usedPhotoIds.has(photo.id)
          return (
            <div
              key={photo.id}
              className={`photo-dock__item ${used ? 'is-used' : 'is-unused'}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-photo-id', photo.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onDoubleClick={() => {
                // Quick-place: double-click drops this photo into the currently selected slot.
                if (selectedSpreadId && selectedPlaceholderId) {
                  setPlacementPhoto(selectedSpreadId, selectedPlaceholderId, photo.id)
                }
              }}
              title={`${photo.fileName} — ${new Date(photo.capturedAt).toLocaleString()}${used ? ' (placed)' : ''}`}
            >
              <img src={photo.src} alt={photo.fileName} />
              {used && (
                <span className="photo-dock__badge">
                  <Icon name="check" size={10} />
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
