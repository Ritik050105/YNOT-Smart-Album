import { useEffect, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { STAGE_WIDTH } from './DesignerCanvas'
import { inToDisplay } from '@/engine/units'
import { useBottomDockResize } from '@/engine/useBottomDockResize'
import DesignerCanvas from './DesignerCanvas'
import Inspector from './Inspector'
import AlbumInfoPanel from './AlbumInfoPanel'
import TemplateLibraryPanel from './TemplateLibraryPanel'
import PhotoBin from './PhotoBin'
import MenuBar from './MenuBar'
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

/** The focused single-spread editor — the only place actual spread editing happens now that the
 *  main view (SpreadsPanel) is an all-spreads overview rather than a single-spread canvas.
 *  Entered by double-clicking a spread in that overview, Spread > Edit in Designer View, or a
 *  spread's context menu; Escape (with nothing else selected) or this screen's own back button
 *  returns to the overview. Hosts the same canvas/inspector/album-info/template-library/photo-dock
 *  the app's features already use, inside a dedicated shell: a back/"Save as Template" top bar, a
 *  ruler, and a left tool rail for the Selection/Image Frame/Text/Hand/Zoom tools instead of the
 *  TopBar's own Select/Pan buttons. */
export default function DesignerViewScreen() {
  const project = useProjectStore((s) => s.project)
  const designerViewSpreadId = useProjectStore((s) => s.designerViewSpreadId)
  const exitDesignerView = useProjectStore((s) => s.exitDesignerView)
  const canvasTool = useProjectStore((s) => s.canvasTool)
  const setCanvasTool = useProjectStore((s) => s.setCanvasTool)
  const canvasZoom = useProjectStore((s) => s.canvasZoom)
  const canvasPan = useProjectStore((s) => s.canvasPan)
  const saveSpreadAsTemplate = useProjectStore((s) => s.saveSpreadAsTemplate)
  const { bottomPanelOpen, handleMouseDown: handleBottomHandleMouseDown } = useBottomDockResize()

  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [saving, setSaving] = useState(false)

  const interior = project.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order)
  const spread = project.spreads.find((s) => s.id === designerViewSpreadId)
  const spreadLabel = spread?.isCover ? 'cover' : `spread ${interior.findIndex((s) => s.id === spread?.id) + 1}`

  useEffect(() => {
    const prevTitle = document.title
    document.title = `${project.name} - designing ${spreadLabel} @ ${Math.round(canvasZoom * 100)}%`
    return () => {
      document.title = prevTitle
    }
  }, [project.name, spreadLabel, canvasZoom])

  if (!spread) return null

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
      <MenuBar />
      <header className="designer-view__topbar">
        <button className="designer-view__back" title="Back to the album overview" onClick={exitDesignerView}>
          <Icon name="chevronLeft" size={16} />
        </button>
        <button
          className="btn"
          disabled={spread.placements.every((p) => !p.photoId)}
          onClick={() => setSaveTemplateOpen(true)}
        >
          Save as Template
        </button>
        <div className="designer-view__spacer" />
        <span className="muted">
          {project.name} — designing {spreadLabel} @ {Math.round(canvasZoom * 100)}%
        </span>
      </header>

      <div className="designer-view__body">
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

        <aside className="app-sidebar app-sidebar--right">
          <AlbumInfoPanel />
          <Inspector />
          <TemplateLibraryPanel />
        </aside>
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
