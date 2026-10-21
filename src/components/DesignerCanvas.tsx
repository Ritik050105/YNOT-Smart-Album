import { useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Stage, Layer, Rect, Group, Image as KonvaImage, Text as KonvaText, Line } from 'react-konva'
import Konva from 'konva'
import useImage from 'use-image'
import { useProjectStore } from '@/state/projectStore'
import { computePlaceholderBoxes, resolvePageInsetsPx, centerGutterInsetPx, edgeInsetToPx } from '@/engine/layoutMath'
import { computeCoverCrop } from '@/engine/cropFit'
import { ensureFontLoaded } from '@/engine/fonts'
import { quotesForEventType } from '@/engine/textSuggestions'
import { isEditableTarget } from '@/engine/keyboard'
import { importAndDedupe } from '@/engine/importWorkflow'
import { Spread, FrameStyle } from '@/types'
import Icon from './Icon'
import ContextMenu, { ContextMenuItem } from './ContextMenu'

export const STAGE_WIDTH = 900

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
  selected,
  multiSelected,
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
  /** -100..100, same scale as the Inspector sliders — mapped onto Konva's own filter ranges
   *  below so the live canvas matches the export renderer's look instead of only showing tone
   *  adjustments after export. */
  brightness: number
  contrast: number
  saturation: number
  selected: boolean
  multiSelected: boolean
  onSelect: (e: Konva.KonvaEventObject<Event>) => void
  onSwapTo: (targetPlaceholderId: string) => void
  onContextMenu: (e: Konva.KonvaEventObject<Event>) => void
}) {
  const [img] = useImage(src)
  const imageRef = useRef<Konva.Image>(null)
  const hasToneFilters = brightness !== 0 || contrast !== 0 || saturation !== 0

  const matPad = frameStyle === 'polaroid' ? Math.min(box.width, box.height) * 0.06 : 0
  const matPadBottom = frameStyle === 'polaroid' ? box.height * 0.16 : 0
  const photoW = box.width - matPad * 2
  const photoH = box.height - matPad - matPadBottom
  const crop = img ? computeCoverCrop(img.width, img.height, photoW, photoH, focalX, focalY, zoom) : null

  // Konva filters require the node to be cached (rasterized) to apply; re-cache whenever the
  // image, crop, or filter values change, and drop the cache when no filters are active so
  // untouched photos stay cheap to redraw.
  useEffect(() => {
    const node = imageRef.current
    if (!node) return
    if (hasToneFilters) node.cache()
    else node.clearCache()
    node.getLayer()?.batchDraw()
  }, [img, hasToneFilters, brightness, contrast, saturation, crop?.cropX, crop?.cropY, crop?.cropWidth, crop?.cropHeight, photoW, photoH])

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
      draggable
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
          ref={imageRef}
          image={img}
          x={localPhotoX}
          y={localPhotoY}
          width={photoW}
          height={photoH}
          crop={{ x: crop.cropX, y: crop.cropY, width: crop.cropWidth, height: crop.cropHeight }}
          offsetX={flipHorizontal ? photoW : 0}
          offsetY={flipVertical ? photoH : 0}
          scaleX={flipHorizontal ? -1 : 1}
          scaleY={flipVertical ? -1 : 1}
          opacity={opacity}
          filters={hasToneFilters ? [Konva.Filters.Brighten, Konva.Filters.Contrast, Konva.Filters.HSL] : []}
          brightness={brightness / 100}
          contrast={contrast}
          saturation={saturation / 100}
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
  const project = useProjectStore((s) => s.project)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectedPlaceholderId = useProjectStore((s) => s.selectedPlaceholderId)
  const selectedTextBoxId = useProjectStore((s) => s.selectedTextBoxId)
  const selectPlaceholder = useProjectStore((s) => s.selectPlaceholder)
  const selectTextBox = useProjectStore((s) => s.selectTextBox)
  const setPlacementPhoto = useProjectStore((s) => s.setPlacementPhoto)
  const addPhotos = useProjectStore((s) => s.addPhotos)
  const swapPlacements = useProjectStore((s) => s.swapPlacements)
  const multiSelectedPlaceholderIds = useProjectStore((s) => s.multiSelectedPlaceholderIds)
  const toggleMultiSelectPlaceholder = useProjectStore((s) => s.toggleMultiSelectPlaceholder)
  const clearMultiSelect = useProjectStore((s) => s.clearMultiSelect)
  const selectedPhotoIds = useProjectStore((s) => s.selectedPhotoIds)
  const setSelectedPhotoIds = useProjectStore((s) => s.setSelectedPhotoIds)
  const updateTextBox = useProjectStore((s) => s.updateTextBox)
  const addTextBox = useProjectStore((s) => s.addTextBox)
  const showGrid = useProjectStore((s) => s.showGrid)
  const toggleGrid = useProjectStore((s) => s.toggleGrid)
  const showPrintGuides = useProjectStore((s) => s.showPrintGuides)
  const togglePrintGuides = useProjectStore((s) => s.togglePrintGuides)
  const updatePlacement = useProjectStore((s) => s.updatePlacement)
  const resetPlacementToOriginal = useProjectStore((s) => s.resetPlacementToOriginal)
  const copyToneAdjustments = useProjectStore((s) => s.copyToneAdjustments)
  const pasteToneAdjustments = useProjectStore((s) => s.pasteToneAdjustments)
  const toneClipboard = useProjectStore((s) => s.toneClipboard)
  const autoAlignPlacement = useProjectStore((s) => s.autoAlignPlacement)
  const autoAdjustPlacement = useProjectStore((s) => s.autoAdjustPlacement)
  const canvasTool = useProjectStore((s) => s.canvasTool)
  const setCanvasViewportMirror = useProjectStore((s) => s.setCanvasViewportMirror)
  const showGuides = useProjectStore((s) => s.showGuides)
  const moveGuide = useProjectStore((s) => s.moveGuide)
  const removeGuide = useProjectStore((s) => s.removeGuide)

  const spread: Spread | undefined = project.spreads.find((s) => s.id === selectedSpreadId)
  const photosById = useMemo(() => new Map(project.photos.map((p) => [p.id, p])), [project.photos])
  const containerRef = useRef<HTMLDivElement>(null)

  const stageHeight = STAGE_WIDTH / (project.size.widthIn / project.size.heightIn)
  const boxes = spread ? computePlaceholderBoxes(spread, STAGE_WIDTH, stageHeight) : []

  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [photoContextMenu, setPhotoContextMenu] = useState<{ x: number; y: number; placeholderId: string } | null>(null)
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
  }, [spread?.id, viewportSize.width, viewportSize.height])

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

  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (isSpaceDown || canvasTool === 'pan' || e.evt.button === 1) {
      e.evt.preventDefault()
      isPanningRef.current = true
      panStartRef.current = { x: e.evt.clientX, y: e.evt.clientY, stageX: stagePos.x, stageY: stagePos.y }
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
    if (e.target === e.target.getStage()) {
      selectPlaceholder(null)
      selectTextBox(null)
      clearMultiSelect()
    }
  }

  function handleStageMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!isPanningRef.current || !panStartRef.current) return
    const start = panStartRef.current
    setStagePos(clampPan({ x: start.stageX + (e.evt.clientX - start.x), y: start.stageY + (e.evt.clientY - start.y) }, stageScale))
  }

  function handleStageMouseUp() {
    isPanningRef.current = false
    panStartRef.current = null
  }

  function findBoxAt(x: number, y: number) {
    return boxes.find((b) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)
  }

  // Click a placeholder: shift/ctrl+click adds it to a multi-select for batch editing; a plain
  // click with exactly one photo selected in the bottom dock "places" it (click-to-place, an
  // easier alternative to drag-and-drop); otherwise it's a normal single-placeholder select.
  function handlePlaceholderClick(placeholderId: string, evt: Event) {
    const keyEvt = evt as MouseEvent
    const isModified = 'shiftKey' in evt && (keyEvt.shiftKey || keyEvt.ctrlKey || keyEvt.metaKey)
    if (isModified) {
      toggleMultiSelectPlaceholder(placeholderId)
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
    const mouseEvt = evt as MouseEvent
    setPhotoContextMenu({ x: mouseEvt.clientX, y: mouseEvt.clientY, placeholderId })
  }

  function photoContextMenuItems(placeholderId: string): ContextMenuItem[] {
    if (!spread) return []
    const placement = spread.placements.find((p) => p.placeholderId === placeholderId)
    if (!placement) return []
    const isBW = placement.saturation <= -100
    return [
      {
        label: 'Reload from Original',
        onClick: () => resetPlacementToOriginal(spread.id, placeholderId),
      },
      { label: 'Auto Adjust', onClick: () => void autoAdjustPlacement(spread.id, placeholderId) },
      { label: 'Auto Align', onClick: () => autoAlignPlacement(spread.id, placeholderId) },
      {
        label: isBW ? 'Remove Black & White' : 'Black & White',
        onClick: () => updatePlacement(spread.id, placeholderId, { saturation: isBW ? 0 : -100 }),
      },
      { label: 'Copy Tone Adjustments', onClick: () => copyToneAdjustments(spread.id, placeholderId) },
      {
        label: 'Paste Tone Adjustments',
        disabled: !toneClipboard,
        onClick: () => pasteToneAdjustments(spread.id, [placeholderId]),
      },
      {
        label: 'Clear Photo',
        danger: true,
        onClick: () => setPlacementPhoto(spread.id, placeholderId, null),
      },
    ]
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
    const target = findBoxAt(x, y)

    // Dragging a photo from the bottom dock onto a frame — the existing "place" path.
    const photoId = e.dataTransfer.getData('application/x-photo-id')
    if (photoId) {
      if (target) setPlacementPhoto(spread.id, target.placeholderId, photoId)
      return
    }

    // Dragging image files straight from the OS onto a frame — import them into the pool AND
    // drop the first one directly into the frame it landed on, so it's a single action instead
    // of "import, then find it in the dock, then drag it again."
    if (e.dataTransfer.files.length > 0) {
      const { newAssets } = await importAndDedupe(Array.from(e.dataTransfer.files), project.photos)
      if (newAssets.length > 0) {
        addPhotos(newAssets)
        if (target) setPlacementPhoto(spread.id, target.placeholderId, newAssets[0].id)
      }
    }
  }

  // Empty-frame double-click: remember which placeholder was double-clicked, then open the file
  // picker. The actual import + placement happens in handleFramePicked once a file is chosen.
  function handleEmptyFrameDoubleClick(placeholderId: string) {
    framePickerTargetRef.current = placeholderId
    framePickerInputRef.current?.click()
  }

  async function handleFramePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    const targetId = framePickerTargetRef.current
    e.target.value = ''
    framePickerTargetRef.current = null
    if (!files || files.length === 0 || !spread || !targetId) return
    const { newAssets } = await importAndDedupe(Array.from(files), project.photos)
    if (newAssets.length > 0) {
      addPhotos(newAssets)
      setPlacementPhoto(spread.id, targetId, newAssets[0].id)
    }
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
          Print guides (<span style={{ color: '#ffb347' }}>bleed</span> / <span style={{ color: '#4fd6c0' }}>safety</span>)
        </label>
        <button className="btn btn--tiny toolbar-zoom" title="Fit spread to view (Ctrl/Cmd+0)" onClick={fitToView}>
          {Math.round(stageScale * 100)}%
        </button>
      </div>
      <div className="designer-canvas-viewport" ref={viewportRef}>
      <div
        className={`designer-canvas ${isSpaceDown || canvasTool === 'pan' ? 'designer-canvas--pan' : ''} ${canvasTool === 'zoom' ? 'designer-canvas--zoom' : ''}`}
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
          <Rect x={0} y={0} width={STAGE_WIDTH} height={stageHeight} fill={spread.backgroundColor} />

          {boxes.map((box) => {
            const placement = spread.placements.find((p) => p.placeholderId === box.placeholderId)
            const photo = placement?.photoId ? photosById.get(placement.photoId) : undefined
            return (
              <Rect
                key={`bg-${box.placeholderId}`}
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill={photo ? undefined : '#f1e8da'}
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
                dash={photo ? undefined : [6, 5]}
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
          {boxes.map((box) => {
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

          {boxes.map((box) => {
            const placement = spread.placements.find((p) => p.placeholderId === box.placeholderId)
            const photo = placement?.photoId ? photosById.get(placement.photoId) : undefined
            if (!photo || !placement) return null
            return (
              <PlaceholderImage
                key={box.placeholderId}
                src={photo.src}
                box={box}
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
                selected={selectedPlaceholderId === box.placeholderId}
                multiSelected={multiSelectedPlaceholderIds.includes(box.placeholderId)}
                onSelect={(e) => handlePlaceholderClick(box.placeholderId, e.evt)}
                onSwapTo={(targetId) => swapPlacements(spread.id, box.placeholderId, targetId)}
                onContextMenu={(e) => handlePlaceholderContextMenu(box.placeholderId, e.evt)}
              />
            )
          })}

          {showGrid &&
            [1 / 3, 2 / 3].flatMap((f) => [
              <Line key={`v${f}`} points={[STAGE_WIDTH * f, 0, STAGE_WIDTH * f, stageHeight]} stroke="#ff5c7a" strokeWidth={1} dash={[4, 4]} listening={false} />,
              <Line key={`h${f}`} points={[0, stageHeight * f, STAGE_WIDTH, stageHeight * f]} stroke="#ff5c7a" strokeWidth={1} dash={[4, 4]} listening={false} />,
            ])}

          {showPrintGuides &&
            (() => {
              const pxPerIn = STAGE_WIDTH / project.size.widthIn
              const trimPx = edgeInsetToPx(project.size.trim, pxPerIn)
              const safetyEdgeInset = {
                leftRight: project.size.trim.leftRight + project.size.safeZone.leftRight,
                topBottom: project.size.trim.topBottom + project.size.safeZone.topBottom,
                inside: project.size.trim.inside + project.size.safeZone.inside,
              }
              const safetyPx = edgeInsetToPx(safetyEdgeInset, pxPerIn)
              const trim = resolvePageInsetsPx(spread.pageSide, trimPx)
              const safety = resolvePageInsetsPx(spread.pageSide, safetyPx)
              const centerX = STAGE_WIDTH / 2
              const trimGutter = centerGutterInsetPx(trimPx)
              const safetyGutter = centerGutterInsetPx(safetyPx)
              return (
                <>
                  <Rect
                    x={trim.left}
                    y={trim.top}
                    width={STAGE_WIDTH - trim.left - trim.right}
                    height={stageHeight - trim.top - trim.bottom}
                    stroke="#ffb347"
                    strokeWidth={1}
                    dash={[5, 3]}
                    listening={false}
                  />
                  <Rect
                    x={safety.left}
                    y={safety.top}
                    width={STAGE_WIDTH - safety.left - safety.right}
                    height={stageHeight - safety.top - safety.bottom}
                    stroke="#4fd6c0"
                    strokeWidth={1}
                    dash={[2, 4]}
                    listening={false}
                  />
                  {spread.pageSide === 'spread' && (
                    <>
                      <Line points={[centerX - trimGutter, 0, centerX - trimGutter, stageHeight]} stroke="#ffb347" strokeWidth={1} dash={[5, 3]} listening={false} />
                      <Line points={[centerX + trimGutter, 0, centerX + trimGutter, stageHeight]} stroke="#ffb347" strokeWidth={1} dash={[5, 3]} listening={false} />
                      <Line points={[centerX - safetyGutter, 0, centerX - safetyGutter, stageHeight]} stroke="#4fd6c0" strokeWidth={1} dash={[2, 4]} listening={false} />
                      <Line points={[centerX + safetyGutter, 0, centerX + safetyGutter, stageHeight]} stroke="#4fd6c0" strokeWidth={1} dash={[2, 4]} listening={false} />
                    </>
                  )}
                </>
              )
            })()}

          {showGuides &&
            spread.guides.vertical.map((pos, i) => (
              <Line
                key={`v-guide-${i}`}
                points={[pos * STAGE_WIDTH, 0, pos * STAGE_WIDTH, stageHeight]}
                stroke="#4aa3ff"
                strokeWidth={1}
                hitStrokeWidth={10}
                draggable
                dragBoundFunc={(pos2) => ({ x: pos2.x, y: 0 })}
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
                points={[0, pos * stageHeight, STAGE_WIDTH, pos * stageHeight]}
                stroke="#4aa3ff"
                strokeWidth={1}
                hitStrokeWidth={10}
                draggable
                dragBoundFunc={(pos2) => ({ x: 0, y: pos2.y })}
                onDragMove={(e) => {
                  const y = Math.min(stageHeight, Math.max(0, e.target.y()))
                  e.target.y(y)
                }}
                onDragEnd={(e) => moveGuide(spread.id, 'horizontal', i, e.target.y() / stageHeight)}
                onDblClick={() => removeGuide(spread.id, 'horizontal', i)}
                onDblTap={() => removeGuide(spread.id, 'horizontal', i)}
              />
            ))}

          {spread.textBoxes.map((box) => {
            const x = box.x * STAGE_WIDTH
            const y = box.y * stageHeight
            return (
              <KonvaText
                key={box.id}
                x={x}
                y={y}
                width={box.width * STAGE_WIDTH}
                text={box.text}
                fontFamily={box.fontFamily}
                fontSize={box.fontSize}
                fontStyle={`${box.bold ? 'bold' : ''} ${box.italic ? 'italic' : ''}`.trim() || 'normal'}
                fill={box.color}
                align={box.align}
                draggable
                onClick={() => selectTextBox(box.id)}
                onTap={() => selectTextBox(box.id)}
                onDblClick={() => setEditingTextId(box.id)}
                onDragEnd={(e) => {
                  updateTextBox(spread.id, box.id, {
                    x: e.target.x() / STAGE_WIDTH,
                    y: e.target.y() / stageHeight,
                  })
                }}
                stroke={selectedTextBoxId === box.id ? '#9c6b49' : undefined}
                strokeWidth={selectedTextBoxId === box.id ? 0.6 : 0}
              />
            )
          })}
        </Layer>
      </Stage>

      {editingTextId &&
        (() => {
          const box = spread.textBoxes.find((t) => t.id === editingTextId)
          if (!box) return null
          return (
            <textarea
              className="text-edit-overlay"
              style={{
                left: box.x * STAGE_WIDTH,
                top: box.y * stageHeight,
                width: box.width * STAGE_WIDTH,
                fontSize: box.fontSize,
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
      {photoContextMenu && (
        <ContextMenu
          x={photoContextMenu.x}
          y={photoContextMenu.y}
          items={photoContextMenuItems(photoContextMenu.placeholderId)}
          onClose={() => setPhotoContextMenu(null)}
        />
      )}
      <input ref={framePickerInputRef} type="file" accept="image/*" hidden onChange={(e) => void handleFramePicked(e)} />
    </div>
  )
}
