import ContextMenu from './ContextMenu'
import { openInEditor } from './ExternalEditor'
import { IMAGE_FILE_ACCEPT } from '@/engine/imageSource'
import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useProjectStore } from '@/state/projectStore'
import { useImportPhotos } from '@/engine/useImportPhotos'
import { describeImportSummary } from '@/engine/importWorkflow'
import { autoBuildTargetPhotoIds } from '@/engine/autoBuildTarget'
import { draggedPhotoIds } from '@/engine/photoDrag'
import { Spread } from '@/types'
import AutoBuildModal from './AutoBuildModal'
import Icon from './Icon'
import PatternsPanel from './PatternsPanel'

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

type QuickFilter = 'all' | 'unplaced' | 'placed' | 'favorites' | 'adjusted'
const QUICK_FILTERS: { id: QuickFilter; icon: 'image' | 'grid' | 'download' | 'heart' | 'wand'; title: string }[] = [
  { id: 'all', icon: 'image', title: 'All images' },
  { id: 'unplaced', icon: 'grid', title: 'Not yet placed' },
  { id: 'placed', icon: 'download', title: 'Placed in the album' },
  { id: 'favorites', icon: 'heart', title: 'Favorites' },
  { id: 'adjusted', icon: 'wand', title: 'Tone adjusted' },
]

type SortMode = 'time' | 'name' | 'bin'

/** Full-width photo dock at the bottom of the app — easiest spot to drag from onto the canvas
 *  above, and wide enough to show every imported photo in one scrollable row. Used photos (ones
 *  placed in a spread) are dimmed with a check badge; unplaced ones stay bright so what still
 *  needs placing is obvious at a glance. Photos can also be tagged into named "Bins" (Pixellu's
 *  term for custom photo collections — e.g. "Ceremony", "Getting Ready") and filtered by one.
 *
 *  Used images remain selectable and draggable so the same image can appear on multiple pages. */
