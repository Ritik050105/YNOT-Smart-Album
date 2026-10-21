import { useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { useImportPhotos } from '@/engine/useImportPhotos'
import { exportSingleSpreadToPdf } from '@/engine/exportAlbum'
import SpreadThumbnail from './SpreadThumbnail'
import ContextMenu, { ContextMenuItem } from './ContextMenu'
import Icon from './Icon'

/** The album's main view — the reference app's own "all spreads" screen: a row of real,
 *  proportioned spread cards (not a zoomed single-spread canvas, no ruler or tool rail here),
 *  cover pinned first, a "drop images to create a new spread" card trailing. A single click
 *  selects a spread; double-click opens it in the focused Designer View to actually work on it —
 *  Escape (or its own back button) returns here. Reorder by drag. */
export default function SpreadsPanel() {
  const project = useProjectStore((s) => s.project)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectSpread = useProjectStore((s) => s.selectSpread)
  const reorderSpreads = useProjectStore((s) => s.reorderSpreads)
  const splitSpread = useProjectStore((s) => s.splitSpread)
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
  const runAutoBuildFromGroups = useProjectStore((s) => s.runAutoBuildFromGroups)
  const setPlacementPhoto = useProjectStore((s) => s.setPlacementPhoto)
  const { handleFiles } = useImportPhotos()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; spreadId: string } | null>(null)
  const [coverDragOver, setCoverDragOver] = useState(false)
  const [newSpreadDragOver, setNewSpreadDragOver] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const newSpreadInputRef = useRef<HTMLInputElement>(null)

  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const cover = project.spreads.find((s) => s.isCover)
  const spreads = project.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order)

  async function exportSpread(spread: typeof project.spreads[number]) {
    setExportingId(spread.id)
    try {
      await exportSingleSpreadToPdf(project, spread)
    } finally {
      setExportingId(null)
    }
  }

  async function handleCoverDrop(files: FileList | File[]) {
    const before = useProjectStore.getState().project.photos.map((p) => p.id)
    await handleFiles(files)
    const after = useProjectStore.getState()
    const newIds = after.project.photos.map((p) => p.id).filter((id) => !before.includes(id))
    if (newIds.length === 0) return
    if (!after.project.spreads.some((s) => s.isCover)) addCoverSpread()
    const coverSpread = useProjectStore.getState().project.spreads.find((s) => s.isCover)
    if (!coverSpread) return
    coverSpread.placements.forEach((p, i) => {
      if (newIds[i]) setPlacementPhoto(coverSpread.id, p.placeholderId, newIds[i])
    })
  }

  async function handleNewSpreadDrop(files: FileList | File[]) {
    const before = useProjectStore.getState().project.photos.map((p) => p.id)
    await handleFiles(files)
    const after = useProjectStore.getState().project.photos.map((p) => p.id)
    const newIds = after.filter((id) => !before.includes(id))
    if (newIds.length > 0) runAutoBuildFromGroups([newIds])
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
    <div className="spreads-panel">
      <div className="spreads-panel__row">
        {cover ? (
          <div
            className={`spreads-panel__card spreads-panel__card--cover ${selectedSpreadId === cover.id ? 'is-selected' : ''}`}
            style={{ aspectRatio: project.size.widthIn / project.size.heightIn }}
            onClick={() => selectSpread(cover.id)}
            onDoubleClick={() => enterDesignerView(cover.id)}
            onContextMenu={(e) => openContextMenu(e, cover.id)}
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
        ) : (
          <div
            className={`spreads-panel__card spreads-panel__card--drop ${coverDragOver ? 'is-drag-over' : ''}`}
            style={{ aspectRatio: project.size.widthIn / project.size.heightIn }}
            onClick={() => coverInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setCoverDragOver(true)
            }}
            onDragLeave={() => setCoverDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setCoverDragOver(false)
              void handleCoverDrop(e.dataTransfer.files)
            }}
          >
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void handleCoverDrop(e.target.files ?? [])
                e.target.value = ''
              }}
            />
            <p>Drop images here to create a cover</p>
          </div>
        )}

        {spreads.map((spread, index) => (
          <div
            key={spread.id}
            className={`spreads-panel__card ${selectedSpreadId === spread.id ? 'is-selected' : ''}`}
            style={{ aspectRatio: project.size.widthIn / project.size.heightIn }}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex === null || dragIndex === index) return
              reorderSpreads(dragIndex, index)
              setDragIndex(null)
            }}
            onClick={() => selectSpread(spread.id)}
            onDoubleClick={() => enterDesignerView(spread.id)}
            onContextMenu={(e) => openContextMenu(e, spread.id)}
            title={`Spread ${index + 1} — double-click to design, right-click for more options`}
          >
            <SpreadThumbnail spread={spread} photosById={photosById} size={project.size} responsive />
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
        ))}

        <div
          className={`spreads-panel__card spreads-panel__card--drop ${newSpreadDragOver ? 'is-drag-over' : ''}`}
          style={{ aspectRatio: project.size.widthIn / project.size.heightIn }}
          onClick={() => newSpreadInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setNewSpreadDragOver(true)
          }}
          onDragLeave={() => setNewSpreadDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setNewSpreadDragOver(false)
            void handleNewSpreadDrop(e.dataTransfer.files)
          }}
        >
          <input
            ref={newSpreadInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void handleNewSpreadDrop(e.target.files ?? [])
              e.target.value = ''
            }}
          />
          <p>Drop images here to create a new spread.</p>
        </div>
      </div>

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
