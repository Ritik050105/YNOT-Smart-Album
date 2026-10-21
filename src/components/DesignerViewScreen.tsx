import { useEffect, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { STAGE_WIDTH } from './DesignerCanvas'
import { inToDisplay } from '@/engine/units'
import { useBottomDockResize } from '@/engine/useBottomDockResize'
import DesignerCanvas from './DesignerCanvas'
import Inspector from './Inspector'
import AlbumInfoPanel from './AlbumInfoPanel'
import TemplateLibraryPanel from './TemplateLibraryPanel'
import ImportPanel from './ImportPanel'
import PhotoBin from './PhotoBin'
import TimelinePanel from './TimelinePanel'
import MenuBar from './MenuBar'
import TopBar from './TopBar'
import GlobalDropZone from './GlobalDropZone'
import Modal from './Modal'
import Icon from './Icon'
import KeyboardShortcuts from './KeyboardShortcuts'

const RULER_THICKNESS = 20
/** How far past the spread's own edges the ruler draws ticks, in inches — covers typical panning
 *  without having to recompute the tick range on every pan/zoom change. */
const RULER_OVERDRAW_IN = 30

function Ruler({
  orientation,
  sizeIn,
  pxPerIn,
  zoom,
  panPx,
  unit,
  dpi,
}: {
  orientation: 'horizontal' | 'vertical'
  sizeIn: number
  pxPerIn: number
  zoom: number
  panPx: number
  unit: 'in' | 'cm' | 'px'
  dpi: number
}) {
  // One tick per whole display-unit (1in / 1cm / 100px) — the ruler's own "grid", independent of
  // the project's internal inch storage.
  const stepIn = unit === 'cm' ? 1 / 2.54 : unit === 'px' ? 100 / dpi : 1
  const ticks: { pos: number; label: string }[] = []
  for (let v = -RULER_OVERDRAW_IN; v <= sizeIn + RULER_OVERDRAW_IN; v += stepIn) {
    const pos = panPx + v * pxPerIn * zoom
    ticks.push({ pos, label: String(Math.round(inToDisplay(v, unit, dpi))) })
  }

  return (
    <div className={`designer-ruler designer-ruler--${orientation}`}>
      {ticks.map((t, i) => (
        <span
          key={i}
          className="designer-ruler__tick"
          style={orientation === 'horizontal' ? { left: t.pos } : { top: t.pos }}
        >
          {t.label}
        </span>
      ))}
    </div>
  )
}

/** The app's single main editor — a focused spread canvas (ruler + Selection/Image
 *  Frame/Text/Hand/Zoom tool rail) with the album's full spread filmstrip always visible below
 *  it, matching the reference app's own layout: one canvas, every spread one click away in the
 *  strip, no separate "overview" screen to enter or leave. Left (Import Photos) and right (Album
 *  Info/Inspector/Templates) panels default collapsed and reveal themselves the moment they
 *  become useful (see revealLeftPanel/revealRightPanel), never eating canvas space up front. */
export default function DesignerViewScreen() {
  const project = useProjectStore((s) => s.project)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const canvasTool = useProjectStore((s) => s.canvasTool)
  const setCanvasTool = useProjectStore((s) => s.setCanvasTool)
  const canvasZoom = useProjectStore((s) => s.canvasZoom)
  const canvasPan = useProjectStore((s) => s.canvasPan)
  const saveSpreadAsTemplate = useProjectStore((s) => s.saveSpreadAsTemplate)
  const leftPanelOpen = useProjectStore((s) => s.leftPanelOpen)
  const toggleLeftPanel = useProjectStore((s) => s.toggleLeftPanel)
  const rightPanelOpen = useProjectStore((s) => s.rightPanelOpen)
  const toggleRightPanel = useProjectStore((s) => s.toggleRightPanel)
  const { bottomPanelOpen, handleMouseDown: handleBottomHandleMouseDown } = useBottomDockResize()

  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [saving, setSaving] = useState(false)

  const interior = project.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order)
  const spread = project.spreads.find((s) => s.id === selectedSpreadId)
  const spreadLabel = spread ? (spread.isCover ? 'cover' : `spread ${interior.findIndex((s) => s.id === spread.id) + 1}`) : null

  useEffect(() => {
    const prevTitle = document.title
    document.title = spreadLabel
      ? `${project.name} - designing ${spreadLabel} @ ${Math.round(canvasZoom * 100)}%`
      : project.name
    return () => {
      document.title = prevTitle
    }
  }, [project.name, spreadLabel, canvasZoom])

  const pxPerInWidth = STAGE_WIDTH / project.size.widthIn
  const stageHeight = STAGE_WIDTH / (project.size.widthIn / project.size.heightIn)
  const pxPerInHeight = stageHeight / project.size.heightIn

  async function handleSaveTemplate() {
    if (!spread || !templateName.trim()) return
    setSaving(true)
    try {
      await saveSpreadAsTemplate(spread.id, templateName.trim())
      setSaveTemplateOpen(false)
      setTemplateName('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-shell designer-view">
      <KeyboardShortcuts />
      <GlobalDropZone />
      <MenuBar />
      <TopBar />

      <header className="designer-view__topbar">
        <button
          className="btn"
          disabled={!spread || spread.placements.every((p) => !p.photoId)}
          onClick={() => setSaveTemplateOpen(true)}
        >
          Save as Template
        </button>
        <div className="designer-view__spacer" />
        {spreadLabel && (
          <span className="muted">
            {project.name} — designing {spreadLabel} @ {Math.round(canvasZoom * 100)}%
          </span>
        )}
      </header>

      <div className="designer-view__body">
        {leftPanelOpen && (
          <aside className="app-sidebar app-sidebar--left">
            <ImportPanel />
          </aside>
        )}
        <button
          className="panel-toggle panel-toggle--left"
          onClick={toggleLeftPanel}
          title={leftPanelOpen ? 'Collapse left panel' : 'Expand left panel'}
        >
          <Icon name={leftPanelOpen ? 'chevronLeft' : 'chevronRight'} size={12} />
        </button>

        <div className="designer-view__tool-rail">
          {([
            { tool: 'select', icon: 'cursor', title: 'Selection Tool (V)' },
            { tool: 'frame', icon: 'frame', title: 'Image Frame Tool (F)' },
            { tool: 'text', icon: 'type', title: 'Text Tool (T)' },
            { tool: 'pan', icon: 'hand', title: 'Hand Tool (H)' },
            { tool: 'zoom', icon: 'search', title: 'Zoom Tool (Z)' },
          ] as const).map((t) => (
            <button
              key={t.tool}
              className={`designer-view__tool ${canvasTool === t.tool ? 'is-active' : ''}`}
              title={t.title}
              onClick={() => setCanvasTool(t.tool)}
            >
              <Icon name={t.icon} size={16} />
            </button>
          ))}
        </div>

        <div className="designer-view__canvas-area">
          <div className="designer-view__corner" />
          <Ruler
            orientation="horizontal"
            sizeIn={project.size.widthIn}
            pxPerIn={pxPerInWidth}
            zoom={canvasZoom}
            panPx={canvasPan.x}
            unit={project.units}
            dpi={project.size.dpi}
          />
          <Ruler
            orientation="vertical"
            sizeIn={project.size.heightIn}
            pxPerIn={pxPerInHeight}
            zoom={canvasZoom}
            panPx={canvasPan.y}
            unit={project.units}
            dpi={project.size.dpi}
          />
          <div className="designer-view__canvas">
            <DesignerCanvas />
          </div>
          <div className="designer-view__zoom-controls">
            <button
              className="btn btn--tiny"
              title="Zoom to 100%"
              onClick={() => window.dispatchEvent(new CustomEvent('album-studio:zoom-100'))}
            >
              1:1
            </button>
            <button
              className="btn btn--tiny btn--icon"
              title="Fit spread to view"
              onClick={() => window.dispatchEvent(new CustomEvent('album-studio:zoom-fit'))}
            >
              <Icon name="fitToView" size={12} />
            </button>
          </div>
        </div>

        <button
          className="panel-toggle panel-toggle--right"
          onClick={toggleRightPanel}
          title={rightPanelOpen ? 'Collapse right panel' : 'Expand right panel'}
        >
          <Icon name={rightPanelOpen ? 'chevronRight' : 'chevronLeft'} size={12} />
        </button>
        {rightPanelOpen && (
          <aside className="app-sidebar app-sidebar--right">
            <AlbumInfoPanel />
            <Inspector />
            <TemplateLibraryPanel />
          </aside>
        )}
      </div>

      <div className="designer-view__timeline">
        <TimelinePanel />
      </div>

      <div className="bottom-panel">
        <button
          className="panel-toggle panel-toggle--bottom"
          onMouseDown={handleBottomHandleMouseDown}
          title={bottomPanelOpen ? 'Drag to resize, click to collapse the photo dock' : 'Expand photo dock'}
        >
          <Icon name={bottomPanelOpen ? 'chevronDown' : 'chevronUp'} size={12} />
        </button>
        {bottomPanelOpen && <PhotoBin />}
      </div>

      {saveTemplateOpen && (
        <Modal
          title="Save as Template"
          onClose={() => setSaveTemplateOpen(false)}
          width={360}
          footer={
            <>
              <button className="btn" onClick={() => setSaveTemplateOpen(false)}>
                Cancel
              </button>
              <div className="footer-spacer" />
              <button className="btn btn--primary" disabled={!templateName.trim() || saving} onClick={() => void handleSaveTemplate()}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <label className="field">
            Template name
            <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Hero Left" />
          </label>
        </Modal>
      )}
    </div>
  )
}
