import { GapAnchor, arrangeLayerSelection, spreadLayers, groupGeometry, layerMembers, selectionGeometry } from '@/engine/spreadLayers'
import { usePreferences, getPreferences } from '@/state/preferences'
import { snapRect, nearbySpacingGaps, selectedSpacingGuides, GuideRect, SmartGuide } from '@/engine/smartGuides'
import { displayToIn, inToDisplay } from '@/engine/units'
import { IMAGE_FILE_ACCEPT } from '@/engine/imageSource'
import { useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Stage, Layer, Rect, Circle, Group, Image as KonvaImage, Text as KonvaText, Line, Transformer } from 'react-konva'
import Konva from 'konva'
import useImage from 'use-image'
import { useProjectStore } from '@/state/projectStore'
import { DESIGN_WIDTH, computePlaceholderBoxes, resolvePageInsetsPx, edgeInsetToPx } from '@/engine/layoutMath'
import { computeCoverCrop } from '@/engine/cropFit'
import { ensureFontLoaded } from '@/engine/fonts'
import { quotesForEventType } from '@/engine/textSuggestions'
import { isEditableTarget } from '@/engine/keyboard'
import { importAndDedupe } from '@/engine/importWorkflow'
import { readDraggedPattern } from '@/engine/patterns'
import { imageToneFilter, applyBlackWhiteMix } from '@/engine/imageTone'
import { Spread, FrameStyle } from '@/types'
import Icon from './Icon'
import PhotoContextMenu from './PhotoContextMenu'
import { drawSpreadBackground } from '@/engine/renderSpread'

export const STAGE_WIDTH = DESIGN_WIDTH

function FixedBackground({ spread, height, onContextMenu }: { spread: Spread; height: number; onContextMenu: (e: Konva.KonvaEventObject<PointerEvent>) => void }) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement>()
  useEffect(() => {
    let active = true
    const next = document.createElement('canvas')
    next.width = STAGE_WIDTH; next.height = Math.round(height)
    const ctx = next.getContext('2d')
    if (ctx) void drawSpreadBackground(ctx, spread, next.width, next.height).then(() => { if (active) setCanvas(next) }).catch(() => { if (active) setCanvas(undefined) })
    return () => { active = false }
  }, [spread.backgroundPattern, spread.backgroundColor, height])
  return <KonvaImage name="page-background" image={canvas} width={STAGE_WIDTH} height={height} onContextMenu={onContextMenu} />
}

function PlaceholderImage({
  src,
  box,
  allBoxes,
  focalX,
  focalY,
  zoom,
  opacity,
  frameStyle,
  rotationDeg,
  relightIntensity,
  cornerRadiusPx,
  flipHorizontal,
  flipVertical,
  brightness,
  contrast,
  saturation,
  blackWhiteMix,
  borderWidth,
  borderColor,
  warmth,
  selected,
  multiSelected,
  canDrag,
  onSelect,
  onSwapTo,
  onContextMenu,
}: {
  src: string
  box: { placeholderId: string; x: number; y: number; width: number; height: number }
  allBoxes: { placeholderId: string; x: number; y: number; width: number; height: number }[]
  focalX: number
  focalY: number
  zoom: number
  opacity: number
  frameStyle: FrameStyle
  rotationDeg: number
  relightIntensity: number
  cornerRadiusPx: number
  flipHorizontal: boolean
  flipVertical: boolean
  brightness: number
  contrast: number
  saturation: number
  blackWhiteMix?: number[]
  borderWidth: number
  borderColor: string
  warmth: number
  selected: boolean
  multiSelected: boolean
  canDrag: boolean
  onSelect: (e: Konva.KonvaEventObject<Event>) => void
  onSwapTo: (targetPlaceholderId: string) => void
  onContextMenu: (e: Konva.KonvaEventObject<Event>) => void
}) {
  const [img] = useImage(src)

  const matPad = frameStyle === 'polaroid' ? Math.min(box.width, box.height) * 0.06 : 0
  const matPadBottom = frameStyle === 'polaroid' ? box.height * 0.16 : 0
  const photoW = box.width - matPad * 2
  const photoH = box.height - matPad - matPadBottom
  const crop = img ? computeCoverCrop(img.width, img.height, photoW, photoH, focalX, focalY, zoom) : null

  const tonedImage = useMemo(() => {
    if (!img || !crop) return undefined
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(photoW))
    canvas.height = Math.max(1, Math.ceil(photoH))
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.filter = imageToneFilter({ brightness, contrast, saturation })
    ctx.drawImage(img, crop.cropX, crop.cropY, crop.cropWidth, crop.cropHeight, 0, 0, canvas.width, canvas.height)
    applyBlackWhiteMix(ctx, blackWhiteMix)
    return canvas
  }, [img, brightness, contrast, saturation, blackWhiteMix, crop?.cropX, crop?.cropY, crop?.cropWidth, crop?.cropHeight, photoW, photoH])

  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2
  // Local coordinates are relative to the box center so rotation pivots there, matching the export renderer.
  const localBoxX = box.x - centerX
  const localBoxY = box.y - centerY
  const localPhotoX = localBoxX + matPad
  const localPhotoY = localBoxY + matPad

  return (
    <Group
      x={centerX}
      y={centerY}
      rotation={rotationDeg}
      draggable={canDrag}
      onDragStart={(e) => e.target.moveToTop()}
      onDragEnd={(e) => {
        // Relative (not raw) pointer position — accounts for the canvas's own zoom/pan transform
        // so box-hit-testing still lines up once the stage is scaled or panned.
        const pointer = e.target.getStage()?.getRelativePointerPosition()
        e.target.position({ x: centerX, y: centerY })
        e.target.getLayer()?.batchDraw()
        if (!pointer) return
        const target = allBoxes.find(
          (b) =>
            b.placeholderId !== box.placeholderId &&
            pointer.x >= b.x &&
            pointer.x <= b.x + b.width &&
            pointer.y >= b.y &&
            pointer.y <= b.y + b.height
        )
        if (target) onSwapTo(target.placeholderId)
      }}
    >
      {frameStyle === 'polaroid' && (
        <Rect x={localBoxX} y={localBoxY} width={box.width} height={box.height} fill="#ffffff" />
      )}
      {img && crop && (
        <KonvaImage
          image={tonedImage}
          x={localPhotoX}
          y={localPhotoY}
          width={photoW}
          height={photoH}
          offsetX={flipHorizontal ? photoW : 0}
          offsetY={flipVertical ? photoH : 0}
          scaleX={flipHorizontal ? -1 : 1}
          scaleY={flipVertical ? -1 : 1}
          opacity={opacity}
          cornerRadius={frameStyle === 'rounded' ? cornerRadiusPx : 0}
          shadowEnabled={frameStyle === 'shadow'}
          shadowColor="black"
          shadowOpacity={0.45}
          shadowBlur={Math.max(box.width, box.height) * 0.04}
          shadowOffsetY={Math.max(box.width, box.height) * 0.015}
          onClick={onSelect}
          onTap={onSelect}
          onContextMenu={onContextMenu}
        />
      )}
      {img && crop && warmth !== 0 && (
        <Rect x={localPhotoX} y={localPhotoY} width={photoW} height={photoH}
          fill={warmth > 0 ? '#ffb347' : '#4aa3ff'} opacity={Math.min(Math.abs(warmth) / 100, 0.35)}
          cornerRadius={frameStyle === 'rounded' ? cornerRadiusPx : 0}
          globalCompositeOperation="overlay" listening={false} />
      )}
      {borderWidth > 0 && frameStyle !== 'polaroid' && <Rect x={localPhotoX + borderWidth / 2} y={localPhotoY + borderWidth / 2} width={Math.max(0, photoW - borderWidth)} height={Math.max(0, photoH - borderWidth)} stroke={borderColor} strokeWidth={borderWidth} cornerRadius={frameStyle === 'rounded' ? Math.max(0, cornerRadiusPx - borderWidth / 2) : 0} listening={false}/>}
      {multiSelected && (
        <Rect
          x={localBoxX}
          y={localBoxY}
          width={box.width}
          height={box.height}
          stroke="#ff9f43"
          strokeWidth={2.5}
          listening={false}
        />
      )}
      {img && crop && relightIntensity !== 0 && (
        <Rect
          x={localPhotoX}
          y={localPhotoY}
          width={photoW}
          height={photoH}
          listening={false}
          globalCompositeOperation="soft-light"
          cornerRadius={frameStyle === 'rounded' ? cornerRadiusPx : 0}
          fillRadialGradientStartPoint={{ x: photoW / 2, y: photoH / 2 }}
          fillRadialGradientEndPoint={{ x: photoW / 2, y: photoH / 2 }}
          fillRadialGradientStartRadius={0}
          fillRadialGradientEndRadius={Math.max(photoW, photoH) * 0.75}
          fillRadialGradientColorStops={
            relightIntensity > 0
              ? [0, `rgba(255,255,255,${0.65 * Math.min(relightIntensity / 100, 1)})`, 1, 'rgba(255,255,255,0)']
              : [0, 'rgba(0,0,0,0)', 1, `rgba(0,0,0,${0.55 * Math.min(-relightIntensity / 100, 1)})`]
          }
        />
      )}
      {selected && (
        <Rect
          x={localBoxX}
          y={localBoxY}
          width={box.width}
          height={box.height}
          stroke="#9c6b49"
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
        />
      )}
    </Group>
  )
}

