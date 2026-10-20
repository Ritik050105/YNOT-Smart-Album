import { useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { exportSingleSpreadToPdf } from '@/engine/exportAlbum'
import SpreadThumbnail from './SpreadThumbnail'
import ContextMenu, { ContextMenuItem } from './ContextMenu'
import Icon from './Icon'

/** Left/right page rearrangement strip: reorder spreads by drag, click to open in the designer.
 *  The cover (front/spine/back) is a separate, non-draggable slot pinned above the interior page
 *  list — it isn't numbered as a "spread" and split/merge/reorder/duplicate don't apply to it. */
export default function SpreadsPanel() {
  const project = useProjectStore((s) => s.project)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectSpread = useProjectStore((s) => s.selectSpread)
  const reorderSpreads = useProjectStore((s) => s.reorderSpreads)
  const splitSpread = useProjectStore((s) => s.splitSpread)
  const mergeWithNext = useProjectStore((s) => s.mergeWithNext)
  const flipSpread = useProjectStore((s) => s.flipSpread)
  const addBlankSpread = useProjectStore((s) => s.addBlankSpread)
  const addCoverSpread = useProjectStore((s) => s.addCoverSpread)
  const duplicateSpread = useProjectStore((s) => s.duplicateSpread)
  const deleteSpread = useProjectStore((s) => s.deleteSpread)
  const enterDesignerView = useProjectStore((s) => s.enterDesignerView)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; spreadId: string } | null>(null)

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
      { label: 'Edit in Designer View', onClick: () => enterDesignerView(spreadId) },
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
      { label: 'Flip Spread Horizontally', onClick: () => flipSpread(spreadId) },
      { label: 'Duplicate Spread', onClick: () => duplicateSpread(spreadId) },
      { label: 'Export Spread…', onClick: () => void exportSpread(spread) },
      { label: 'Delete Spread', danger: true, onClick: () => setConfirmDeleteId(spreadId) },
    ]
  }

  return (
    <div className="panel spreads-panel">
      <h3>
        <Icon name="bookOpen" size={14} />
        Cover
      </h3>
      {cover ? (
        <div
          className={`spreads-panel__item ${selectedSpreadId === cover.id ? 'is-selected' : ''}`}
          onClick={() => selectSpread(cover.id)}
          onContextMenu={(e) => openContextMenu(e, cover.id)}
        >
          <SpreadThumbnail spread={cover} photosById={photosById} size={project.size} width={170} />
          <span className="spreads-panel__label">Front / Spine / Back</span>
          <div className="spreads-panel__actions">
            <button
              className="btn btn--tiny"
              title="Flip cover horizontally"
              onClick={(e) => {
                e.stopPropagation()
                flipSpread(cover.id)
              }}
            >
              <Icon name="flipHorizontal" size={11} />
              Flip
            </button>
            <button
              className="btn btn--tiny"
              title="Export the cover as a single PDF page"
              disabled={exportingId === cover.id}
              onClick={(e) => {
                e.stopPropagation()
                void exportSpread(cover)
              }}
            >
              <Icon name="download" size={11} />
              {exportingId === cover.id ? 'Exporting…' : 'Export'}
            </button>
            <button
              className="btn btn--tiny btn--danger"
              title="Delete cover"
              onClick={(e) => {
                e.stopPropagation()
                deleteSpread(cover.id)
              }}
            >
              <Icon name="trash" size={11} />
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn--tiny btn--block" onClick={() => addCoverSpread()}>
          <Icon name="plus" size={11} />
          Add Cover
        </button>
      )}

      <h3 style={{ marginTop: 16 }}>
        <Icon name="grid" size={14} />
        Spreads ({spreads.length})
      </h3>
      <button className="btn btn--tiny btn--block" onClick={() => addBlankSpread()}>
        <Icon name="plus" size={11} />
        Add Blank Spread
      </button>
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
            onContextMenu={(e) => openContextMenu(e, spread.id)}
          >
            <SpreadThumbnail spread={spread} photosById={photosById} size={project.size} width={170} />
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
                  <Icon name="scissors" size={11} />
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
                  <Icon name="merge" size={11} />
                  Merge
                </button>
              )}
              <button
                className="btn btn--tiny"
                title="Flip spread horizontally"
                onClick={(e) => {
                  e.stopPropagation()
                  flipSpread(spread.id)
                }}
              >
                <Icon name="flipHorizontal" size={11} />
                Flip
              </button>
              <button
                className="btn btn--tiny"
                title="Duplicate this spread"
                onClick={(e) => {
                  e.stopPropagation()
                  duplicateSpread(spread.id)
                }}
              >
                <Icon name="layers" size={11} />
                Duplicate
              </button>
              <button
                className="btn btn--tiny"
                title="Export this spread as a single PDF page"
                disabled={exportingId === spread.id}
                onClick={(e) => {
                  e.stopPropagation()
                  void exportSpread(spread)
                }}
              >
                <Icon name="download" size={11} />
                {exportingId === spread.id ? 'Exporting…' : 'Export'}
              </button>
              <button
                className="btn btn--tiny btn--danger"
                title="Delete this spread"
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmDeleteId(spread.id)
                }}
              >
                <Icon name="trash" size={11} />
              </button>
            </div>
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
        {spreads.length === 0 && (
          <div className="empty-state">
            <Icon name="sparkles" size={26} />
            <p>Import photos, then click Auto-Build to lay out your first spreads.</p>
          </div>
        )}
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
