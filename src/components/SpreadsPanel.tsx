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
  const spreadClipboard = useProjectStore((s) => s.spreadClipboard)
  const copySpread = useProjectStore((s) => s.copySpread)
  const cutSpread = useProjectStore((s) => s.cutSpread)
  const pasteSpreadAfter = useProjectStore((s) => s.pasteSpreadAfter)
  const convertSpreadPageType = useProjectStore((s) => s.convertSpreadPageType)
  const applyTemplateToAllSpreads = useProjectStore((s) => s.applyTemplateToAllSpreads)
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
      { label: 'Add Blank Spread', onClick: () => addBlankSpread() },
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
    <div className="panel spreads-panel">
      <h3>
        <Icon name="bookOpen" size={14} />
        Cover
      </h3>
      {cover ? (
        <div
          className={`spreads-panel__item spreads-panel__item--cover ${selectedSpreadId === cover.id ? 'is-selected' : ''}`}
          onClick={() => selectSpread(cover.id)}
          onContextMenu={(e) => openContextMenu(e, cover.id)}
          title="Front / Spine / Back — right-click for more options"
        >
          <SpreadThumbnail spread={cover} photosById={photosById} size={project.size} width={100} />
          <span className="spreads-panel__label">Front / Spine / Back</span>
          {exportingId === cover.id && (
            <div className="spreads-panel__exporting">
              <Icon name="download" size={14} />
              Exporting…
            </div>
          )}
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
            title={`Spread ${index + 1} — right-click for more options`}
          >
            <SpreadThumbnail spread={spread} photosById={photosById} size={project.size} responsive />
            <span className="spreads-panel__label">
              {index + 1} · {spread.placements.length} photo{spread.placements.length === 1 ? '' : 's'}
            </span>
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