export default function PhotoBin() {
  const photos = useProjectStore((s) => s.project.photos)
  const spreads = useProjectStore((s) => s.project.spreads)
  const setPlacementPhoto = useProjectStore((s) => s.setPlacementPhoto)
  const setPhotoBins = useProjectStore((s) => s.setPhotoBins)
  const setPhotoFavorite = useProjectStore((s) => s.setPhotoFavorite)
  const showFileNames = useProjectStore((s) => s.showPhotoFileNames)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectedPlaceholderId = useProjectStore((s) => s.selectedPlaceholderId)
  const selectedPhotoIds = useProjectStore((s) => s.selectedPhotoIds)
  const togglePhotoSelection = useProjectStore((s) => s.togglePhotoSelection)
  const selectSpread = useProjectStore((s) => s.selectSpread)
  const selectPlaceholder = useProjectStore((s) => s.selectPlaceholder)
  const zoom = useProjectStore((s) => s.photoDockZoom)
  const setZoom = useProjectStore((s) => s.setPhotoDockZoom)

  const { handleFiles, importing, progress, lastSummary } = useImportPhotos()
  const importInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [editorMenu,setEditorMenu]=useState<{x:number;y:number;src:string;name:string;photoId:string}|null>(null)
  const [browserTool, setBrowserTool] = useState<'search' | 'filter' | 'sort' | null>(null)
  const [descending, setDescending] = useState(false)
  const favoritesInputRef = useRef<HTMLInputElement>(null)
  const [autoBuildOpen, setAutoBuildOpen] = useState(false)
  const [patternsOpen, setPatternsOpen] = useState(false)
  const autoBuildTargets = autoBuildTargetPhotoIds(photos, spreads, selectedPhotoIds)

  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [binFilter, setBinFilter] = useState('')
  const [extraBins, setExtraBins] = useState<string[]>([])
  const [addingBin, setAddingBin] = useState(false)
  const [newBinDraft, setNewBinDraft] = useState('')
  const [sortBy, setSortBy] = useState<SortMode>('time')
  const [search, setSearch] = useState('')
  const [tagPopoverFor, setTagPopoverFor] = useState<string | null>(null)
  // Where to portal the bin popover — this dock sits at the very bottom of the window with a
  // horizontally-scrolling strip of thumbnails, so an in-place `position: absolute` popover gets
  // clipped by that scroll container's own overflow (nearly invisible below the strip's edge).
  // Portaling to <body> with a measured, fixed position avoids that entirely.
  const [tagPopoverAnchor, setTagPopoverAnchor] = useState<{ left: number; bottom: number } | null>(null)
  const [newBinName, setNewBinName] = useState('')

  const usedPhotoIds = useMemo(
    () => new Set(spreads.flatMap((s) => [...s.placements.map((p) => p.photoId), s.backgroundPattern?.edits?.photoId].filter((id): id is string => !!id))),
    [spreads]
  )

  const adjustedPhotoIds = useMemo(() => {
    const ids = new Set<string>()
    for (const spread of spreads) {
      for (const p of spread.placements) {
        if (p.photoId && (p.warmth !== 0 || p.brightness !== 0 || p.contrast !== 0 || p.saturation !== 0 || p.relightIntensity !== 0)) {
          ids.add(p.photoId)
        }
      }
    }
    return ids
  }, [spreads])

  const allBins = useMemo(
    () => Array.from(new Set([...photos.flatMap((p) => p.bins), ...extraBins])).sort(),
    [photos, extraBins]
  )

  useEffect(() => {
    if (!tagPopoverFor) return
    const close = () => setTagPopoverFor(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [tagPopoverFor])

  const importButtons = (
    <div className="photo-dock__import-actions">
      <div className="photo-dock__mode-tabs">
        <button className="is-active" title="Images" aria-label="Images" aria-pressed="true"><Icon name="image" size={20} /></button>
        <button title="Patterns" aria-label="Patterns" onClick={() => setPatternsOpen(true)}><Icon name="pattern" size={24} strokeWidth={4} /></button>
      </div>
      <input
        ref={importInputRef}
        type="file"
        accept={IMAGE_FILE_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <input ref={folderInputRef} type="file" multiple hidden
        // @ts-expect-error -- Chromium folder selection
        webkitdirectory=""
        onChange={(e) => { void handleFiles(e.target.files); e.target.value = '' }}
      />
      <input
        ref={favoritesInputRef}
        type="file"
        accept={IMAGE_FILE_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          void handleFiles(e.target.files, { markFavorite: true })
          e.target.value = ''
        }}
      />
      <button className="btn btn--tiny" aria-label="Import Images" title="Import Images" disabled={importing} onClick={() => importInputRef.current?.click()}>
        <Icon name="upload" size={12} />
        <span>Import Images</span>
      </button>
      <button className="btn btn--tiny" aria-label="Import Favorites" title="Import Favorites" disabled={importing} onClick={() => favoritesInputRef.current?.click()}>
        <Icon name="heart" size={12} />
        <span>Import Favorites</span>
      </button>
      <button
        aria-label="Auto Build" title="Auto Build"
        className={`btn btn--tiny ${autoBuildTargets.length > 0 ? 'btn--primary' : ''}`}
        disabled={autoBuildTargets.length === 0}
        onClick={() => setAutoBuildOpen(true)}
      >
        <Icon name="sparkles" size={12} />
        <span>Auto Build</span>
      </button>
      {autoBuildOpen && <AutoBuildModal photoIds={autoBuildTargets} onClose={() => setAutoBuildOpen(false)} />}
    </div>
  )

  if (patternsOpen) return <PatternsPanel onShowPhotos={() => setPatternsOpen(false)} />

  const filtered = photos
    .filter((p) => {
      if (quickFilter === 'unplaced') return !usedPhotoIds.has(p.id)
      if (quickFilter === 'placed') return usedPhotoIds.has(p.id)
      if (quickFilter === 'favorites') return p.favorite
      if (quickFilter === 'adjusted') return adjustedPhotoIds.has(p.id)
      return true
    })
    .filter((p) => (binFilter ? p.bins.includes(binFilter) : true))
    .filter((p) => (search.trim() ? p.fileName.toLowerCase().includes(search.trim().toLowerCase()) : true))

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.fileName.localeCompare(b.fileName)
    if (sortBy === 'bin') return (a.bins[0] ?? '').localeCompare(b.bins[0] ?? '')
    return new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
  })

  if (descending) sorted.reverse()

  const unplacedCount = photos.length - usedPhotoIds.size

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

  function confirmAddBin() {
    const name = newBinDraft.trim()
    if (name && !allBins.includes(name)) setExtraBins((prev) => [...prev, name])
    setNewBinDraft('')
    setAddingBin(false)
  }

  return (
    <div className={`photo-dock ${photos.length === 0 ? 'photo-dock--empty' : ''}`}>
      <div className="photo-dock__toolbar">
        {importButtons}
        <select className="photo-dock__filter-select" aria-label="Show photos" value={quickFilter} onChange={(e) => setQuickFilter(e.target.value as QuickFilter)}>
          {QUICK_FILTERS.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
        </select>
        <div className="photo-dock__bins">
          <span className="photo-dock__bins-label">
            <Icon name="grid" size={13} />
            Bins
          </span>
          <button className={!binFilter ? 'is-active' : ''} onClick={() => setBinFilter('')}>
            All ({photos.length})
          </button>
          {allBins.map((b) => (
            <button key={b} className={binFilter === b ? 'is-active' : ''} onClick={() => setBinFilter(b)}>
              {b} ({photos.filter((p) => p.bins.includes(b)).length})
            </button>
          ))}
          {addingBin ? (
            <input
              autoFocus
              className="photo-dock__bin-input"
              value={newBinDraft}
              placeholder="Bin name…"
              onChange={(e) => setNewBinDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmAddBin()}
              onBlur={confirmAddBin}
            />
          ) : (
            <button className="btn btn--icon btn--tiny" title="Add bin" onClick={() => setAddingBin(true)}>
              <Icon name="plus" size={11} />
            </button>
          )}
        </div>
        <label className="photo-dock__inline-sort">Sort:
          <select aria-label="Photo order" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortMode)}>
            <option value="time">Sort by time taken</option><option value="name">Sort by file name</option><option value="bin">Sort by bin</option>
          </select>
        </label>
        <div className="photo-dock__tools" role="group" aria-label="Photo browser tools">
          {(['search', 'filter', 'sort'] as const).map((tool) => (
            <button key={tool} className={`btn btn--icon ${browserTool === tool || (tool === 'search' && search.trim()) || (tool === 'filter' && (quickFilter !== 'all' || binFilter)) ? 'is-active' : ''}`}
              title={`${tool[0].toUpperCase() + tool.slice(1)} photos`} aria-label={`${tool[0].toUpperCase() + tool.slice(1)} photos`}
              aria-expanded={browserTool === tool} aria-controls="photo-browser-options"
              onClick={() => setBrowserTool(browserTool === tool ? null : tool)}>
              <Icon name={tool} size={20} />
            </button>
          ))}
          <span className="photo-dock__tool-divider" />
          <button className="btn btn--icon" title="Import folder" aria-label="Import folder" disabled={importing}
            onClick={() => folderInputRef.current?.click()}><Icon name="folder" size={21} /></button>
        </div>

        <input
          className="photo-dock__zoom"
          type="range"
          min={56}
          max={160}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          title="Thumbnail size — also adjustable by dragging the dock's top edge"
        />

        <span className="muted photo-dock__count">
          {photos.length} total · {unplacedCount} unplaced
          {selectedPhotoIds.length > 0 && ` · ${selectedPhotoIds.length} selected`}
        </span>
      </div>

      <div className="photo-dock__status muted" role="status">
        {importing && progress ? `Importing ${progress.done} of ${progress.total}…` : lastSummary ? describeImportSummary(lastSummary) : ''}
        {(search.trim() || quickFilter !== 'all' || binFilter) && <> · Filters active <button className="btn btn--tiny" onClick={() => { setSearch(''); setQuickFilter('all'); setBinFilter('') }}>Clear all filters</button></>}
      </div>
      {browserTool && <div id="photo-browser-options" className="photo-dock__options">
        {browserTool === 'search' && <div className="photo-dock__search">
          <Icon name="search" size={14} />
          <input autoFocus aria-label="Search photo filenames" placeholder="Search filenames…" value={search}
            onChange={(e) => setSearch(e.target.value)} />
          <button className="btn btn--icon btn--tiny" aria-label="Clear search" onClick={() => setSearch('')}><Icon name="x" size={12} /></button>
        </div>}
        {browserTool === 'filter' && <div className="photo-dock__tabs">
          {QUICK_FILTERS.map((f) => <button key={f.id} className={quickFilter === f.id ? 'is-active' : ''}
            aria-pressed={quickFilter === f.id} onClick={() => setQuickFilter(f.id)}><Icon name={f.icon} size={14} /> {f.title}</button>)}
        </div>}
        {browserTool === 'sort' && <label className="photo-dock__sort">Sort photos:
          <select aria-label="Sort photos by" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortMode)}>
            <option value="time">Time taken</option><option value="name">File name</option><option value="bin">Bin</option>
          </select>
          <select aria-label="Sort direction" value={descending ? 'descending' : 'ascending'} onChange={(e) => setDescending(e.target.value === 'descending')}>
            <option value="ascending">Ascending</option><option value="descending">Descending</option>
          </select>
        </label>}
        {(search || quickFilter !== 'all' || binFilter) && <button className="btn btn--tiny" onClick={() => { setSearch(''); setQuickFilter('all'); setBinFilter('') }}>Reset filters</button>}
        <button className="btn btn--icon btn--tiny" aria-label="Close photo options" onClick={() => setBrowserTool(null)}><Icon name="x" size={14} /></button>
      </div>}

      <div className="photo-dock__strip" tabIndex={0} aria-label="Image browser"
        onKeyDown={(event) => {
          if (event.target instanceof HTMLInputElement) return
          const ids = sorted.map((photo) => photo.id)
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
            event.preventDefault()
            useProjectStore.getState().setSelectedPhotoIds(ids, ids[0] ?? null)
          } else if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            const focused = (event.target as HTMLElement).closest<HTMLElement>('[data-dock-photo]')?.dataset.dockPhoto
            const current = ids.indexOf(focused ?? selectedPhotoIds.at(-1) ?? '')
            const next = current < 0 ? 0 : Math.max(0, Math.min(ids.length - 1, current + (event.key === 'ArrowLeft' ? -1 : 1)))
            const id = ids[next]
            if (!id) return
            event.preventDefault()
            togglePhotoSelection(id, ids, event.shiftKey ? 'range' : 'single')
            const item = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-dock-photo]')).find((node) => node.dataset.dockPhoto === id)
            item?.focus({ preventScroll: true })
            item?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
          }
        }} style={{ '--photo-size': `${zoom}px` } as CSSProperties}>
        {sorted.map((photo) => {
          const used = usedPhotoIds.has(photo.id)
          const selected = selectedPhotoIds.includes(photo.id)
          return (
            <div
              key={photo.id}
                className={`photo-dock__item ${used ? 'is-used' : 'is-unused'} ${selected ? 'is-selected' : ''}`}
                data-dock-photo={photo.id}
                onContextMenu={e=>{e.preventDefault();setEditorMenu({x:e.clientX,y:e.clientY,src:photo.src,name:photo.fileName,photoId:photo.id})}}
              aria-label={`${photo.fileName}${used ? ' — used in album; drag to reuse' : ''}`}
              style={{ width: `calc(var(--photo-size, 120px) * ${Math.min(1.7, Math.max(0.45, photo.width / photo.height || 1))})` }}
              tabIndex={-1}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-photo-id', photo.id)
                e.dataTransfer.setData('application/x-photo-ids', JSON.stringify(draggedPhotoIds(photo.id, selectedPhotoIds, sorted.map((p) => p.id))))
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={(e) => {
                e.currentTarget.focus({ preventScroll: true })
                const mode = e.shiftKey ? 'range' : e.ctrlKey || e.metaKey ? 'toggle' : 'single'
                togglePhotoSelection(photo.id, sorted.map((p) => p.id), mode)
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
              {showFileNames && <span className="photo-dock__filename">{photo.fileName}</span>}
              <button
                className={`photo-dock__fav-btn ${photo.favorite ? 'is-favorite' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setPhotoFavorite(photo.id, !photo.favorite)
                }}
                title={photo.favorite ? 'Remove from favorites' : 'Mark as favorite'}
              >
                <Icon name="heart" size={11} />
              </button>
              <button
                className="photo-dock__tag-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  if (tagPopoverFor === photo.id) {
                    setTagPopoverFor(null)
                    return
                  }
                  const rect = e.currentTarget.getBoundingClientRect()
                  setTagPopoverAnchor({ left: rect.left, bottom: window.innerHeight - rect.top + 6 })
                  setTagPopoverFor(photo.id)
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
              {tagPopoverFor === photo.id &&
                tagPopoverAnchor &&
                createPortal(
                  <div
                    className="bin-popover"
                    style={{ left: Math.min(tagPopoverAnchor.left, window.innerWidth - 196), bottom: tagPopoverAnchor.bottom }}
                    onClick={(e) => e.stopPropagation()}
                  >
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
                  </div>,
                  document.body
                )}
            </div>
          )
        })}
        {editorMenu && <ContextMenu x={editorMenu.x} y={editorMenu.y} onClose={()=>setEditorMenu(null)} items={(['photoshop','canva'] as const).map(app=>({label:app==='photoshop'?'Open in Adobe Photoshop':'Open in Canva',onClick:()=>openInEditor({app,src:editorMenu.src,name:editorMenu.name,photoId:editorMenu.photoId})}))}/>}
        {photos.length === 0 ? <button className="photo-dock__dropzone" disabled={importing}
          onClick={() => importInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
          onDrop={e => { e.preventDefault(); e.stopPropagation(); if (!importing) void handleFiles(e.dataTransfer.files) }}>
          <span className="photo-dock__drop-icon"><Icon name="image" size={100} /><span>+</span></span>
          <span>Drop images here to import them into the project.</span>
        </button> : sorted.length === 0 && <p className="muted photo-dock__empty">No photos match this filter.</p>}
      </div>
    </div>
  )
}