export default function DesignerCanvas() {
  const gridMode=usePreferences(s=>s.values.gridMode)
  const project = useProjectStore((s) => s.project)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectedPlaceholderId = useProjectStore((s) => s.selectedPlaceholderId)
  const fontPreview = useProjectStore(s => s.fontPreview)
  const selectedTextBoxId = useProjectStore((s) => s.selectedTextBoxId)
  const selectPlaceholder = useProjectStore((s) => s.selectPlaceholder)
  const selectTextBox = useProjectStore((s) => s.selectTextBox)
  const setPlacementPhoto = useProjectStore((s) => s.setPlacementPhoto)
  const addPhotos = useProjectStore((s) => s.addPhotos)
  const updateSpread = useProjectStore((s) => s.updateSpread)
  const swapPlacements = useProjectStore((s) => s.swapPlacements)
  const selectedLayerKeys = useProjectStore(s=>s.selectedLayerKeys)
  const multiSelectedPlaceholderIds = useProjectStore((s) => s.multiSelectedPlaceholderIds)
  const setCanvasTool = useProjectStore(s => s.setCanvasTool)
  const selectedPhotoIds = useProjectStore((s) => s.selectedPhotoIds)
  const setSelectedPhotoIds = useProjectStore((s) => s.setSelectedPhotoIds)
  const updateTextBox = useProjectStore((s) => s.updateTextBox)
  const addTextBox = useProjectStore((s) => s.addTextBox)
  const showGrid = useProjectStore((s) => s.showGrid)
  const toggleGrid = useProjectStore((s) => s.toggleGrid)
  const showPrintGuides = useProjectStore((s) => s.showPrintGuides)
  const togglePrintGuides = useProjectStore((s) => s.togglePrintGuides)
  const updatePlacement = useProjectStore((s) => s.updatePlacement)
  const canvasTool = useProjectStore((s) => s.canvasTool)
  const setCanvasViewportMirror = useProjectStore((s) => s.setCanvasViewportMirror)
  const showGuides = useProjectStore((s) => s.showGuides)
  const moveGuide = useProjectStore((s) => s.moveGuide)
  const removeGuide = useProjectStore((s) => s.removeGuide)

  const templatePreview = useProjectStore(s => s.templatePreview)
  const baseSpread: Spread | undefined = templatePreview?.id === selectedSpreadId ? templatePreview : project.spreads.find((s) => s.id === selectedSpreadId)
  const size = baseSpread?.size ?? project.size
  const pickingGapAnchor=useProjectStore(s=>s.pickingGapAnchor)
  const gapAnchor=useProjectStore(s=>s.gapAnchor)
  type GapEditor = {axis:'x'|'y';keys:string[];x:number;y:number;value:string;dirty?:boolean;previewBase?:Spread;exactGap?:number}
  type GapSnapshot = {editor:GapEditor;anchor:GapAnchor}
  const [gapEditor,renderGapEditor]=useState<GapEditor|null>(null)
  const gapHistory=useRef<{current:GapSnapshot|null;initial:GapSnapshot|null;past:GapSnapshot[];future:GapSnapshot[]}>({current:null,initial:null,past:[],future:[]})
  function setGapEditor(editor:GapEditor|null,anchor:GapAnchor=useProjectStore.getState().gapAnchor){
    const history=gapHistory.current
    if(!editor){history.current=null;history.initial=null;history.past=[];history.future=[]}
    else {if(history.current)history.past.push(history.current);history.current={editor,anchor};history.initial??=history.current;history.future=[]}
    renderGapEditor(editor)
  }
  function resetGapPreview(){
    const initial=gapHistory.current.initial
    if(!initial)return
    setGapEditor({...initial.editor},initial.anchor)
    useProjectStore.getState().setGapAnchor(initial.anchor)
  }
  function stepGapHistory(redo:boolean){
    const history=gapHistory.current,from=redo?history.future:history.past,to=redo?history.past:history.future,next=from.pop()
    if(!next||!history.current)return
    to.push(history.current);history.current=next
    useProjectStore.getState().setGapAnchor(next.anchor);renderGapEditor(next.editor)
  }
  const [gapDrag,setGapDrag]=useState<{axis:'x'|'y';keys:string[];gap:number;guide:SmartGuide;match?:SmartGuide;anchor:GapAnchor;source:Spread}|null>(null)
  const gapDragRef=useRef<{axis:'x'|'y';keys:string[];start:number;initial:number;gap:number;maximum:number;pixels:number;guide:SmartGuide;base:Spread;source:Spread;anchor:GapAnchor;moved:boolean;last:number;raw:number;fine:boolean;candidates:{gap:number;guide:SmartGuide}[]}|null>(null)
  const suppressGapClick=useRef(false)
  const gapMode=gapEditor?.axis==='x'?'horizontal':'vertical'
  const normalizedGap=gapEditor?(gapEditor.exactGap??displayToIn(Number(gapEditor.value),project.units,size.dpi)/(gapEditor.axis==='x'?size.widthIn:size.heightIn)):NaN
  const gapBase=gapEditor?.previewBase??baseSpread
  const gapPreview=useMemo(()=>gapEditor?.dirty&&gapEditor.value.trim()!==''&&gapBase?arrangeLayerSelection(gapBase,project.size,gapEditor.keys,gapMode,'selection',normalizedGap,gapAnchor):gapBase,[gapBase,project.size,gapEditor,gapMode,normalizedGap,gapAnchor])
  const gapCanApply=!!(gapEditor?.dirty&&gapPreview&&gapPreview!==gapBase)
  const originalGap=gapHistory.current.initial?.editor
  const originalGapIn=originalGap?(originalGap.exactGap!==undefined?originalGap.exactGap*(originalGap.axis==='x'?size.widthIn:size.heightIn):displayToIn(Number(originalGap.value),project.units,size.dpi)):NaN
  const previewGapIn=gapDrag?gapDrag.gap*(gapDrag.axis==='x'?size.widthIn:size.heightIn):gapEditor&&(!gapEditor.dirty||gapCanApply)?normalizedGap*(gapEditor.axis==='x'?size.widthIn:size.heightIn):NaN
  const gapChange=inToDisplay(previewGapIn-originalGapIn,project.units,size.dpi)
  const gapChangeText=!Number.isFinite(gapChange)?'Enter a valid gap':gapChange===0?`No change · 0 ${project.units}`:`${gapChange>0?'+':'−'}${Math.abs(gapChange)} ${project.units} ${gapChange>0?'increase':'decrease'}`
  // Preview only the canvas; project data and Undo history change once, on Apply.
  const spread=useMemo(()=>gapDrag?arrangeLayerSelection(gapDrag.source,project.size,gapDrag.keys,gapDrag.axis==='x'?'horizontal':'vertical','selection',gapDrag.gap,gapDrag.anchor):gapPreview,[baseSpread,project.size,gapDrag,gapPreview])
  const [coverGuide] = useImage(spread?.coverDetails?.guideSrc ?? '')
  const [patternImage] = useImage(spread?.backgroundPattern?.src ?? '')
  const photosById = useMemo(() => new Map(project.photos.map((p) => [p.id, p])), [project.photos])
  const containerRef = useRef<HTMLDivElement>(null)

  const stageHeight = STAGE_WIDTH / (size.widthIn / size.heightIn)
  useEffect(()=>setGapEditor(null),[selectedPlaceholderId,selectedTextBoxId,selectedLayerKeys,spread?.id,project.units,canvasTool])
  useEffect(()=>setGapEditor(null),[baseSpread])
  useEffect(()=>{
    if(!gapEditor)return
    const cancel=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){
        e.preventDefault();e.stopImmediatePropagation()
        if(gapDragRef.current?.moved){gapDragRef.current=null;setGapDrag(null);suppressGapClick.current=true;return}
        stepGapHistory(e.shiftKey)
      }else if(e.key==='Escape'){
        e.preventDefault();e.stopImmediatePropagation();gapDragRef.current=null;setGapDrag(null);suppressGapClick.current=true;setGapEditor(null);useProjectStore.getState().setPickingGapAnchor(false)
      }
    }
    window.addEventListener('keydown',cancel,true)
    return()=>window.removeEventListener('keydown',cancel,true)
  },[!!gapEditor])
  const [smartGuides, setSmartGuides] = useState<SmartGuide[]>([])
  const [liveFrame, setLiveFrame] = useState<(GuideRect & {id:string}) | null>(null)
  useEffect(()=>{setSmartGuides([]);setLiveFrame(null)},[selectedPlaceholderId,selectedTextBoxId,spread?.id,canvasTool])
  const boxes = spread ? computePlaceholderBoxes(spread, STAGE_WIDTH, stageHeight).filter(b=>!spread.placements.find(p=>p.placeholderId===b.placeholderId)?.hidden) : []
  const addImageFrame = useProjectStore((s) => s.addImageFrame)
  const updateImageFrame = useProjectStore((s) => s.updateImageFrame)
  const drawStartRef = useRef<{ x: number; y: number } | null>(null)
  const [draftFrame, setDraftFrame] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || (canvasTool !== 'frame' && canvasTool !== 'text')) return
      drawStartRef.current = null
      setDraftFrame(null)
      setCanvasTool('select')
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [canvasTool, setCanvasTool])
  const frameNodeRef = useRef<Konva.Rect>(null)
  const textNodeRef = useRef<Konva.Text>(null)
  const textTransformerRef = useRef<Konva.Transformer>(null)
  useEffect(()=>{if(textNodeRef.current&&textTransformerRef.current){textTransformerRef.current.nodes([textNodeRef.current]);textTransformerRef.current.getLayer()?.batchDraw()}},[selectedTextBoxId,spread?.textBoxes])
  const transformerRef = useRef<Konva.Transformer>(null)
  const selectedBox = boxes.find((box) => box.placeholderId === selectedPlaceholderId)
  useEffect(() => {
    const transformer = transformerRef.current
    const node = frameNodeRef.current
    if (transformer && node) { transformer.nodes([node]); transformer.getLayer()?.batchDraw() }
  }, [selectedPlaceholderId, selectedBox?.x, selectedBox?.y, selectedBox?.width, selectedBox?.height, canvasTool])

  const selectedGroupId=spread?.placements.find(p=>p.placeholderId===selectedPlaceholderId)?.groupId??spread?.textBoxes.find(t=>t.id===selectedTextBoxId)?.groupId
  const group=spread?(selectedGroupId?groupGeometry(spread,selectedGroupId,project.size):selectedLayerKeys.length>1?selectionGeometry(spread,selectedLayerKeys,project.size):null):null
  const transformKeys=group?.members.map(l=>l.kind+':'+l.id)??[]
  const selectionIdentity=transformKeys.join('|')
  const [isShiftDown,setIsShiftDown]=useState(false)
  const groupEditable=group&&!group.members.some(l=>l.value.locked||l.value.hidden)
  const groupNodeRef=useRef<Konva.Rect>(null)
  const groupTransformerRef=useRef<Konva.Transformer>(null)
  const [groupLive,setGroupLive]=useState<{x:number;y:number;scaleX:number;scaleY:number}|null>(null)
  useEffect(()=>{setGroupLive(null)},[selectionIdentity,spread])
  useEffect(()=>{if(groupNodeRef.current&&groupTransformerRef.current){groupTransformerRef.current.nodes([groupNodeRef.current]);groupTransformerRef.current.getLayer()?.batchDraw()}},[selectionIdentity,spread,canvasTool])
  const updateGroupPreview=()=>{const n=groupNodeRef.current;if(n&&group){const resizing=!!groupTransformerRef.current?.isTransforming();const rect={x:n.x(),y:n.y(),width:n.width()*n.scaleX(),height:n.height()*n.scaleY()};if(!resizing)n.position(alignRect(rect));else alignRect(rect,undefined,groupTransformerRef.current?.getActiveAnchor()??undefined,0);setGroupLive({x:n.x()-group.x*STAGE_WIDTH*n.scaleX(),y:n.y()-group.y*stageHeight*n.scaleY(),scaleX:n.scaleX(),scaleY:n.scaleY()})}}
  const commitGroup=()=>{const n=groupNodeRef.current;if(n&&spread&&transformKeys.length){useProjectStore.getState().transformSelection(spread.id,transformKeys,{x:n.x()/STAGE_WIDTH,y:n.y()/stageHeight,width:n.width()*n.scaleX()/STAGE_WIDTH,height:n.height()*n.scaleY()/stageHeight});n.scale({x:1,y:1});setGroupLive(null);setSmartGuides([])}}
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  useEffect(()=>{if(selectedLayerKeys.length||(editingTextId&&selectedTextBoxId!==editingTextId))setEditingTextId(null)},[selectedLayerKeys,selectedTextBoxId,editingTextId])
  const [photoContextMenu, setPhotoContextMenu] = useState<{ x: number; y: number; placeholderId?: string; openedAt: number } | null>(null)
  const stageRef = useRef<Konva.Stage>(null)
  // Double-clicking an empty frame opens a native file picker and drops the chosen photo straight
  // into that exact frame — the canvas-side counterpart to the dock's double-click-to-place,
  // for when a photo hasn't been imported yet.
  const framePickerInputRef = useRef<HTMLInputElement>(null)
  const framePickerTargetRef = useRef<string | null>(null)

  // Web fonts (quote suggestions, custom Inspector font picks) can finish loading after Konva
  // already painted text in a fallback typeface — redraw once the real font is ready.
  useEffect(() => {
    const onFontLoaded = () => stageRef.current?.batchDraw()
    window.addEventListener('album-studio:font-loaded', onFontLoaded)
    return () => window.removeEventListener('album-studio:font-loaded', onFontLoaded)
  }, [])

  useEffect(() => {
    spread?.textBoxes.forEach((t) => void ensureFontLoaded(t.fontFamily))
  }, [spread])

  // Canvas zoom/pan — mirrors Figma-style conventions: plain scroll pans, Ctrl/Cmd+scroll zooms
  // toward the cursor, Space/middle-click+drag pans, Ctrl/Cmd+0/+/- control zoom from the
  // keyboard.
  const [stageScale, setStageScale] = useState(1)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const isPanningRef = useRef(false)
  const panStartRef = useRef<{ x: number; y: number; stageX: number; stageY: number } | null>(null)

  // The Stage's actual on-screen pixel size — measured from the flex-filling viewport div that
  // wraps it (not the fixed STAGE_WIDTH logical coordinate space templates/placements are laid
  // out in) so the spread always has real room to fit into, however big or small the window and
  // side panels currently leave it. Falls back to the logical size before the first measurement.
  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({ width: STAGE_WIDTH, height: stageHeight })

  // Keeps panning from drifting off into empty space forever — the spread can be dragged until
  // only a small sliver of it remains on screen (not snapped rigidly to "fully visible", which
  // feels stuck), but no further. When the spread is smaller than the viewport at the current
  // zoom, it's centered on that axis instead of letting it slide around a viewport it already
  // fully fits in.
  const PAN_SLACK_PX = 160
  function clampPan(pos: { x: number; y: number }, scale: number) {
    const contentW = STAGE_WIDTH * scale
    const contentH = stageHeight * scale
    const clampAxis = (value: number, contentSize: number, viewportSize: number) => {
      const minVisible = viewportSize - contentSize - PAN_SLACK_PX
      const maxVisible = PAN_SLACK_PX
      if (minVisible >= maxVisible) return (viewportSize - contentSize) / 2
      return Math.min(maxVisible, Math.max(minVisible, value))
    }
    return {
      x: clampAxis(pos.x, contentW, viewportSize.width),
      y: clampAxis(pos.y, contentH, viewportSize.height),
    }
  }

  useEffect(() => {
    const el = viewportRef.current
    // The viewport div only exists once a spread is selected (the "no spread" branch below
    // renders a differently-sized placeholder instead) — re-run this effect whenever that
    // mounts/unmounts so the observer actually gets attached once there's something to measure,
    // rather than only trying once on the component's very first (spread-less) render.
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setViewportSize({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [Boolean(spread)])

  // "Fit Spread View" — scales the spread (preserving its own aspect ratio) to the largest size
  // that still fits entirely inside the measured viewport, and centers it. This is a real
  // computation off the actual available space, not a flat reset to some assumed-visible size.
  function fitToView() {
    const rawScale = Math.min(viewportSize.width / STAGE_WIDTH, viewportSize.height / stageHeight) * 0.94
    const scale = Math.max(0.05, Math.min(3, rawScale || 1))
    setStageScale(scale)
    setStagePos({
      x: (viewportSize.width - STAGE_WIDTH * scale) / 2,
      y: (viewportSize.height - stageHeight * scale) / 2,
    })
  }

  // "Zoom to 100%" — one logical pixel of the spread's own 900px-wide coordinate space per
  // screen pixel, centered in the viewport (may need panning/scrolling to see every edge, same
  // as any design tool's real "actual size").
  function zoomTo100() {
    setStageScale(1)
    setStagePos({
      x: (viewportSize.width - STAGE_WIDTH) / 2,
      y: (viewportSize.height - stageHeight) / 2,
    })
  }

  // Re-fit whenever the selected spread changes (switching pages shouldn't carry over a stale
  // zoomed-in view) or the available viewport space itself changes (window resize, toggling a
  // side panel, the bottom dock opening) — this is what keeps the spread auto-sized to whatever
  // room it actually has instead of silently overflowing/needing a scrollbar.
  useEffect(() => {
    fitToView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spread?.id, viewportSize.width, viewportSize.height, stageHeight])

  // Mirrors this canvas's own local zoom/pan state into the store, read-only, so Designer View's
  // ruler and zoom readout can reflect it without this component giving up ownership of the
  // interaction-critical state itself (see the store field's own doc comment).
  useEffect(() => {
    setCanvasViewportMirror(stageScale, stagePos)
  }, [stageScale, stagePos, setCanvasViewportMirror])

  // View menu's "Fit Spread View" / "Zoom to 100%" buttons and shortcuts dispatch these instead
  // of calling the functions directly, since they're fired from outside this component
  // (DesignerViewScreen's own zoom controls, MenuBar). Re-registered whenever the viewport or
  // spread size changes so the listener always closes over the current fit/100% math.
  useEffect(() => {
    window.addEventListener('album-studio:zoom-fit', fitToView)
    window.addEventListener('album-studio:zoom-100', zoomTo100)
    return () => {
      window.removeEventListener('album-studio:zoom-fit', fitToView)
      window.removeEventListener('album-studio:zoom-100', zoomTo100)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportSize.width, viewportSize.height, stageHeight])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (useProjectStore.getState().matchingTemplatesOpen) return
      if(e.key==='Shift')setIsShiftDown(true)
      if (e.code === 'Space' && !isEditableTarget(e.target)) {
        e.preventDefault()
        setIsSpaceDown(true)
      }
      if ((e.ctrlKey || e.metaKey) && !isEditableTarget(e.target)) {
        if (e.key === '0') {
          e.preventDefault()
          fitToView()
        } else if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          setStageScale((s) => Math.min(3, s * 1.15))
        } else if (e.key === '-') {
          e.preventDefault()
          setStageScale((s) => Math.max(0.1, s / 1.15))
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if(e.key==='Shift')setIsShiftDown(false)
      if (e.code === 'Space') setIsSpaceDown(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportSize.width, viewportSize.height, stageHeight])

  function guideTargets(excluded:string[]) {
    if(!spread)return []
    const layers=spreadLayers(spread).filter(l=>!l.value.hidden&&!excluded.includes(l.kind+':'+l.id))
    const units=[...new Set(layers.map(l=>l.value.groupId??l.kind+':'+l.id))]
    return units.flatMap(id=>{
      const keys=layers.filter(l=>(l.value.groupId??l.kind+':'+l.id)===id).map(l=>l.kind+':'+l.id)
      const g=selectionGeometry(spread,keys,project.size)
      return g?[{x:g.x*STAGE_WIDTH,y:g.y*stageHeight,width:g.width*STAGE_WIDTH,height:g.height*stageHeight,keys}]:[]
    })
  }
  const activeGuideKeys=transformKeys.length?transformKeys:selectedPlaceholderId?['image:'+selectedPlaceholderId]:selectedTextBoxId?['text:'+selectedTextBoxId]:selectedLayerKeys
  const activeGeometry=spread&&activeGuideKeys.length?selectionGeometry(spread,activeGuideKeys,project.size):null
  const anchorGeometry=gapEditor&&spread?selectionGeometry(spread,gapEditor.keys,project.size):activeGeometry
  const pickedAnchor=gapAnchor.includes(':')?anchorGeometry?.members.find(l=>l.kind+':'+l.id===gapAnchor):undefined
  useEffect(()=>{if(gapAnchor.includes(':')&&!pickedAnchor)useProjectStore.getState().setGapAnchor('first')},[gapAnchor,!!pickedAnchor])
  useEffect(()=>{useProjectStore.getState().setPickingGapAnchor(false)},[selectedSpreadId,selectedPlaceholderId,selectedTextBoxId,selectedLayerKeys,canvasTool])
  const anchorMembers=anchorGeometry?.members.filter(l=>!l.value.locked&&!l.value.hidden)??[]
  const orderedAnchorMembers=[...anchorMembers].sort((a,b)=>a.rect[gapEditor?.axis??'x']-b.rect[gapEditor?.axis??'x'])
  const markedAnchor=pickedAnchor??(gapEditor?(gapAnchor==='first'?orderedAnchorMembers[0]:gapAnchor==='last'?orderedAnchorMembers.at(-1):undefined):undefined)
  function switchGapAnchor(anchor:GapAnchor){
    if(anchor===gapAnchor){useProjectStore.getState().setPickingGapAnchor(false);return}
    // Rebase on the visible preview so choosing another anchor never jumps the layout.
    if(gapEditor)setGapEditor({...gapEditor,...(gapCanApply?{previewBase:gapPreview}:{})},anchor)
    useProjectStore.getState().setGapAnchor(anchor)
  }
  const restingGuides=activeGeometry&&canvasTool==='select'?snapRect({x:activeGeometry.x*STAGE_WIDTH,y:activeGeometry.y*stageHeight,width:activeGeometry.width*STAGE_WIDTH,height:activeGeometry.height*stageHeight,keys:activeGuideKeys},guideTargets(activeGuideKeys),STAGE_WIDTH,stageHeight,0).guides.filter(g=>g.segments):[]
  const selectedGapUnits=guideTargets([]).filter(t=>t.keys?.length&&t.keys.every(k=>activeGuideKeys.includes(k)))
  const sharedGapGuides=selectedSpacingGuides(selectedGapUnits)
  const guideInteraction=Konva.isDragging()||transformerRef.current?.isTransforming()||textTransformerRef.current?.isTransforming()||groupTransformerRef.current?.isTransforming()
  const displayedGuides=gapDrag?[...(sharedGapGuides.length?sharedGapGuides:[{...gapDrag.guide,segments:gapDrag.guide.segments?.map(s=>{const delta=gapDrag.gap*(gapDrag.axis==='x'?STAGE_WIDTH:stageHeight)-(s.to-s.from),factor=gapDrag.anchor.includes(':')&&pickedAnchor?(pickedAnchor.rect[gapDrag.axis]*(gapDrag.axis==='x'?STAGE_WIDTH:stageHeight)>=s.to-.01?1:0):gapDrag.anchor==='first'?0:gapDrag.anchor==='last'?1:.5;return {...s,from:s.from-delta*factor,to:s.to+delta*(1-factor)}})}]),...(gapDrag.match?[gapDrag.match]:[])]:guideInteraction||smartGuides.length?smartGuides:sharedGapGuides.length?sharedGapGuides:restingGuides
  function beginGapDrag(e:Konva.KonvaEventObject<MouseEvent>,g:SmartGuide,segment:NonNullable<SmartGuide['segments']>[number]) {
    e.cancelBubble=true
    if(e.evt.button!==0||!segment.keys||!baseSpread||!spread)return
    suppressGapClick.current=false
    const axis=g.axis,dimension=axis==='x'?STAGE_WIDTH:stageHeight,initial=(segment.to-segment.from)/dimension
    const geometry=selectionGeometry(spread,segment.keys,project.size)
    if(!geometry||arrangeLayerSelection(spread,project.size,segment.keys,axis==='x'?'horizontal':'vertical','selection',initial,gapAnchor)===spread)return
    const editedUnits=guideTargets([]).filter(t=>t.keys?.some(k=>segment.keys!.includes(k))).sort((a,b)=>a[axis]-b[axis])
    const pickedIndex=editedUnits.findIndex(u=>u.keys?.includes(gapAnchor))
    const moving=gapAnchor==='last'||pickedIndex===editedUnits.length-1?editedUnits[0]:editedUnits.at(-1),movingKeys=(pickedIndex>=0?editedUnits.filter((_,i)=>i!==pickedIndex):gapAnchor==='first'?editedUnits.slice(1):gapAnchor==='last'?editedUnits.slice(0,-1):editedUnits).flatMap(t=>t.keys??[])
    const remainingBefore=geometry[axis],remainingAfter=1-geometry[axis]-geometry[axis==='x'?'width':'height']
    const intervals=Math.max(1,editedUnits.length-1)
    const room=pickedIndex>=0?Math.min(pickedIndex?remainingBefore/pickedIndex:Infinity,pickedIndex<intervals?remainingAfter/(intervals-pickedIndex):Infinity)*intervals:gapAnchor==='first'?remainingAfter:gapAnchor==='last'?remainingBefore:2*Math.min(remainingBefore,remainingAfter)
    const candidates=moving?nearbySpacingGaps(moving,guideTargets(movingKeys),axis).map(c=>({...c,gap:c.gap/dimension})):[]
    gapDragRef.current={axis,keys:segment.keys,start:axis==='x'?e.evt.clientX:e.evt.clientY,initial,gap:initial,maximum:Math.max(0,initial+room/Math.max(1,editedUnits.length-1)),pixels:dimension*stageScale,guide:{...g,segments:[segment]},base:baseSpread,source:spread,anchor:gapAnchor,moved:false,last:axis==='x'?e.evt.clientX:e.evt.clientY,raw:initial,fine:e.evt.shiftKey,candidates}
  }
  useEffect(()=>{
    const cancel=()=>{if(gapDragRef.current?.moved){suppressGapClick.current=true;setGapEditor(null)}gapDragRef.current=null;setGapDrag(null)}
    const move=(e:MouseEvent)=>{const d=gapDragRef.current;if(!d)return
      const delta=(d.axis==='x'?e.clientX:e.clientY)-d.start
      if(!d.moved&&Math.abs(delta)<3)return
      const point=d.axis==='x'?e.clientX:e.clientY
      if(d.fine!==e.shiftKey){d.raw=d.gap;d.fine=e.shiftKey}
      d.raw=Math.max(0,Math.min(d.maximum,d.raw+(point-d.last)/d.pixels*(e.shiftKey ? 0.1 : 1)));d.last=point
      const match=e.shiftKey?undefined:d.candidates.filter(c=>c.gap<=d.maximum&&Math.abs(c.gap-d.raw)<=6/d.pixels).sort((a,b)=>Math.abs(a.gap-d.raw)-Math.abs(b.gap-d.raw))[0]
      if(!gapHistory.current.current){
        const state=useProjectStore.getState(),size=d.base.size??state.project.size,segment=d.guide.segments![0]
        setGapEditor({axis:d.axis,keys:d.keys,x:d.axis==='x'?(segment.from+segment.to)/2:d.guide.position,y:d.axis==='x'?d.guide.position:(segment.from+segment.to)/2,value:String(inToDisplay(d.initial*(d.axis==='x'?size.widthIn:size.heightIn),state.project.units,size.dpi)),exactGap:d.initial,previewBase:d.source},d.anchor)
      }
      d.moved=true;suppressGapClick.current=true;d.gap=match?.gap??d.raw
      setGapDrag({axis:d.axis,keys:d.keys,gap:d.gap,guide:d.guide,match:match?.guide,anchor:d.anchor,source:d.source})
    }
    const finish=()=>{const d=gapDragRef.current;if(!d)return
      const state=useProjectStore.getState()
      if(d.moved&&state.project.spreads.find(s=>s.id===d.base.id)===d.base){
        const size=d.base.size??state.project.size,segment=d.guide.segments![0]
        setGapEditor({axis:d.axis,keys:d.keys,x:d.axis==='x'?(segment.from+segment.to)/2:d.guide.position,y:d.axis==='x'?d.guide.position:(segment.from+segment.to)/2,value:String(inToDisplay(d.gap*(d.axis==='x'?size.widthIn:size.heightIn),state.project.units,size.dpi)),exactGap:d.gap,dirty:true,previewBase:d.source})
      }
      gapDragRef.current=null;setGapDrag(null)
    }
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&useProjectStore.getState().pickingGapAnchor){e.preventDefault();e.stopImmediatePropagation();useProjectStore.getState().setPickingGapAnchor(false);return}if(e.key==='Escape'&&gapDragRef.current){e.preventDefault();e.stopImmediatePropagation();setGapEditor(null);cancel()}}
    window.addEventListener('mousemove',move);window.addEventListener('mouseup',finish);window.addEventListener('keydown',key,true);window.addEventListener('blur',cancel)
    return()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',finish);window.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);gapDragRef.current=null}
  },[])
  useEffect(()=>{gapDragRef.current=null;setGapDrag(null)},[selectedSpreadId,selectedPlaceholderId,selectedTextBoxId,selectedLayerKeys,canvasTool,project.units])
  function alignRect(rect:GuideRect, id?:string, anchor?:string, threshold=6/stageScale) {
    const keys=transformKeys.length?transformKeys:id?spreadLayers(spread!).filter(l=>l.id===id).map(l=>l.kind+':'+l.id):[]
    const result=snapRect({...rect,keys},guideTargets(keys),STAGE_WIDTH,stageHeight,threshold,anchor,showGuides ? spread?.guides.vertical.map(v=>v*STAGE_WIDTH) : [],showGuides ? spread?.guides.horizontal.map(v=>v*stageHeight) : [])
    setSmartGuides(result.guides)
    return result.rect
  }
  function alignTransform(old: {x:number;y:number;width:number;height:number;rotation:number}, next: typeof old) {
    if(next.width<4*stageScale||next.height<4*stageScale)return old
    const rect=alignRect({x:(next.x-stagePos.x)/stageScale,y:(next.y-stagePos.y)/stageScale,width:next.width/stageScale,height:next.height/stageScale},selectedPlaceholderId??selectedTextBoxId??undefined,(selectedPlaceholderId ? transformerRef.current : textTransformerRef.current)?.getActiveAnchor()??undefined)
    return {...next,x:rect.x*stageScale+stagePos.x,y:rect.y*stageScale+stagePos.y,width:rect.width*stageScale,height:rect.height*stageScale}
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    if (!stage) return
    if (e.evt.ctrlKey || e.evt.metaKey) {
      const pointer = stage.getPointerPosition()
      if (!pointer) return
      const oldScale = stageScale
      const mousePointTo = {
        x: (pointer.x - stagePos.x) / oldScale,
        y: (pointer.y - stagePos.y) / oldScale,
      }
      const direction = e.evt.deltaY > 0 ? -1 : 1
      const scaleBy = 1.08
      const newScale = Math.max(0.4, Math.min(3, direction > 0 ? oldScale * scaleBy : oldScale / scaleBy))
      setStageScale(newScale)
      setStagePos(clampPan({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale }, newScale))
    } else {
      setStagePos((pos) => clampPan({ x: pos.x - e.evt.deltaX, y: pos.y - e.evt.deltaY }, stageScale))
    }
  }

  const marqueeStart=useRef<{x:number;y:number;base:string[]} | null>(null)
  const marqueeRect=useRef<GuideRect|null>(null)
  const [marquee,setMarquee]=useState<GuideRect|null>(null)
  function currentLayerSelection() {
    const state=useProjectStore.getState()
    if(state.selectedLayerKeys.length)return state.selectedLayerKeys
    if(!spread)return []
    if(state.selectedPlaceholderId)return layerMembers(spread,'image',state.selectedPlaceholderId).map(l=>l.kind+':'+l.id)
    if(state.selectedTextBoxId)return layerMembers(spread,'text',state.selectedTextBoxId).map(l=>l.kind+':'+l.id)
    return state.multiSelectedPlaceholderIds.map(id=>'image:'+id)
  }
  function toggleCanvasLayer(kind:'image'|'text',id:string) {
    if(!spread)return
    const keys=layerMembers(spread,kind,id).map(l=>l.kind+':'+l.id),current=currentLayerSelection()
    useProjectStore.getState().setLayerSelection(keys.every(k=>current.includes(k))?current.filter(k=>!keys.includes(k)):[...current,...keys])
  }
  useEffect(()=>{
    const cancel=(e:KeyboardEvent)=>{if(e.key==='Escape'&&marqueeStart.current){e.preventDefault();marqueeStart.current=null;marqueeRect.current=null;setMarquee(null)}}
    window.addEventListener('keydown',cancel,true)
    return ()=>window.removeEventListener('keydown',cancel,true)
  },[])
  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    setGapEditor(null)
    if (isSpaceDown || canvasTool === 'pan' || e.evt.button === 1) {
      e.evt.preventDefault()
      isPanningRef.current = true
      panStartRef.current = { x: e.evt.clientX, y: e.evt.clientY, stageX: stagePos.x, stageY: stagePos.y }
      return
    }
    if ((canvasTool === 'frame' || canvasTool === 'text') && e.evt.button === 0) {
      const point = e.target.getStage()?.getRelativePointerPosition()
      if (!point || point.x < 0 || point.y < 0 || point.x > STAGE_WIDTH || point.y > stageHeight) return
      drawStartRef.current = point
      setDraftFrame({ ...point, width: 0, height: 0 })
      return
    }
    if (canvasTool === 'zoom') {
      const stage = e.target.getStage()
      const pointer = stage?.getPointerPosition()
      if (!stage || !pointer) return
      const oldScale = stageScale
      const mousePointTo = { x: (pointer.x - stagePos.x) / oldScale, y: (pointer.y - stagePos.y) / oldScale }
      const scaleBy = 1.3
      // Shift+click zooms out, matching the reference app's Zoom Tool modifier convention.
      const newScale = Math.max(0.4, Math.min(3, e.evt.shiftKey ? oldScale / scaleBy : oldScale * scaleBy))
      setStageScale(newScale)
      setStagePos(clampPan({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale }, newScale))
      return
    }
    if (canvasTool==='select' && e.evt.button===0 && (e.target===e.target.getStage() || e.target.hasName('page-background'))) {
      const point=e.target.getStage()?.getRelativePointerPosition()
      if(point){marqueeStart.current={...point,base:e.evt.shiftKey?currentLayerSelection():[]};marqueeRect.current=null;if(!e.evt.shiftKey)useProjectStore.getState().setLayerSelection([])}
    }
  }

  function handleStageMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if(marqueeStart.current){
      const point=e.target.getStage()?.getRelativePointerPosition(),start=marqueeStart.current
      if(point){const rect={x:Math.min(point.x,start.x),y:Math.min(point.y,start.y),width:Math.abs(point.x-start.x),height:Math.abs(point.y-start.y)};marqueeRect.current=rect;setMarquee(rect)}
      return
    }
    if (drawStartRef.current) {
      const point = e.target.getStage()?.getRelativePointerPosition()
      if (!point) return
      const x = Math.max(0, Math.min(STAGE_WIDTH, point.x))
      const y = Math.max(0, Math.min(stageHeight, point.y))
      const start = drawStartRef.current
      setDraftFrame(alignRect({ x: Math.min(x, start.x), y: Math.min(y, start.y), width: Math.abs(x - start.x), height: Math.abs(y - start.y) },undefined,`${y < start.y ? 'top' : 'bottom'}-${x < start.x ? 'left' : 'right'}`))
      return
    }
    if (!isPanningRef.current || !panStartRef.current) return
    const start = panStartRef.current
    setStagePos(clampPan({ x: start.stageX + (e.evt.clientX - start.x), y: start.stageY + (e.evt.clientY - start.y) }, stageScale))
  }

  function handleStageMouseUp() {
    if(marqueeStart.current){
      const rect=marqueeRect.current
      if(rect&&spread&&Math.max(rect.width,rect.height)*stageScale>3){
        const keys=spreadLayers(spread).filter(l=>!l.value.locked&&!l.value.hidden).filter(l=>{
          const box=l.kind==='image'?boxes.find(b=>b.placeholderId===l.id):{x:l.value.x*STAGE_WIDTH,y:l.value.y*stageHeight,width:l.value.width*STAGE_WIDTH,height:l.value.height*stageHeight}
          return box&&box.x<=rect.x+rect.width&&box.x+box.width>=rect.x&&box.y<=rect.y+rect.height&&box.y+box.height>=rect.y
        }).map(l=>l.kind+':'+l.id)
        useProjectStore.getState().setLayerSelection([...marqueeStart.current.base,...keys])
      }
      marqueeStart.current=null;marqueeRect.current=null;setMarquee(null)
      return
    }
    if (drawStartRef.current && draftFrame && spread && (canvasTool === 'text' || canvasTool === 'frame')) {
      const rect = { x: draftFrame.x / STAGE_WIDTH, y: draftFrame.y / stageHeight, width: Math.min(1 - draftFrame.x / STAGE_WIDTH, (draftFrame.width >= 4 ? draftFrame.width : 300) / STAGE_WIDTH), height: Math.min(1 - draftFrame.y / stageHeight, (draftFrame.height >= 4 ? draftFrame.height : canvasTool === 'frame' ? 240 : 80) / stageHeight) }
      if (canvasTool === 'frame') {
        addImageFrame(spread.id, rect, selectedPhotoIds.length === 1 ? selectedPhotoIds[0] : undefined)
        setCanvasTool('select')
      }
      else if (canvasTool === 'text') {
        const id = uuid()
        addTextBox(spread.id, { id, ...rect, text: '', fontFamily: 'Arial', fontSize: 24, color: '#222222', align: 'left', bold: false, italic: false })
        selectTextBox(id)
        setEditingTextId(id)
      }
    }
    drawStartRef.current = null
    setDraftFrame(null)
    setSmartGuides([])
    isPanningRef.current = false
    panStartRef.current = null
  }

  function findBoxAt(x: number, y: number) {
    return [...boxes].reverse().find((b) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)
  }

  // Click a placeholder: shift/ctrl+click adds it to a multi-select for batch editing; a plain
  // click with exactly one photo selected in the bottom dock "places" it (click-to-place, an
  // easier alternative to drag-and-drop); otherwise it's a normal single-placeholder select.
  function handlePlaceholderClick(placeholderId: string, evt: Event) {
    if (canvasTool === 'frame' || canvasTool === 'text') return
    const keyEvt = evt as MouseEvent
    const isModified = 'shiftKey' in evt && (keyEvt.shiftKey || keyEvt.ctrlKey || keyEvt.metaKey)
    if (isModified) {
      toggleCanvasLayer('image',placeholderId)
      return
    }
    if (selectedPhotoIds.length === 1 && spread) {
      setPlacementPhoto(spread.id, placeholderId, selectedPhotoIds[0])
      setSelectedPhotoIds([], null)
      return
    }
    selectPlaceholder(placeholderId)
  }

  function handlePlaceholderContextMenu(placeholderId: string, evt: Event) {
    evt.preventDefault()
    evt.stopPropagation()
    const mouseEvt = evt as MouseEvent
    selectPlaceholder(placeholderId)
    setPhotoContextMenu({ openedAt: Date.now(), x: mouseEvt.clientX, y: mouseEvt.clientY, placeholderId })
  }

  async function handleContainerDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation() // handled here (import + place in one step) — don't also let GlobalDropZone import these
    if (!spread) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    // Invert the canvas's own zoom/pan transform — drop coordinates arrive in container CSS
    // pixels, but box positions are in the Stage's unscaled content space.
    const x = (e.clientX - rect.left - stagePos.x) / stageScale
    const y = (e.clientY - rect.top - stagePos.y) / stageScale
    const target = e.altKey && getPreferences().altDrop==='add' ? undefined : findBoxAt(x, y)
    const pattern = readDraggedPattern(e.dataTransfer)
    if (pattern) { updateSpread(spread.id, { backgroundPattern: pattern }); return }

    // Dragging a photo from the bottom dock onto a frame — the existing "place" path.
    const photoId = e.dataTransfer.getData('application/x-photo-id')
    if (photoId) {
      if (target) setPlacementPhoto(spread.id, target.placeholderId, photoId)
      else addImageFrame(spread.id, spread.isCover && boxes.length === 0 ? { x: 0, y: 0, width: 1, height: 1 } : { x: Math.max(0, Math.min(0.7, x / STAGE_WIDTH)), y: Math.max(0, Math.min(0.7, y / stageHeight)), width: 0.3, height: 0.3 }, photoId)
      return
    }

    // Dragging image files straight from the OS onto a frame — import them into the pool AND
    // drop the first one directly into the frame it landed on, so it's a single action instead
    // of "import, then find it in the dock, then drag it again."
    if (e.dataTransfer.files.length > 0) {
      const { newAssets, matchedAssets } = await importAndDedupe(Array.from(e.dataTransfer.files), project.photos)
      if (newAssets.length > 0) addPhotos(newAssets)
      if (matchedAssets.length > 0) {
        if (target) setPlacementPhoto(spread.id, target.placeholderId, matchedAssets[0].id)
        else addImageFrame(spread.id, spread.isCover && boxes.length === 0 ? { x: 0, y: 0, width: 1, height: 1 } : { x: Math.max(0, Math.min(0.7, x / STAGE_WIDTH)), y: Math.max(0, Math.min(0.7, y / stageHeight)), width: 0.3, height: 0.3 }, matchedAssets[0].id)
      }
    }
  }

  // Empty-frame double-click: remember which placeholder was double-clicked, then open the file
  // picker. The actual import + placement happens in handleFramePicked once a file is chosen.
  function handleEmptyFrameDoubleClick(placeholderId: string) {
    if(spread?.placements.find(p=>p.placeholderId===placeholderId)?.locked)return
    framePickerTargetRef.current = placeholderId
    framePickerInputRef.current?.click()
  }

  async function handleFramePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    const targetId = framePickerTargetRef.current
    e.target.value = ''
    framePickerTargetRef.current = null
    if (!files || files.length === 0 || !spread || !targetId) return
    const { newAssets, matchedAssets } = await importAndDedupe(Array.from(files), project.photos)
    if (newAssets.length > 0) addPhotos(newAssets)
    if (matchedAssets.length > 0) setPlacementPhoto(spread.id, targetId, matchedAssets[0].id)
  }

  if (!spread) {
    return (
      <div className="designer-canvas designer-canvas--empty">
        <div className="empty-state">
          <Icon name="upload" size={28} />
          <p>Drop images here to import them into the project.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="designer-canvas-wrap">
      <div className="designer-toolbar">
        {!selectedGroupId && selectedBox && !spread.placements.find(p => p.placeholderId === selectedBox.placeholderId)?.locked && !spread.placements.find(p => p.placeholderId === selectedBox.placeholderId)?.photoId && canvasTool === 'select' && <div className="frame-tool-hint"><strong>Empty image frame</strong><span>Drag handles to resize</span><button className="btn" onClick={() => handleEmptyFrameDoubleClick(selectedBox.placeholderId)}>Add image…</button><button className="btn" onClick={() => useProjectStore.getState().removeImageFrame(spread.id, selectedBox.placeholderId)}>Remove frame</button></div>}
        {canvasTool === 'frame' && <div className="frame-tool-hint" role="status"><strong>Image frame</strong><span>Drag to draw · Click for a standard frame</span><button className="btn" onClick={() => setCanvasTool('select')}>Done</button></div>}
        <button
          className="btn"
          onClick={() =>
            addTextBox(spread.id, {
              id: uuid(),
              x: 0.1,
              y: 0.1,
              width: 0.4,
              height: 0.15,
              text: 'Double-click to edit',
              fontFamily: 'Georgia',
              fontSize: 24,
              color: '#222222',
              align: 'left',
              bold: false,
              italic: false,
            })
          }
        >
          <Icon name="type" size={14} />
          Add Text
        </button>
        <select
          className="toolbar-quote-select"
          value=""
          onChange={(e) => {
            const quote = quotesForEventType(project.eventType)[Number(e.target.value)]
            if (!quote) return
            void ensureFontLoaded(quote.fontFamily)
            addTextBox(spread.id, {
              id: uuid(),
              x: 0.1,
              y: 0.42,
              width: 0.8,
              height: 0.16,
              text: quote.text,
              fontFamily: quote.fontFamily,
              fontSize: quote.fontSize,
              color: quote.color,
              align: quote.align,
              bold: quote.bold,
              italic: quote.italic,
            })
            e.target.value = ''
          }}
        >
          <option value="" disabled>
            ✨ Insert matching quote…
          </option>
          {quotesForEventType(project.eventType).map((q, i) => (
            <option key={q.text} value={i}>
              “{q.text}” — {q.fontFamily}
            </option>
          ))}
        </select>
        <label className="toolbar-toggle">
          <input type="checkbox" checked={showGrid} onChange={toggleGrid} />
          Rule-of-thirds grid
        </label>
        <label className="toolbar-toggle">
          <input type="checkbox" checked={showPrintGuides} onChange={togglePrintGuides} />
          Print guides (<span style={{ color: '#d95339' }}>bleed</span> / <span style={{ color: '#9fcb99' }}>safety</span>)
        </label>
        <button className="btn btn--tiny toolbar-zoom" title="Fit spread to view (Ctrl/Cmd+0)" onClick={fitToView}>
          {Math.round(stageScale * 100)}%
        </button>
      </div>
      <div className="designer-canvas-viewport" ref={viewportRef}>
      <div
        className={`designer-canvas ${isSpaceDown || canvasTool === 'pan' ? 'designer-canvas--pan' : ''} ${canvasTool === 'zoom' ? 'designer-canvas--zoom' : ''} ${canvasTool === 'frame' ? 'designer-canvas--frame' : ''}`}
        ref={containerRef}
        // stopPropagation on every drag stage (not just drop) keeps GlobalDropZone's window-wide
        // "drop anywhere" overlay from popping up and covering the exact frame the user is
        // trying to drop onto — this container already has its own, more specific handling.
        onDragEnter={(e) => e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={(e) => void handleContainerDrop(e)}
      >
      <Stage
        ref={stageRef}
        width={Math.max(1, Math.round(viewportSize.width))}
        height={Math.max(1, Math.round(viewportSize.height))}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onMouseLeave={handleStageMouseUp}
      >
        <Layer>
           <Rect name="page-background" x={0} y={0} width={STAGE_WIDTH} height={stageHeight} fill={spread.backgroundHidden ? '#ffffff' : spread.backgroundColor} />
           {!spread.backgroundHidden && patternImage && spread.backgroundPattern && (spread.backgroundPattern.mode === 'cover'
             ? <FixedBackground spread={spread} height={stageHeight} onContextMenu={e => { e.evt.preventDefault(); e.evt.stopPropagation(); setPhotoContextMenu({ openedAt: Date.now(), x: e.evt.clientX, y: e.evt.clientY }) }} />
             : <Rect x={0} y={0} width={STAGE_WIDTH} height={stageHeight} fillPatternImage={patternImage} fillPatternScaleX={spread.backgroundPattern.tileSizePx / patternImage.width} fillPatternScaleY={spread.backgroundPattern.tileSizePx / patternImage.width} listening={false} />)}

          {spreadLayers(spread).filter(layer=>!layer.value.hidden).map(layer=>{
            if(layer.kind==='text') {
              const box=layer.value
            const x = box.x * STAGE_WIDTH
            const y = box.y * stageHeight
            return (
              <Group key={box.id} name={`text-layer-${box.id}`} {...(transformKeys.includes('text:'+box.id)?groupLive:null)}><KonvaText
                key={box.id}
                ref={selectedTextBoxId===box.id?textNodeRef:undefined}
                x={x}
                y={y}
                width={box.width * STAGE_WIDTH}
                height={box.height * stageHeight}
                text={box.text}
                fontFamily={fontPreview?.textBoxId === box.id ? fontPreview.family : box.fontFamily}
                fontSize={box.fontSize}
                fontStyle={`${box.bold ? 'bold' : ''} ${box.italic ? 'italic' : ''}`.trim() || 'normal'}
                fill={box.color}
                align={box.align}
                draggable={!box.groupId && !box.locked && canvasTool === 'select' && !isSpaceDown}
                onClick={e=>{if(e.evt.shiftKey||e.evt.ctrlKey||e.evt.metaKey)toggleCanvasLayer('text',box.id);else selectTextBox(box.id)}}
                onTap={() => selectTextBox(box.id)}
                onDblClick={e => { if(!box.locked&&!e.evt.shiftKey) setEditingTextId(box.id) }}
                onDragMove={e=>{const rect=alignRect({x:e.target.x(),y:e.target.y(),width:e.target.width(),height:e.target.height()},box.id);e.target.position(rect)}}
                onTransform={e=>{const node=e.target;node.width(Math.max(4,node.width()*node.scaleX()));node.height(Math.max(4,node.height()*node.scaleY()));node.scale({x:1,y:1})}}
                onTransformEnd={e=>{const node=e.target;updateTextBox(spread.id,box.id,{x:node.x()/STAGE_WIDTH,y:node.y()/stageHeight,width:node.width()/STAGE_WIDTH,height:node.height()/stageHeight});setSmartGuides([])}}
                onDragEnd={(e) => {
                  setSmartGuides([])
                  updateTextBox(spread.id, box.id, {
                    x: e.target.x() / STAGE_WIDTH,
                    y: e.target.y() / stageHeight,
                  })
                }}
                stroke={selectedTextBoxId === box.id || selectedLayerKeys.includes('text:'+box.id) ? '#9c6b49' : undefined}
                strokeWidth={selectedTextBoxId === box.id || selectedLayerKeys.includes('text:'+box.id) ? 0.6 : 0}
              /></Group>
            )

            }
            const box=boxes.find(b=>b.placeholderId===layer.id)
            if(!box)return null
            return <Group key={layer.id} name={`image-layer-${layer.id}`} {...(transformKeys.includes('image:'+layer.id)?groupLive:null)}>
          {[box].map((box) => {
            const placement = spread.placements.find((p) => p.placeholderId === box.placeholderId)
            const photo = placement?.photoId ? photosById.get(placement.photoId) : undefined
            if (photo) return null
            return (
              <Rect
                key={`bg-${box.placeholderId}`}
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill="rgba(0,0,0,0)"
                stroke={
                  multiSelectedPlaceholderIds.includes(box.placeholderId)
                    ? '#ff9f43'
                    : selectedPlaceholderId === box.placeholderId
                      ? '#9c6b49'
                      : photo
                        ? '#ddd0bf'
                        : '#c7b8a2'
                }
                strokeWidth={multiSelectedPlaceholderIds.includes(box.placeholderId) ? 2.5 : 1}
                dash={[6, 5]}
                onClick={(e) => handlePlaceholderClick(box.placeholderId, e.evt)}
                onTap={(e) => handlePlaceholderClick(box.placeholderId, e.evt)}
                onDblClick={() => !photo && handleEmptyFrameDoubleClick(box.placeholderId)}
                onDblTap={() => !photo && handleEmptyFrameDoubleClick(box.placeholderId)}
              />
            )
          })}

          {/* "Drop photo here" hint — matches the reference app's empty-frame dropzone affordance
              instead of a bare gray rectangle, so it's obvious every empty box accepts a drop or
              a click-to-place from the dock. Skipped on cells too small to hold the label. */}
          {[box].map((box) => {
            const placement = spread.placements.find((p) => p.placeholderId === box.placeholderId)
            const photo = placement?.photoId ? photosById.get(placement.photoId) : undefined
            if (photo || box.width < 70 || box.height < 50) return null
            const cy = box.y + box.height / 2
            return (
              <Group key={`hint-${box.placeholderId}`} listening={false}>
                <KonvaText
                  x={box.x}
                  y={cy - 16}
                  width={box.width}
                  align="center"
                  text="+"
                  fontSize={22}
                  fontStyle="bold"
                  fill="#b5a68f"
                />
                <KonvaText
                  x={box.x}
                  y={cy + 8}
                  width={box.width}
                  align="center"
                  text="Drop or double-click"
                  fontSize={11}
                  fill="#a89b86"
                />
              </Group>
            )
          })}

          {[box].map((box) => {
            const placement = spread.placements.find((p) => p.placeholderId === box.placeholderId)
            const photo = placement?.photoId ? photosById.get(placement.photoId) : undefined
            if (!photo || !placement) return null
            return (
              <PlaceholderImage
                key={box.placeholderId}
                src={photo.src}
                box={liveFrame?.id === box.placeholderId ? {...box,...liveFrame} : box}
                allBoxes={boxes}
                focalX={placement.focalX}
                focalY={placement.focalY}
                zoom={placement.zoom}
                opacity={placement.opacity}
                frameStyle={placement.frameStyle}
                rotationDeg={placement.rotationDeg}
                relightIntensity={placement.relightIntensity}
                cornerRadiusPx={placement.cornerRadiusPx}
                flipHorizontal={placement.flipHorizontal}
                flipVertical={placement.flipVertical}
                brightness={placement.brightness}
                contrast={placement.contrast}
                saturation={placement.saturation}
                blackWhiteMix={placement.blackWhiteMix}
                borderWidth={placement.borderWidth}
                borderColor={placement.borderColor}
                warmth={placement.warmth}
                selected={selectedPlaceholderId === box.placeholderId}
                multiSelected={multiSelectedPlaceholderIds.includes(box.placeholderId)}
                canDrag={canvasTool === 'select' && !isSpaceDown && !placement.locked && !placement.groupId}
                onSelect={(e) => handlePlaceholderClick(box.placeholderId, e.evt)}
                onSwapTo={(targetId) => swapPlacements(spread.id, box.placeholderId, targetId)}
                onContextMenu={(e) => handlePlaceholderContextMenu(box.placeholderId, e.evt)}
              />
            )
          })}

          {[box].filter(b=>spread.placements.find(p=>p.placeholderId===b.placeholderId)?.locked).map(b=><KonvaText key={`lock-${b.placeholderId}`} x={b.x+5/stageScale} y={b.y+5/stageScale} text="Locked" fontSize={12/stageScale} fill="#805638" listening={false} />)}
            </Group>
          })}
          {!selectedGroupId && selectedBox && !spread.placements.find(p=>p.placeholderId===selectedBox.placeholderId)?.locked && canvasTool === 'select' && <>
            <Rect ref={frameNodeRef} x={selectedBox.x} y={selectedBox.y} width={selectedBox.width} height={selectedBox.height}
              fill="rgba(0,0,0,0)" draggable
              onDragMove={e=>{const rect=alignRect({x:e.target.x(),y:e.target.y(),width:selectedBox.width,height:selectedBox.height},selectedBox.placeholderId);e.target.position(rect);setLiveFrame({...rect,id:selectedBox.placeholderId})}}
              onTransform={()=>{const node=frameNodeRef.current;if(node)setLiveFrame({id:selectedBox.placeholderId,x:node.x(),y:node.y(),width:node.width()*node.scaleX(),height:node.height()*node.scaleY()})}}
              onDragEnd={(e) => {updateImageFrame(spread.id, selectedBox.placeholderId, { x: e.target.x() / STAGE_WIDTH, y: e.target.y() / stageHeight, width: selectedBox.width / STAGE_WIDTH, height: selectedBox.height / stageHeight });setSmartGuides([]);setLiveFrame(null)}}
              onTransformEnd={() => {
                const node = frameNodeRef.current
                if (!node) return
                const rect = { x: node.x() / STAGE_WIDTH, y: node.y() / stageHeight, width: node.width() * node.scaleX() / STAGE_WIDTH, height: node.height() * node.scaleY() / stageHeight }
                node.scale({ x: 1, y: 1 })
                updateImageFrame(spread.id, selectedBox.placeholderId, rect)
                setSmartGuides([]);setLiveFrame(null)
              }}
              onClick={e=>{if(e.evt.shiftKey)toggleCanvasLayer('image',selectedBox.placeholderId)}}
              onDblClick={() => handleEmptyFrameDoubleClick(selectedBox.placeholderId)}
              onContextMenu={(e) => handlePlaceholderContextMenu(selectedBox.placeholderId, e.evt)} />
            <Transformer ref={transformerRef} borderStroke="#9c6b49" anchorStroke="#9c6b49" rotateEnabled={false} flipEnabled={false} boundBoxFunc={alignTransform} />
          </>}
          {group && group.members.some(l=>!l.value.hidden) && canvasTool==='select' && <>
            <Rect name="group-transform-box" listening={!isShiftDown} ref={groupNodeRef} x={group.x*STAGE_WIDTH} y={group.y*stageHeight} width={group.width*STAGE_WIDTH} height={group.height*stageHeight} stroke="#9c6b49" strokeWidth={1/stageScale} fill="rgba(0,0,0,0)" draggable={!!groupEditable&&!isSpaceDown} onDragMove={updateGroupPreview} onTransform={updateGroupPreview} onDragEnd={commitGroup} onTransformEnd={commitGroup} onClick={e=>{if(e.evt.shiftKey&&selectedGroupId)toggleCanvasLayer(selectedPlaceholderId?'image':'text',(selectedPlaceholderId??selectedTextBoxId)!)}}/>
            {groupEditable&&<Transformer ref={groupTransformerRef} rotateEnabled={false} flipEnabled={false} keepRatio enabledAnchors={['top-left','top-right','bottom-left','bottom-right']} borderStroke="#9c6b49" anchorStroke="#9c6b49" boundBoxFunc={(old,next)=>next.width<10||next.height<10?old:next}/>}
          </>}
          {draftFrame && <Rect {...draftFrame} stroke="#9c6b49" strokeWidth={1 / stageScale} dash={[4, 4]} listening={false} />}

            {spread.isCover && showPrintGuides && <>
              {coverGuide && <KonvaImage image={coverGuide} x={0} y={0} width={STAGE_WIDTH} height={stageHeight} opacity={0.45} listening={false} />}
              {spread.coverDetails && (() => {
                const wrap = spread.coverDetails.wrapIn * STAGE_WIDTH / size.widthIn
                const halfSpine = spread.coverDetails.spineIn * STAGE_WIDTH / size.widthIn / 2
                return <>
                  <Rect x={wrap} y={wrap} width={STAGE_WIDTH - 2 * wrap} height={stageHeight - 2 * wrap} stroke="#ffb347" dash={[5, 3]} listening={false} />
                  {[STAGE_WIDTH / 2 - halfSpine, STAGE_WIDTH / 2 + halfSpine].map((x, i) => <Line key={i} points={[x, 0, x, stageHeight]} stroke="#4fd6c0" dash={[2, 4]} listening={false} />)}
                </>
              })()}
            </>}
          {showPrintGuides &&
            (() => {
              const pxPerIn = STAGE_WIDTH / size.widthIn
              const trimPx = edgeInsetToPx(size.trim, pxPerIn)
              const safetyEdgeInset = {
                leftRight: size.trim.leftRight + size.safeZone.leftRight,
                topBottom: size.trim.topBottom + size.safeZone.topBottom,
                inside: size.trim.inside + size.safeZone.inside,
              }
              const safetyPx = edgeInsetToPx(safetyEdgeInset, pxPerIn)
              const trim = resolvePageInsetsPx(spread.pageSide, trimPx)
              const safety = resolvePageInsetsPx(spread.pageSide, safetyPx)
              return (
                <>
                  <Rect
                    x={trim.left}
                    y={trim.top}
                    width={STAGE_WIDTH - trim.left - trim.right}
                    height={stageHeight - trim.top - trim.bottom}
                    stroke="#d95339"
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    listening={false}
                  />
                  <Rect
                    x={safety.left}
                    y={safety.top}
                    width={STAGE_WIDTH - safety.left - safety.right}
                    height={stageHeight - safety.top - safety.bottom}
                    stroke="#9fcb99"
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                    listening={false}
                  />

                </>
              )
            })()}

          {!spread.isCover && spread.pageSide === 'spread' && <Line name="center-fold" points={[STAGE_WIDTH / 2, 0, STAGE_WIDTH / 2, stageHeight]} stroke="#dedede" strokeWidth={1} strokeScaleEnabled={false} listening={false} />}

          {showGuides &&
            spread.guides.vertical.map((pos, i) => (
              <Line
                key={`v-guide-${i}`}
                name="manual-guide-vertical"
                x={pos * STAGE_WIDTH}
                points={[0, 0, 0, stageHeight]}
                stroke="#4aa3ff"
                strokeWidth={1}
                strokeScaleEnabled={false}
                hitStrokeWidth={10 / stageScale}
                draggable={canvasTool === 'select' && !isSpaceDown}
                dragBoundFunc={(point) => ({ x: Math.max(stagePos.x, Math.min(stagePos.x + STAGE_WIDTH * stageScale, point.x)), y: stagePos.y })}
                onDragMove={(e) => {
                  const x = Math.min(STAGE_WIDTH, Math.max(0, e.target.x()))
                  e.target.x(x)
                }}
                onDragEnd={(e) => moveGuide(spread.id, 'vertical', i, e.target.x() / STAGE_WIDTH)}
                onDblClick={() => removeGuide(spread.id, 'vertical', i)}
                onDblTap={() => removeGuide(spread.id, 'vertical', i)}
              />
            ))}
          {showGuides &&
            spread.guides.horizontal.map((pos, i) => (
              <Line
                key={`h-guide-${i}`}
                name="manual-guide-horizontal"
                y={pos * stageHeight}
                points={[0, 0, STAGE_WIDTH, 0]}
                stroke="#4aa3ff"
                strokeWidth={1}
                strokeScaleEnabled={false}
                hitStrokeWidth={10 / stageScale}
                draggable={canvasTool === 'select' && !isSpaceDown}
                dragBoundFunc={(point) => ({ x: stagePos.x, y: Math.max(stagePos.y, Math.min(stagePos.y + stageHeight * stageScale, point.y)) })}
                onDragMove={(e) => {
                  const y = Math.min(stageHeight, Math.max(0, e.target.y()))
                  e.target.y(y)
                }}
                onDragEnd={(e) => moveGuide(spread.id, 'horizontal', i, e.target.y() / stageHeight)}
                onDblClick={() => removeGuide(spread.id, 'horizontal', i)}
                onDblTap={() => removeGuide(spread.id, 'horizontal', i)}
              />
            ))}

          {!selectedGroupId && selectedTextBoxId && !spread.textBoxes.find(t=>t.id===selectedTextBoxId)?.locked && !spread.textBoxes.find(t=>t.id===selectedTextBoxId)?.hidden && canvasTool==='select' && <Transformer ref={textTransformerRef} rotateEnabled={false} flipEnabled={false} boundBoxFunc={alignTransform} borderStroke="#9c6b49" anchorStroke="#9c6b49" />}
        </Layer>
        {(gridMode==='on' || (gridMode==='auto' && showGrid)) && <Layer listening={false} name="rule-of-thirds-grid">
          {[1 / 3, 2 / 3].flatMap(f => [
            [STAGE_WIDTH * f, 0, STAGE_WIDTH * f, stageHeight],
            [0, stageHeight * f, STAGE_WIDTH, stageHeight * f],
          ]).map((points, index) => <Group key={index}>
            <Line points={points} stroke="#242424" strokeWidth={3} strokeScaleEnabled={false} opacity={0.65} />
            <Line points={points} stroke="#ffffff" strokeWidth={1} strokeScaleEnabled={false} />
          </Group>)}
        </Layer>}
        <Layer listening={false} name="selection-marquee">{marquee&&<Rect {...marquee} fill="rgba(156,107,73,.12)" stroke="#9c6b49" strokeWidth={1/stageScale}/>}</Layer>
        <Layer name="smart-guides">
          {displayedGuides.map((g,i)=>g.segments?<Group key={i} name="equal-spacing-guide">{g.segments.map((s,j)=>{
            const x=g.axis==='x',tick=4/stageScale
            const label=`${inToDisplay((s.to-s.from)/STAGE_WIDTH*size.widthIn,project.units,size.dpi)} ${project.units}`
            const labelWidth=(label.length*8+12)/stageScale
            return <Group key={j}><Line listening={false} points={x?[s.from,g.position,s.to,g.position]:[g.position,s.from,g.position,s.to]} stroke="#9b59ff" strokeWidth={1} strokeScaleEnabled={false}/>{[s.from,s.to].map(p=><Line listening={false} key={p} points={x?[p,g.position-tick,p,g.position+tick]:[g.position-tick,p,g.position+tick,p]} stroke="#9b59ff" strokeWidth={1} strokeScaleEnabled={false}/>)}<KonvaText name="spacing-measurement" listening={canvasTool==='select'&&!!s.keys?.length} onMouseDown={e=>beginGapDrag(e,g,s)} onMouseEnter={e=>{e.target.getStage()!.container().style.cursor=g.axis==='x'?'ew-resize':'ns-resize'}} onMouseLeave={e=>{e.target.getStage()!.container().style.cursor=''}} onTouchStart={e=>{e.cancelBubble=true}} onClick={e=>{e.cancelBubble=true;if(suppressGapClick.current){suppressGapClick.current=false;return}if(s.keys){const pos=e.target.position();setGapEditor({axis:g.axis,keys:s.keys,x:pos.x,y:pos.y,previewBase:gapEditor?spread:undefined,dirty:gapEditor?.dirty,exactGap:(s.to-s.from)/(g.axis==='x'?STAGE_WIDTH:stageHeight),value:String(inToDisplay((s.to-s.from)/STAGE_WIDTH*size.widthIn,project.units,size.dpi))})}}} onTap={e=>{e.cancelBubble=true;if(s.keys){const pos=e.target.position();setGapEditor({axis:g.axis,keys:s.keys,x:pos.x,y:pos.y,previewBase:gapEditor?spread:undefined,dirty:gapEditor?.dirty,exactGap:(s.to-s.from)/(g.axis==='x'?STAGE_WIDTH:stageHeight),value:String(inToDisplay((s.to-s.from)/STAGE_WIDTH*size.widthIn,project.units,size.dpi))})}}} text={label} width={labelWidth} align="center" x={x?(s.from+s.to)/2-labelWidth/2:g.position+6/stageScale} y={x?g.position-17/stageScale:(s.from+s.to)/2-6/stageScale} fontSize={13/stageScale} fill="#9b59ff"/></Group>
          })}</Group>:<Line listening={false} key={i} points={g.axis==='x'?[g.position,0,g.position,stageHeight]:[0,g.position,STAGE_WIDTH,g.position]} stroke="#9b59ff" strokeWidth={1} strokeScaleEnabled={false} />)}
        </Layer>
        <Layer name="gap-anchor-picker">
          {pickedAnchor&&<Rect name="picked-gap-anchor" x={pickedAnchor.rect.x*STAGE_WIDTH} y={pickedAnchor.rect.y*stageHeight} width={pickedAnchor.rect.width*STAGE_WIDTH} height={pickedAnchor.rect.height*stageHeight} stroke="#9c6b49" strokeWidth={2/stageScale} dash={[5/stageScale,3/stageScale]} listening={false}/>}
          {!gapDrag&&(pickingGapAnchor||gapEditor)&&anchorMembers.map(l=><Rect key={l.kind+':'+l.id} name={`gap-anchor-candidate-${l.id}`} x={l.rect.x*STAGE_WIDTH} y={l.rect.y*stageHeight} width={l.rect.width*STAGE_WIDTH} height={l.rect.height*stageHeight} fill={pickingGapAnchor?"rgba(156,107,73,.12)":"rgba(156,107,73,.001)"} stroke={pickingGapAnchor?"#9c6b49":undefined} strokeWidth={1/stageScale} onMouseDown={e=>{e.cancelBubble=true}} onClick={e=>{e.cancelBubble=true;switchGapAnchor((l.kind+':'+l.id) as GapAnchor)}}/>)}
          {markedAnchor&&<Group name="fixed-anchor-badge" x={markedAnchor.rect.x*STAGE_WIDTH+4/stageScale} y={markedAnchor.rect.y*stageHeight+4/stageScale} scaleX={1/stageScale} scaleY={1/stageScale} listening={false}>
            <Rect width={72} height={28} cornerRadius={7} fill="#795034" stroke="#fffaf4" strokeWidth={1}/>
            <Circle x={14} y={7} radius={3} stroke="#fffaf4" strokeWidth={1.7}/>
            <Line points={[14,10,14,23]} stroke="#fffaf4" strokeWidth={1.7}/>
            <Line points={[8,14,20,14]} stroke="#fffaf4" strokeWidth={1.7}/>
            <Line points={[5,17,8,22,14,24,20,22,23,17]} tension={.4} stroke="#fffaf4" strokeWidth={1.7}/>
            <KonvaText text="Fixed" x={31} y={8} fontSize={12} fontStyle="bold" fill="#fffaf4"/>
          </Group>}
        </Layer>
      </Stage>
      {gapDrag&&<div className="canvas-anchor-hint" aria-label="Live gap change">{gapChangeText}</div>}
      {pickingGapAnchor&&<div className="canvas-anchor-hint" role="status">Click a selected element to keep it fixed · Escape cancels</div>}

      {gapEditor&&<form className="canvas-gap-editor" aria-label="Edit spacing" style={{visibility:pickingGapAnchor||gapDrag?'hidden':undefined,left:Math.max(8,Math.min(viewportSize.width-230,stagePos.x+gapEditor.x*stageScale)),top:Math.max(8,Math.min(viewportSize.height-315,anchorGeometry?(stagePos.y+(anchorGeometry.y+anchorGeometry.height)*stageHeight*stageScale+12+315<=viewportSize.height?stagePos.y+(anchorGeometry.y+anchorGeometry.height)*stageHeight*stageScale+12:stagePos.y+anchorGeometry.y*stageHeight*stageScale-315):stagePos.y+gapEditor.y*stageScale))}} onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();setGapEditor(null)}else if(e.key==='Enter'&&e.target instanceof HTMLInputElement){e.preventDefault();e.currentTarget.requestSubmit()}}} onSubmit={e=>{e.preventDefault();if(gapCanApply){useProjectStore.getState().updateSpread(spread.id,{customBoxes:gapPreview!.customBoxes,textBoxes:gapPreview!.textBoxes,flipped:gapPreview!.flipped});setGapEditor(null);setSmartGuides([])}}}>
        <label>Keep fixed<select aria-label="Canvas gap anchor" value={gapAnchor} onChange={e=>switchGapAnchor(e.target.value as GapAnchor)}><option value="first">First element</option><option value="center">Center</option><option value="last">Last element</option>{gapAnchor.includes(':')&&<option value={gapAnchor}>Picked element</option>}</select></label>
        <button className="btn btn--tiny" type="button" aria-pressed={pickingGapAnchor} onClick={()=>useProjectStore.getState().setPickingGapAnchor(!pickingGapAnchor)}>{pickingGapAnchor?'Cancel picking':'Pick anchor on canvas'}</button>
        <div className="canvas-gap-editor__comparison">
          <label>Original<span className="canvas-gap-editor__original" aria-label="Original gap">{gapHistory.current.initial?.editor.value} {project.units}</span></label>
          <label>Preview ({project.units})<input aria-label="Canvas spacing gap" type="number" step="any" min="0" autoFocus value={gapEditor.value} onFocus={e=>e.target.select()} onChange={e=>setGapEditor({...gapEditor,value:e.target.value,dirty:true,exactGap:undefined})}/></label>
        </div>
        <p className="canvas-gap-editor__change" aria-label="Gap change from original">{gapChangeText}</p>
        <div className="canvas-gap-editor__history">
          <button className="btn btn--tiny" type="button" aria-label="Undo gap change" aria-keyshortcuts="Control+Z" disabled={!gapHistory.current.past.length} onClick={()=>stepGapHistory(false)}>Undo<kbd>Ctrl+Z</kbd></button>
          <button className="btn btn--tiny" type="button" aria-label="Redo gap change" aria-keyshortcuts="Control+Shift+Z" disabled={!gapHistory.current.future.length} onClick={()=>stepGapHistory(true)}>Redo<kbd>Ctrl+Shift+Z</kbd></button>
        </div>
        <p>Click a selected element to switch anchors. Apply saves; Escape cancels all.</p>
        {gapEditor.dirty&&!gapCanApply&&<p role="status">Enter a gap that fits; the affected elements must be unlocked.</p>}
        <div><button className="btn btn--tiny" type="button" aria-label="Reset gap preview" title="Restore the spacing from when this editor opened" disabled={!gapEditor.dirty&&gapAnchor===gapHistory.current.initial?.anchor} onClick={resetGapPreview}>Reset</button><button className="btn btn--tiny" type="button" onClick={()=>setGapEditor(null)}>Cancel</button><button className="btn btn--tiny" type="submit" disabled={!gapCanApply}>Apply</button></div>
      </form>}
      {editingTextId &&
        (() => {
          const box = spread.textBoxes.find((t) => t.id === editingTextId)
          if (!box || box.hidden) return null
          return (
            <textarea
              className="text-edit-overlay"
              style={{
                left: stagePos.x + box.x * STAGE_WIDTH * stageScale,
                top: stagePos.y + box.y * stageHeight * stageScale,
                width: box.width * STAGE_WIDTH * stageScale,
                minHeight: box.height * stageHeight * stageScale,
                fontSize: box.fontSize * stageScale,
                fontFamily: fontPreview?.textBoxId === box.id ? fontPreview.family : box.fontFamily,
                color: box.color,
                fontWeight: box.bold ? 'bold' : 'normal',
                fontStyle: box.italic ? 'italic' : 'normal',
                textAlign: box.align,
              }}
              autoFocus
              defaultValue={box.text}
              onBlur={(e) => {
                updateTextBox(spread.id, box.id, { text: e.target.value })
                setEditingTextId(null)
              }}
            />
          )
        })()}
      </div>
      </div>
      {photoContextMenu && spread && <PhotoContextMenu key={JSON.stringify(photoContextMenu)} x={photoContextMenu.x} y={photoContextMenu.y} spreadId={spread.id} frameId={photoContextMenu.placeholderId} />}
      <input ref={framePickerInputRef} type="file" accept={IMAGE_FILE_ACCEPT} hidden onChange={(e) => void handleFramePicked(e)} />
    </div>
  )
}
