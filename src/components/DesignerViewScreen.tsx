import SelectionActions from './SelectionActions'
import ContextMenu from './ContextMenu'
import QuoteTemplates from './QuoteTemplates'
import PanelResizer from '@/components/PanelResizer'
import DesignerLayers from './DesignerLayers'
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
  orientation:'horizontal'|'vertical';sizeIn:number;pxPerIn:number;zoom:number;panPx:number;unit:'in'|'cm'|'mm'|'px';dpi:number;pointer:{x:number;y:number}|null
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
  const templateBrowseKind = useProjectStore(s => s.templateBrowseKind)
  /** The Browse buttons are a toggle: pressing the one that is already showing puts the strip away. */
  const toggleBrowse = (kind: 'image' | 'mixed') => {
    const store = useProjectStore.getState()
    if (store.matchingTemplatesOpen && store.templateBrowseKind === kind) store.closeMatchingTemplates()
    else if (store.designerViewSpreadId) store.openMatchingTemplates(store.designerViewSpreadId, kind)
  }
  const project = useProjectStore((s) => s.project)
  const designerViewSpreadId = useProjectStore((s) => s.designerViewSpreadId)
  const exitDesignerView = useProjectStore((s) => s.exitDesignerView)
  const drawingShape = useProjectStore(s=>s.drawingShape)
  const [shapeMenu,setShapeMenu]=useState<{x:number;y:number;tool:'shape'|'shape-outline'}|null>(null)
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

  async function handleSaveTemplate(kind:'image'|'mixed'='image') {
    if (!spread || saving) return
    setSaving(true)
    try {
      await saveSpreadAsTemplate(spread.id, `Creative ${Date.now().toString(36).toUpperCase()}`,kind)
    } catch(error) {
      window.alert(error instanceof Error ? error.message : 'Template could not be saved.')
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
        <button className="btn btn--icon designer-view__back" title="Back to the album overview" onClick={() => exitDesignerView()}>
          <Icon name="chevronLeft" size={16} />
        </button>
        <div className="template-toolbar-group"><button className="btn" aria-pressed={matchingTemplatesOpen&&templateBrowseKind==='image'} onClick={()=>toggleBrowse('image')}>Browse Image Templates</button>
        <QuoteTemplates spreadId={spread.id} saveHost="designer-save-font"/>
        <button className="btn" aria-pressed={matchingTemplatesOpen&&templateBrowseKind==='mixed'} onClick={()=>toggleBrowse('mixed')}>Browse Mixed Templates</button></div>
        {spread.isCover&&<button className="btn" onClick={()=>window.dispatchEvent(new CustomEvent('album-studio:setup-cover',{detail:{mode:'custom'}}))}>Cover Specifications</button>}
        <button className="btn" aria-pressed={rightPanelOpen} onClick={toggleRightPanel}>Inspector panel</button><button className="btn" aria-pressed={bottomPanelOpen} onClick={()=>useProjectStore.getState().toggleBottomPanel()}>Image gallery</button><SelectionActions/><div className="designer-view__spacer"/>
        <div className="template-toolbar-group template-toolbar-group--save"><button className="btn" disabled={saving||!spread.placements.length} onClick={()=>void handleSaveTemplate('image')}>Save Image Templates</button>
        <span id="designer-save-font"/>
        <button className="btn" disabled={saving||!spread.placements.length||!spread.textBoxes.length} onClick={()=>void handleSaveTemplate('mixed')}>Save Mixed Templates</button></div>
        <span className="muted">
          {project.name} — designing {spreadLabel} @ {Math.round(canvasZoom * 100)}%
        </span>
      </header>

      <div id="designer-font-template-browser" />
      <MatchingTemplatesPanel />
      {/* The browse panel is a fixed slice of the window by default, which is not enough to see a
          grid of templates at once. Dragging this gives it as much of the window as wanted. */}
      {matchingTemplatesOpen && <PanelResizer axis="y" variable="--template-browser-height" label="Resize template browser" initial={Math.round(window.innerHeight * 0.3)} min={160} max={0.7}/>}
      <div className={`designer-view__body ${matchingTemplatesOpen ? 'is-browsing-templates' : ''}`}>
        {shapeMenu&&<ContextMenu x={shapeMenu.x} y={shapeMenu.y} onClose={()=>setShapeMenu(null)} items={(['rectangle','circle','triangle'] as const).map(shape=>({label:(shape===drawingShape?'✓ ':'')+shape[0].toUpperCase()+shape.slice(1),onClick:()=>{useProjectStore.setState({drawingShape:shape});setCanvasTool(shapeMenu.tool);setShapeMenu(null)}}))}/>}
        <div className="designer-view__tool-rail">
          {([
            { tool: 'select', icon: 'cursor', title: 'Selection Tool (V)' },
            { tool: 'shape', icon:'rectangleFilled', title:'Shape with fill and stroke' },
            { tool: 'shape-outline', icon:'rectangle', title:'Shape with stroke only' },
            { tool: 'line', icon:'line', title:'Line · draw in any direction' },
            { tool: 'frame', icon: 'frame', title: 'Image Frame Tool (F)' },
            { tool: 'text', icon: 'type', title: 'Text Tool (T)' },
            { tool: 'pan', icon: 'hand', title: 'Hand Tool (H)' },
            { tool: 'zoom', icon: 'search', title: 'Zoom Tool (Z)' },
          ] as const).map((t) => (
            <button
              key={t.tool}
              className={`designer-view__tool ${canvasTool === t.tool ? 'is-active' : ''}`}
              onContextMenu={e=>{if(t.tool==='shape'||t.tool==='shape-outline'){e.preventDefault();setShapeMenu({x:e.clientX,y:e.clientY,tool:t.tool})}}}
              title={t.tool==='shape'||t.tool==='shape-outline'?`${drawingShape} · ${t.title} · right-click to change shape`:t.title}
              aria-label={t.title}
              aria-pressed={canvasTool === t.tool}
              onClick={() => setCanvasTool(t.tool)}
            >
              <Icon name={(t.tool==='shape'||t.tool==='shape-outline')&&drawingShape!=='rectangle'?drawingShape+(t.tool==='shape'?'Filled':''):t.icon} size={16} />
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
          <><PanelResizer axis="x" variable="--inspector-width" label="Resize right panel" initial={320} min={240} max={0.45}/><aside className="app-sidebar app-sidebar--right">
            {selectedPlaceholderId || selectedTextBoxId ? <Inspector /> : <AlbumInfoPanel />}<DesignerLayers spread={spread} />
          </aside></>
        )}
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


    </div>
  )
}
