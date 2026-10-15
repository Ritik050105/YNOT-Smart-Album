import { useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Stage, Layer, Rect, Group, Image as KonvaImage, Text as KonvaText, Line } from 'react-konva'
import type Konva from 'konva'
import useImage from 'use-image'
import { useProjectStore } from '@/state/projectStore'
import { computePlaceholderBoxes } from '@/engine/layoutMath'
import { computeCoverCrop } from '@/engine/cropFit'
import { ensureFontLoaded } from '@/engine/fonts'
import { quotesForEventType } from '@/engine/textSuggestions'
import { Spread, FrameStyle } from '@/types'
import Icon from './Icon'

const STAGE_WIDTH = 900

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
  selected,
  multiSelected,
  onSelect,
  onSwapTo,
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
  selected: boolean
  multiSelected: boolean
  onSelect: (e: Konva.KonvaEventObject<Event>) => void
  onSwapTo: (targetPlaceholderId: string) => void
}) {
  const [img] = useImage(src)

  const matPad = frameStyle === 'polaroid' ? Math.min(box.width, box.height) * 0.06 : 0
  const matPadBottom = frameStyle === 'polaroid' ? box.height * 0.16 : 0
  const photoW = box.width - matPad * 2
  const photoH = box.height - matPad - matPadBottom
  const crop = img ? computeCoverCrop(img.width, img.height, photoW, photoH, focalX, focalY, zoom) : null

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
        const pointer = e.target.getStage()?.getPointerPosition()
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
          image={img}
          x={localPhotoX}
          y={localPhotoY}
          width={photoW}
          height={photoH}
          crop={{ x: crop.cropX, y: crop.cropY, width: crop.cropWidth, height: crop.cropHeight }}
          opacity={opacity}
          cornerRadius={frameStyle === 'rounded' ? cornerRadiusPx : 0}
          shadowEnabled={frameStyle === 'shadow'}
          shadowColor="black"
          shadowOpacity={0.45}
          shadowBlur={Math.max(box.width, box.height) * 0.04}
          shadowOffsetY={Math.max(box.width, box.height) * 0.015}
          onClick={onSelect}
          onTap={onSelect}
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
          stroke="#4f8cff"
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

  const spread: Spread | undefined = project.spreads.find((s) => s.id === selectedSpreadId)
  const photosById = useMemo(() => new Map(project.photos.map((p) => [p.id, p])), [project.photos])
  const containerRef = useRef<HTMLDivElement>(null)

  const stageHeight = STAGE_WIDTH / (project.size.widthIn / project.size.heightIn)
  const boxes = spread ? computePlaceholderBoxes(spread, STAGE_WIDTH, stageHeight) : []

  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const stageRef = useRef<Konva.Stage>(null)

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

  function handleContainerDrop(e: React.DragEvent) {
    e.preventDefault()
    if (!spread) return
    const photoId = e.dataTransfer.getData('application/x-photo-id')
    if (!photoId) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const target = findBoxAt(x, y)
    if (target) setPlacementPhoto(spread.id, target.placeholderId, photoId)
  }

  if (!spread) {
    return (
      <div className="designer-canvas designer-canvas--empty">
        <div className="empty-state">
          <Icon name="frame" size={28} />
          <p>Select a spread from the left to start designing, or import photos to get going.</p>
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
      </div>
      <div
        className="designer-canvas"
        ref={containerRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleContainerDrop}
      >
      <Stage
        ref={stageRef}
        width={STAGE_WIDTH}
        height={stageHeight}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) {
            selectPlaceholder(null)
            selectTextBox(null)
            clearMultiSelect()
          }
        }}
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
                fill={photo ? undefined : '#e5e7eb'}
                stroke={
                  multiSelectedPlaceholderIds.includes(box.placeholderId)
                    ? '#ff9f43'
                    : selectedPlaceholderId === box.placeholderId
                      ? '#4f8cff'
                      : '#d0d4db'
                }
                strokeWidth={multiSelectedPlaceholderIds.includes(box.placeholderId) ? 2.5 : 1}
                onClick={(e) => handlePlaceholderClick(box.placeholderId, e.evt)}
                onTap={(e) => handlePlaceholderClick(box.placeholderId, e.evt)}
              />
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
                selected={selectedPlaceholderId === box.placeholderId}
                multiSelected={multiSelectedPlaceholderIds.includes(box.placeholderId)}
                onSelect={(e) => handlePlaceholderClick(box.placeholderId, e.evt)}
                onSwapTo={(targetId) => swapPlacements(spread.id, box.placeholderId, targetId)}
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
              const bleed = project.size.bleedIn * pxPerIn
              const safety = bleed + project.size.safeZoneIn * pxPerIn
              return (
                <>
                  <Rect x={bleed} y={bleed} width={STAGE_WIDTH - bleed * 2} height={stageHeight - bleed * 2} stroke="#ffb347" strokeWidth={1} dash={[5, 3]} listening={false} />
                  <Rect x={safety} y={safety} width={STAGE_WIDTH - safety * 2} height={stageHeight - safety * 2} stroke="#4fd6c0" strokeWidth={1} dash={[2, 4]} listening={false} />
                </>
              )
            })()}

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
                stroke={selectedTextBoxId === box.id ? '#4f8cff' : undefined}
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
  )
}
