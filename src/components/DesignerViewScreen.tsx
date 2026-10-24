import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import GlobalDropZone from './GlobalDropZone'
import MissingColorProfileDialog from './MissingColorProfileDialog'
import Modal from './Modal'
import Icon from './Icon'
import KeyboardShortcuts from './KeyboardShortcuts'
import CoverSetup from './CoverSetup'
import TopBar from './TopBar'
import MatchingTemplatesPanel from './MatchingTemplatesPanel'

const RULER_THICKNESS = 20
function Ruler({orientation,pxPerIn,zoom,panPx,unit,dpi,pointer}: {
  orientation:'horizontal'|'vertical';sizeIn:number;pxPerIn:number;zoom:number;panPx:number;unit:'in'|'cm'|'px';dpi:number;pointer:{x:number;y:number}|null
}) {
  const ref=useRef<HTMLDivElement>(null)
  const [geometry,setGeometry]=useState({length:0,offset:0,start:0})
  useLayoutEffect(()=>{
    const ruler=ref.current,viewport=ruler?.parentElement?.querySelector('.designer-canvas-viewport')
    if(!ruler||!viewport)return
    const measure=()=>{const r=ruler.getBoundingClientRect(),v=viewport.getBoundingClientRect();setGeometry(orientation==='horizontal'?{length:r.width,offset:v.left-r.left,start:r.left}:{length:r.height,offset:v.top-r.top,start:r.top})}
    measure();const observer=new ResizeObserver(measure);observer.observe(ruler);observer.observe(viewport)
    return()=>observer.disconnect()
  },[orientation,zoom,panPx])
  const pixelsPerUnit=pxPerIn*zoom / inToDisplay(1,unit,dpi)
  const raw=60/pixelsPerUnit,power=10**Math.floor(Math.log10(raw))
  const major=[1,2,5,10].find(v=>v*power>=raw)!*power,minor=major/5
  const origin=panPx+geometry.offset
  const ticks=[]
  for(let i=Math.floor(-origin/pixelsPerUnit/minor);i<=Math.ceil((geometry.length-origin)/pixelsPerUnit/minor);i++){
    ticks.push({pos:origin+i*minor*pixelsPerUnit,major:i%5===0,label:Number((i*minor).toFixed(4))})
  }
  const cursor=pointer?(orientation==='horizontal'?pointer.x:pointer.y)-geometry.start:null
  return <div ref={ref} className={`designer-ruler designer-ruler--${orientation}`} data-origin={origin}>
    {ticks.map((t,i)=><span key={i} className={`designer-ruler__tick ${t.major?'':'designer-ruler__tick--minor'}`} style={orientation==='horizontal'?{left:t.pos}:{top:t.pos}}>{t.major?t.label:''}</span>)}
    {cursor!==null&&cursor>=0&&cursor<=geometry.length&&<span className="designer-ruler__cursor" style={orientation==='horizontal'?{left:cursor}:{top:cursor}} />}
  </div>
}

/** The focused single-spread editor — the only place actual spread editing happens; the main
 *  view (SpreadsPanel) is an all-spreads overview rather than a single-spread canvas, matching
 *  the reference app's own split (its overview is a row of spread cards with no ruler or tool
 *  rail; double-clicking a card opens this exact kind of zoomed, ruled, tool-railed editor).
 *  Entered by double-clicking a spread in that overview, Spread > Edit in Designer View, or a
 *  spread's context menu; Escape (with nothing else selected) or this screen's own back button
 *  returns to the overview. Right panel (Album Info/Inspector/Templates) defaults collapsed and
 *  reveals itself once the user actually selects a placeholder or text box to edit. */
