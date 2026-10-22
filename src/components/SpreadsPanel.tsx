import { IMAGE_FILE_ACCEPT } from '@/engine/imageSource'
import { CSSProperties, Fragment, useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { useImportPhotos } from '@/engine/useImportPhotos'
import { exportSingleSpreadToPdf } from '@/engine/exportAlbum'
import { readDraggedPhotoIds, readTimelineFrame } from '@/engine/photoDrag'
import { readDraggedPattern } from '@/engine/patterns'
import { useTimelineDrag } from '@/engine/useTimelineDrag'
import SpreadThumbnail from './SpreadThumbnail'
import ContextMenu, { ContextMenuItem } from './ContextMenu'
import Icon from './Icon'
import PhotoContextMenu from './PhotoContextMenu'
import { computePlaceholderBoxes } from '@/engine/layoutMath'

/** The album's main view — the reference app's own "all spreads" screen: a row of real,
 *  proportioned spread cards (not a zoomed single-spread canvas, no ruler or tool rail here),
 *  cover pinned first, a "drop images to create a new spread" card trailing. A single click
 *  selects a spread; double-click opens it in the focused Designer View to actually work on it —
 *  Escape (or its own back button) returns here. Reorder by drag. */
export default function SpreadsPanel() {
  const [photoMenu, setPhotoMenu] = useState<{ x: number; y: number; spreadId: string; frameId?: string; openedAt: number } | null>(null)
  const project = useProjectStore((s) => s.project)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectSpread = useProjectStore((s) => s.selectSpread)
  const reorderSpreads = useProjectStore((s) => s.reorderSpreads)
  const splitSpread = useProjectStore((s) => s.splitSpread)
  const moveTimelinePhoto = useProjectStore((s) => s.moveTimelinePhoto)
  const insertTimelinePhotos = useProjectStore((s) => s.insertTimelinePhotos)
  const updateSpread = useProjectStore((s) => s.updateSpread)
  const mergeWithNext = useProjectStore((s) => s.mergeWithNext)
  const flipSpread = useProjectStore((s) => s.flipSpread)
  const addCoverSpread = useProjectStore((s) => s.addCoverSpread)
  const duplicateSpread = useProjectStore((s) => s.duplicateSpread)
  const deleteSpread = useProjectStore((s) => s.deleteSpread)
  const enterDesignerView = useProjectStore((s) => s.enterDesignerView)
  const spreadClipboard = useProjectStore((s) => s.spreadClipboard)
  const copySpread = useProjectStore((s) => s.copySpread)
  const cutSpread = useProjectStore((s) => s.cutSpread)
  const pasteSpreadAfter = useProjectStore((s) => s.pasteSpreadAfter)
  const convertSpreadPageType = useProjectStore((s) => s.convertSpreadPageType)
  const applyTemplateToAllSpreads = useProjectStore((s) => s.applyTemplateToAllSpreads)
  const cycleSpreadTemplate = useProjectStore((s) => s.cycleSpreadTemplate)
  const openMatchingTemplates = useProjectStore(s => s.openMatchingTemplates)
  const templatePreview = useProjectStore(s => s.templatePreview)
  const { handleFiles } = useImportPhotos()
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; spreadId: string } | null>(null)
  const [coverDragOver, setCoverDragOver] = useState(false)
  const [newSpreadDragOver, setNewSpreadDragOver] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const newSpreadInputRef = useRef<HTMLInputElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const spreadsRef = useRef<HTMLDivElement>(null)
  const { drag, target } = useTimelineDrag((source, destination) => {
    if (source.spreadId && !source.frameId) {
      if (destination.cover) return
      const interiors = useProjectStore.getState().project.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order)
      reorderSpreads(interiors.findIndex((s) => s.id === source.spreadId), destination.spreadId === null ? interiors.length - 1 : interiors.findIndex((s) => s.id === destination.spreadId))
    }
    else if (destination.cover) placeCoverPhotos(source.photoIds)
    else if (source.spreadId && source.frameId) moveTimelinePhoto(source.spreadId, source.frameId, destination.spreadId, destination.beforeFrameId)
    else insertTimelinePhotos(source.photoIds, destination.spreadId, destination.beforeFrameId)
  })

  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const cover = project.spreads.find((s) => s.isCover)
  const spreads = project.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order).map(s => templatePreview?.id === s.id ? templatePreview : s)
  useEffect(() => {
    const group = Array.from(timelineRef.current?.children ?? []).find((el) => (el as HTMLElement).dataset.timelineSpread === selectedSpreadId)
    group?.scrollIntoView({ block: 'nearest', inline: 'center' })
    const card = Array.from(spreadsRef.current?.children ?? []).find((el) => (el as HTMLElement).dataset.overviewSpread === selectedSpreadId)
    card?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [selectedSpreadId])

  async function exportSpread(spread: typeof project.spreads[number]) {
    setExportingId(spread.id)
    try {
      await exportSingleSpreadToPdf(project, spread)
    } finally {
      setExportingId(null)
    }
  }

  async function handleCoverDrop(files: FileList | File[]) {
    const matched = await handleFiles(files)
    placeCoverPhotos(matched.map((p) => p.id))
  }

  function placeCoverPhotos(newIds: string[]) {
    if (newIds.length === 0) return
    window.dispatchEvent(new CustomEvent('album-studio:setup-cover', { detail: { photoIds: newIds } }))
  }

  async function handleNewSpreadDrop(files: FileList | File[]) {
    const matched = await handleFiles(files)
    insertTimelinePhotos(matched.map((p) => p.id), null)
  }

  async function handleTimelineFiles(files: FileList, spreadId: string, beforeFrameId?: string) {
    const matched = await handleFiles(files)
    insertTimelinePhotos(matched.map((p) => p.id), spreadId, beforeFrameId)
  }

  function handleSpreadDrop(e: React.DragEvent, spreadId: string, beforeFrameId?: string) {
    e.preventDefault()
    e.stopPropagation()
    const pattern = readDraggedPattern(e.dataTransfer)
    if (pattern) { updateSpread(spreadId, { backgroundPattern: pattern }); return }
    const frame = readTimelineFrame(e.dataTransfer)
    const photoIds = readDraggedPhotoIds(e.dataTransfer, project.photos.map((p) => p.id))
    if (frame) moveTimelinePhoto(frame.spreadId, frame.frameId, spreadId, beforeFrameId)
    else if (photoIds.length) insertTimelinePhotos(photoIds, spreadId, beforeFrameId)
    else if (e.dataTransfer.files.length) void handleTimelineFiles(e.dataTransfer.files, spreadId, beforeFrameId)
  }

  function openContextMenu(e: React.MouseEvent, spreadId: string) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, spreadId })
  }

  function contextMenuItems(spreadId: string): ContextMenuItem[] {
    const spread = project.spreads.find((s) => s.id === spreadId)
    if (!spread) return []
    if (spread.isCover) {
      return [
        { label: 'Edit in Designer View', onClick: () => enterDesignerView(spreadId) },
        { label: 'Flip Cover Horizontally', onClick: () => flipSpread(spreadId) },
        { label: 'Export Cover…', onClick: () => void exportSpread(spread) },
        { label: 'Delete Cover', danger: true, onClick: () => deleteSpread(spreadId) },
      ]
    }
    const index = spreads.findIndex((s) => s.id === spreadId)
    return [
      { label: 'Cut', onClick: () => cutSpread(spreadId) },
      { label: 'Copy', onClick: () => copySpread(spreadId) },
      { label: 'Paste', disabled: !spreadClipboard, onClick: () => pasteSpreadAfter(spreadId) },
      { label: 'Delete Spread', danger: true, onClick: () => setConfirmDeleteId(spreadId) },
      {
        label: spread.pageSide === 'spread' ? 'Convert to Single Page/Side' : 'Convert to Full Spread',
        onClick: () => convertSpreadPageType(spreadId),
      },
      { label: 'Flip Spread Horizontally', onClick: () => flipSpread(spreadId) },
      {
        label: 'Apply Template to All Spreads',
        onClick: () => applyTemplateToAllSpreads(spread.templateId),
      },
      { label: 'Edit in Designer View', onClick: () => enterDesignerView(spreadId) },
      { label: 'Export Spread…', onClick: () => void exportSpread(spread) },
      {
        label: 'Split Spread',
        disabled: spread.pageSide !== 'spread',
        onClick: () => splitSpread(spreadId),
      },
      {
        label: 'Merge With Next',
        disabled: index === -1 || index === spreads.length - 1,
        onClick: () => mergeWithNext(spreadId),
      },
      { label: 'Duplicate Spread', onClick: () => duplicateSpread(spreadId) },
    ]
  }

  return (
    <div className={`spreads-panel ${project.spreads.length === 0 ? 'spreads-panel--empty' : ''}`} style={{ '--spread-aspect': project.size.widthIn / project.size.heightIn } as CSSProperties}>
      <div ref={spreadsRef} className="spreads-panel__row">
        {cover ? (
          <div
            className={`spreads-panel__card spreads-panel__card--cover ${selectedSpreadId === cover.id ? 'is-selected' : ''}`}
            data-overview-spread={cover.id}
            style={{ aspectRatio: (cover.size ?? project.size).widthIn / (cover.size ?? project.size).heightIn }}
            onClick={e => {
              const r = e.currentTarget.getBoundingClientRect()
              const box = computePlaceholderBoxes(cover, r.width, r.height).reverse().find(b => e.clientX-r.left >= b.x && e.clientX-r.left <= b.x+b.width && e.clientY-r.top >= b.y && e.clientY-r.top <= b.y+b.height)
              selectSpread(cover.id)
              if (box) useProjectStore.getState().selectPlaceholder(box.placeholderId)
            }}
            onDoubleClick={() => enterDesignerView(cover.id)}
            onContextMenu={(e) => openContextMenu(e, cover.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { const pattern = readDraggedPattern(e.dataTransfer); if (pattern) { e.preventDefault(); e.stopPropagation(); updateSpread(cover.id, { backgroundPattern: pattern }) } }}
            title="Front / Spine / Back — double-click to design, right-click for more options"
          >
            <SpreadThumbnail spread={cover} photosById={photosById} size={project.size} responsive />
            {exportingId === cover.id && (
              <div className="spreads-panel__exporting">
                <Icon name="download" size={14} />
                Exporting…
              </div>
            )}
          </div>
        ) : spreads.length > 0 ? (
          <div
            className={`spreads-panel__card spreads-panel__card--cover spreads-panel__card--drop ${coverDragOver || target?.cover ? 'is-drag-over' : ''}`}
            data-cover-drop
            style={{ aspectRatio: 1 }}
            onDoubleClick={() => window.dispatchEvent(new CustomEvent('album-studio:setup-cover'))}
            onDragOver={(e) => {
              e.preventDefault()
              setCoverDragOver(true)
            }}
            onDragLeave={() => setCoverDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setCoverDragOver(false)
              const ids = readDraggedPhotoIds(e.dataTransfer, project.photos.map((p) => p.id))
              if (ids.length) placeCoverPhotos(ids)
              else void handleCoverDrop(e.dataTransfer.files)
            }}
          >
            <input
              ref={coverInputRef}
              type="file"
              accept={IMAGE_FILE_ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                void handleCoverDrop(e.target.files ?? [])
                e.target.value = ''
              }}
            />
            <p>Drop images here to create a cover</p>
          </div>
        ) : null}

        {spreads.map((spread, index) => (
          <div
            key={spread.id}
            className={`spreads-panel__column ${selectedSpreadId === spread.id ? 'is-selected' : ''} ${target?.spreadId === spread.id ? 'is-drop-target' : ''}`}
            data-timeline-spread={spread.id}
            data-overview-spread={spread.id}
            style={{ '--spread-aspect': (spread.size ?? project.size).widthIn / (spread.size ?? project.size).heightIn } as CSSProperties}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleSpreadDrop(e, spread.id)}
            onClick={() => selectSpread(spread.id)}
            onDoubleClick={() => enterDesignerView(spread.id)}
            onContextMenu={(e) => openContextMenu(e, spread.id)}
            title={`Spread ${index + 1} — double-click to design, right-click for more options`}
          >
            <div data-spread-drag className={`spreads-panel__card ${selectedSpreadId === spread.id ? 'is-selected' : ''}`} style={{ aspectRatio: (spread.size ?? project.size).widthIn / (spread.size ?? project.size).heightIn }} onClick={e => {
              e.stopPropagation()
              const r = e.currentTarget.getBoundingClientRect()
              const box = computePlaceholderBoxes(spread, r.width, r.height).reverse().find(b => e.clientX-r.left >= b.x && e.clientX-r.left <= b.x+b.width && e.clientY-r.top >= b.y && e.clientY-r.top <= b.y+b.height)
              selectSpread(spread.id)
              if (box) useProjectStore.getState().selectPlaceholder(box.placeholderId)
            }} onContextMenu={e => {
              const r = e.currentTarget.getBoundingClientRect()
              const box = computePlaceholderBoxes(spread, r.width, r.height).reverse().find(b => e.clientX-r.left >= b.x && e.clientX-r.left <= b.x+b.width && e.clientY-r.top >= b.y && e.clientY-r.top <= b.y+b.height)
              if (!box && !spread.backgroundPattern) return
              e.preventDefault(); e.stopPropagation(); selectSpread(spread.id)
              setPhotoMenu({ openedAt: Date.now(), x: e.clientX, y: e.clientY, spreadId: spread.id, frameId: box?.placeholderId })
            }}>
            <SpreadThumbnail spread={spread} photosById={photosById} size={project.size} responsive />
            <div className="spread-card-controls" onDoubleClick={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
              <div className="spread-card-controls__actions">
                <button title="Flip spread horizontally" aria-label="Flip spread horizontally" onClick={() => flipSpread(spread.id)}><Icon name="flipSpread" size={16} /></button>
                <button title="Edit in Designer View" aria-label="Edit in Designer View" onClick={() => enterDesignerView(spread.id)}><Icon name="edit" size={16} /></button>
              </div>
              <div className="spread-card-controls__templates">
                <button title="Previous template (Up)" onClick={() => { selectSpread(spread.id); cycleSpreadTemplate(spread.id, -1) }}><Icon name="chevronLeft" size={12} /></button>
                <button title="Browse matching templates" onClick={() => openMatchingTemplates(spread.id)}><Icon name="grid" size={12} /></button>
                <button title="Next template (Down)" onClick={() => { selectSpread(spread.id); cycleSpreadTemplate(spread.id, 1) }}><Icon name="chevronRight" size={12} /></button>
              </div>
              <span>{index + 1}</span>
            </div>
            {exportingId === spread.id && (
              <div className="spreads-panel__exporting">
                <Icon name="download" size={14} />
                Exporting…
              </div>
            )}
            {confirmDeleteId === spread.id && (
              <div className="spreads-panel__confirm" onClick={(e) => e.stopPropagation()}>
                <p>Delete spread {index + 1}? Its photos stay in your pool.</p>
                <div className="spreads-panel__confirm-actions">
                  <button className="btn btn--tiny" onClick={() => setConfirmDeleteId(null)}>
                    Cancel
                  </button>
                  <button
                    className="btn btn--tiny btn--danger"
                    onClick={() => {
                      deleteSpread(spread.id)
                      setConfirmDeleteId(null)
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        ))}

        <div
            className={`spreads-panel__card spreads-panel__card--drop ${newSpreadDragOver || (drag && target?.spreadId === null && !target.cover) ? 'is-drag-over' : ''}`}
            data-new-spread
          style={{ aspectRatio: project.size.widthIn / project.size.heightIn }}
          onClick={() => newSpreadInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setNewSpreadDragOver(true)
          }}
          onDragLeave={() => setNewSpreadDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setNewSpreadDragOver(false)
            const frame = readTimelineFrame(e.dataTransfer)
            const ids = readDraggedPhotoIds(e.dataTransfer, project.photos.map((p) => p.id))
            if (frame) moveTimelinePhoto(frame.spreadId, frame.frameId, null)
            else if (ids.length) insertTimelinePhotos(ids, null)
            else void handleNewSpreadDrop(e.dataTransfer.files)
          }}
        >
          <input
            ref={newSpreadInputRef}
            type="file"
            accept={IMAGE_FILE_ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              void handleNewSpreadDrop(e.target.files ?? [])
              e.target.value = ''
            }}
          />
          {project.spreads.length === 0 && <Icon name="image" size={100} />}
          <p>Drop images here to create a new spread.</p>
        </div>
      </div>

      {project.spreads.length === 0 && <div className="spreads-panel__empty-timeline" />}
      {spreads.length > 0 && <div ref={timelineRef} className="spreads-panel__timeline" aria-label="Album image timeline">
        {spreads.map((spread, index) => <Fragment key={spread.id}>
          <div className={`spreads-panel__photos ${selectedSpreadId === spread.id ? 'is-selected' : ''} ${target?.spreadId === spread.id ? 'is-drop-target' : ''}`}
            data-timeline-spread={spread.id} aria-label={`Images in spread ${index + 1}`}
            onClick={() => selectSpread(spread.id)} onDoubleClick={() => enterDesignerView(spread.id)}
            onContextMenu={(e) => openContextMenu(e, spread.id)}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleSpreadDrop(e, spread.id)}>
            {spread.placements.map((placement, placementIndex) => {
              const photo = placement.photoId ? photosById.get(placement.photoId) : undefined
              return photo ? <Fragment key={placement.placeholderId}>
                {placementIndex > 0 && <button className="timeline-cut" title={`Cut timeline before ${photo.fileName}`} onDoubleClick={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); splitSpread(spread.id, placementIndex) }}><Icon name="scissors" size={10} /></button>}
                <img src={photo.src} alt={photo.fileName} title={`${photo.fileName} — drag to move in the timeline`} draggable={false}
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); selectSpread(spread.id); setPhotoMenu({ openedAt: Date.now(), x: e.clientX, y: e.clientY, spreadId: spread.id, frameId: placement.placeholderId }) }}
                  data-timeline-frame={placement.placeholderId}
                  onClick={e => { e.stopPropagation(); selectSpread(spread.id); useProjectStore.getState().selectPlaceholder(placement.placeholderId) }}
                  className={target?.spreadId === spread.id && target.beforeFrameId === placement.placeholderId ? 'is-insert-before' : ''}
                  onDrop={(e) => handleSpreadDrop(e, spread.id, placement.placeholderId)} />
              </Fragment> : null
            })}
          </div>
          {index < spreads.length - 1 && <button className="timeline-boundary" title={`Remove cut after spread ${index + 1} (merge with next)`} onClick={() => mergeWithNext(spread.id)} />}
        </Fragment>)}
        <div className="timeline-new-spread" data-new-spread onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const ids = readDraggedPhotoIds(e.dataTransfer, project.photos.map((p) => p.id)); if (ids.length) insertTimelinePhotos(ids, null); else void handleNewSpreadDrop(e.dataTransfer.files) }}>Drop images to add a spread</div>
      </div>}

      {drag && <img className="timeline-drag-preview" src={drag.src} alt="" style={{ left: drag.x + 12, top: drag.y + 12 }} />}
      {drag && <span className="sr-only" role="status">{target ? 'Release to place image' : 'Move over the timeline to place image'}</span>}

      {photoMenu && <PhotoContextMenu key={JSON.stringify(photoMenu)} {...photoMenu} />}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems(contextMenu.spreadId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
