import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { Spread } from '@/types'
import Icon from './Icon'

/** Picks where a double-clicked photo (with nothing pre-selected) should land: the current
 *  spread's first empty frame if there is one, otherwise the first empty frame in album order. */
function findFirstEmptyPlaceholder(
  spreads: Spread[],
  preferredSpreadId: string | null
): { spreadId: string; placeholderId: string } | null {
  const ordered = preferredSpreadId
    ? [...spreads].sort((a, b) => (a.id === preferredSpreadId ? -1 : b.id === preferredSpreadId ? 1 : 0))
    : spreads
  for (const spread of ordered) {
    const empty = spread.placements.find((p) => !p.photoId)
    if (empty) return { spreadId: spread.id, placeholderId: empty.placeholderId }
  }
  return null
}

/** Full-width photo dock at the bottom of the app — easiest spot to drag from onto the canvas
 *  above, and wide enough to show every imported photo in one scrollable row. Used photos (ones
 *  placed in a spread) are dimmed with a check badge; unplaced ones stay bright so what still
 *  needs placing is obvious at a glance. Photos can also be tagged into named "Bins" (Pixellu's
 *  term for custom photo collections — e.g. "Ceremony", "Getting Ready") and filtered by one. */
export default function PhotoBin() {
  const photos = useProjectStore((s) => s.project.photos)
  const spreads = useProjectStore((s) => s.project.spreads)
  const setPlacementPhoto = useProjectStore((s) => s.setPlacementPhoto)
  const setPhotoBins = useProjectStore((s) => s.setPhotoBins)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectedPlaceholderId = useProjectStore((s) => s.selectedPlaceholderId)
  const selectedPhotoIds = useProjectStore((s) => s.selectedPhotoIds)
  const togglePhotoSelection = useProjectStore((s) => s.togglePhotoSelection)
  const selectSpread = useProjectStore((s) => s.selectSpread)
  const selectPlaceholder = useProjectStore((s) => s.selectPlaceholder)

  const [binFilter, setBinFilter] = useState('')
  const [tagPopoverFor, setTagPopoverFor] = useState<string | null>(null)
  const [newBinName, setNewBinName] = useState('')

  const sorted = useMemo(
    () => [...photos].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()),
    [photos]
  )

  const usedPhotoIds = useMemo(
    () => new Set(spreads.flatMap((s) => s.placements.map((p) => p.photoId).filter((id): id is string => !!id))),
    [spreads]
  )

  const allBins = useMemo(() => Array.from(new Set(photos.flatMap((p) => p.bins))).sort(), [photos])

  useEffect(() => {
    if (!tagPopoverFor) return
    const close = () => setTagPopoverFor(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [tagPopoverFor])

  if (sorted.length === 0) return null

  const visible = binFilter ? sorted.filter((p) => p.bins.includes(binFilter)) : sorted
  const unplacedCount = sorted.length - usedPhotoIds.size

  function toggleBin(photoId: string, bin: string) {
    const photo = photos.find((p) => p.id === photoId)
    if (!photo) return
    const bins = photo.bins.includes(bin) ? photo.bins.filter((b) => b !== bin) : [...photo.bins, bin]
    setPhotoBins(photoId, bins)
  }

  function addNewBin(photoId: string) {
    const name = newBinName.trim()
    if (!name) return
    const photo = photos.find((p) => p.id === photoId)
    if (!photo || photo.bins.includes(name)) return
    setPhotoBins(photoId, [...photo.bins, name])
    setNewBinName('')
  }

  return (
    <div className="photo-dock">
      <div className="photo-dock__header">
        <Icon name="layers" size={14} />
        <span>Photos</span>
        <div className="bin-select-row">
          <select value={binFilter} onChange={(e) => setBinFilter(e.target.value)}>
            <option value="">All bins</option>
            {allBins.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <span className="muted">
          {sorted.length} total · {unplacedCount} unplaced
          {selectedPhotoIds.length > 0 && ` · ${selectedPhotoIds.length} selected`}
        </span>
        {selectedPhotoIds.length === 1 && <span className="muted photo-dock__hint">Click a frame on the canvas to place it</span>}
      </div>
      <div className="photo-dock__strip">
        {visible.map((photo) => {
          const used = usedPhotoIds.has(photo.id)
          const selected = selectedPhotoIds.includes(photo.id)
          return (
            <div
              key={photo.id}
              className={`photo-dock__item ${used ? 'is-used' : 'is-unused'} ${selected ? 'is-selected' : ''}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-photo-id', photo.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={(e) => {
                const mode = e.shiftKey ? 'range' : e.ctrlKey || e.metaKey ? 'toggle' : 'single'
                togglePhotoSelection(photo.id, visible.map((p) => p.id), mode)
              }}
              onDoubleClick={() => {
                // Quick-place: double-click drops this photo into the selected slot, or — if
                // nothing's selected yet — the first empty frame (current spread first, then the
                // album's next spread with room), so double-click "just works" without first
                // having to click a frame.
                if (selectedSpreadId && selectedPlaceholderId) {
                  setPlacementPhoto(selectedSpreadId, selectedPlaceholderId, photo.id)
                  return
                }
                const target = findFirstEmptyPlaceholder(spreads, selectedSpreadId)
                if (!target) return
                setPlacementPhoto(target.spreadId, target.placeholderId, photo.id)
                selectSpread(target.spreadId)
                selectPlaceholder(target.placeholderId)
              }}
              title={`${photo.fileName} — ${new Date(photo.capturedAt).toLocaleString()}${used ? ' (placed)' : ''} — double-click to quick-place, click to select then click a canvas frame, shift/ctrl+click to multi-select`}
            >
              <img src={photo.src} alt={photo.fileName} />
              <button
                className="photo-dock__tag-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setTagPopoverFor(tagPopoverFor === photo.id ? null : photo.id)
                }}
                title="Assign to bin"
              >
                <Icon name="plus" size={10} />
              </button>
              {photo.bins.length > 0 && (
                <div className="photo-dock__item-tag">
                  <span className="bin-chip">{photo.bins[0]}{photo.bins.length > 1 ? ` +${photo.bins.length - 1}` : ''}</span>
                </div>
              )}
              {used && (
                <span className="photo-dock__badge">
                  <Icon name="check" size={10} />
                </span>
              )}
              {tagPopoverFor === photo.id && (
                <div className="bin-popover" onClick={(e) => e.stopPropagation()}>
                  {allBins.map((b) => (
                    <label key={b}>
                      <input type="checkbox" checked={photo.bins.includes(b)} onChange={() => toggleBin(photo.id, b)} />
                      {b}
                    </label>
                  ))}
                  <input
                    type="text"
                    placeholder="New bin name…"
                    value={newBinName}
                    onChange={(e) => setNewBinName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addNewBin(photo.id)}
                  />
                  <button className="btn btn--tiny" onClick={() => addNewBin(photo.id)}>
                    Add Bin
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