export default function DesignerViewScreen() {
  const matchingTemplatesOpen = useProjectStore(s => s.matchingTemplatesOpen)
  const project = useProjectStore((s) => s.project)
  const designerViewSpreadId = useProjectStore((s) => s.designerViewSpreadId)
  const exitDesignerView = useProjectStore((s) => s.exitDesignerView)
  const canvasTool = useProjectStore((s) => s.canvasTool)
  const setCanvasTool = useProjectStore((s) => s.setCanvasTool)
  const canvasZoom = useProjectStore((s) => s.canvasZoom)
  const canvasPan = useProjectStore((s) => s.canvasPan)
  const saveSpreadAsTemplate = useProjectStore((s) => s.saveSpreadAsTemplate)
  const rightPanelOpen = useProjectStore((s) => s.rightPanelOpen)
  const selectedPlaceholderId = useProjectStore((s) => s.selectedPlaceholderId)
  const selectedTextBoxId = useProjectStore((s) => s.selectedTextBoxId)
  const toggleRightPanel = useProjectStore((s) => s.toggleRightPanel)
  const { bottomPanelOpen, handleMouseDown: handleBottomHandleMouseDown } = useBottomDockResize()

  const [rulerPointer,setRulerPointer]=useState<{x:number;y:number}|null>(null)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [saving, setSaving] = useState(false)
  const [emptyCoverWarning, setEmptyCoverWarning] = useState(false)
  useEffect(() => {
    const warn = () => setEmptyCoverWarning(true)
    window.addEventListener('album-studio:empty-cover', warn)
    return () => window.removeEventListener('album-studio:empty-cover', warn)
  }, [])

  const interior = project.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order)
  const spread = project.spreads.find((s) => s.id === designerViewSpreadId)
  const size = spread?.size ?? project.size
  const spreadLabel = spread?.isCover ? 'cover' : `spread ${interior.findIndex((s) => s.id === spread?.id) + 1}`

  useEffect(() => {
    const prevTitle = document.title
    document.title = `${project.name} - designing ${spreadLabel} @ ${Math.round(canvasZoom * 100)}%`
    return () => {
      document.title = prevTitle
    }
  }, [project.name, spreadLabel, canvasZoom])

  if (!spread) return null

  const pxPerInWidth = STAGE_WIDTH / size.widthIn
  const stageHeight = STAGE_WIDTH / (size.widthIn / size.heightIn)
  const pxPerInHeight = stageHeight / size.heightIn

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
    <div className="app-shell album-editor designer-view">
      <KeyboardShortcuts />
      <GlobalDropZone />
      <CoverSetup />
      <MissingColorProfileDialog />
      <MenuBar />
      <TopBar actionsOnly />
      {emptyCoverWarning && <Modal title="Empty Cover" onClose={() => setEmptyCoverWarning(false)} footer={<>
        <button className="btn" onClick={() => setEmptyCoverWarning(false)}>Continue Editing</button><div className="footer-spacer" />
        <button className="btn btn--danger" onClick={() => { useProjectStore.getState().deleteSpread(spread.id); exitDesignerView(true) }}>Delete Cover</button>
      </>}><p>A cover must contain at least one image or non-empty text box. Continue editing or delete the empty cover.</p></Modal>}
      <header className="designer-view__topbar">
        <button className="designer-view__back" title="Back to the album overview" onClick={() => exitDesignerView()}>
          <Icon name="chevronLeft" size={16} />
        </button>
        <button
          className="btn"
          disabled={spread.placements.every((p) => !p.photoId)}
          onClick={() => setSaveTemplateOpen(true)}
        >
          Save as Template
        </button>
        {!spread.isCover && <button className="btn" aria-pressed={matchingTemplatesOpen} onClick={() => matchingTemplatesOpen ? useProjectStore.getState().closeMatchingTemplates() : useProjectStore.getState().openMatchingTemplates(spread.id)}><Icon name="grid" size={14} /> Browse matching templates</button>}
        {spread.isCover && <button className="btn" onClick={() => window.dispatchEvent(new CustomEvent('album-studio:setup-cover'))}>Cover Specifications</button>}
        <div className="designer-view__spacer" />
        <span className="muted">
          {project.name} — designing {spreadLabel} @ {Math.round(canvasZoom * 100)}%
        </span>
      </header>

      <MatchingTemplatesPanel />
      <div className={`designer-view__body ${matchingTemplatesOpen ? 'is-browsing-templates' : ''}`}>
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
              aria-label={t.title}
              aria-pressed={canvasTool === t.tool}
              onClick={() => setCanvasTool(t.tool)}
            >
              <Icon name={t.icon} size={16} />
            </button>
          ))}
        </div>

        <div className="designer-view__canvas-area" onPointerMove={e=>setRulerPointer({x:e.clientX,y:e.clientY})} onPointerLeave={()=>setRulerPointer(null)}>
          <div className="designer-view__corner" />
          <Ruler pointer={rulerPointer}
            orientation="horizontal"
            sizeIn={size.widthIn}
            pxPerIn={pxPerInWidth}
            zoom={canvasZoom}
            panPx={canvasPan.x}
            unit={project.units}
            dpi={size.dpi}
          />
          <Ruler pointer={rulerPointer}
            orientation="vertical"
            sizeIn={size.heightIn}
            pxPerIn={pxPerInHeight}
            zoom={canvasZoom}
            panPx={canvasPan.y}
            unit={project.units}
            dpi={size.dpi}
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
            {selectedPlaceholderId || selectedTextBoxId ? <Inspector /> : <AlbumInfoPanel />}
          </aside>
        )}
      </div>

      <div className="bottom-panel" hidden={matchingTemplatesOpen}>
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
