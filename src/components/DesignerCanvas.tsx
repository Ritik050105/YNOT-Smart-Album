import { useMemo, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Stage, Layer, Rect, Image as KonvaImage, Text as KonvaText, Line } from 'react-konva'
import useImage from 'use-image'
import { useProjectStore } from '@/state/projectStore'
import { computePlaceholderBoxes } from '@/engine/layoutMath'
import { computeCoverCrop } from '@/engine/cropFit'
import { Spread } from '@/types'

const STAGE_WIDTH = 900

function PlaceholderImage({
  src,
  box,
  allBoxes,
  focalX,
  focalY,
  zoom,
  opacity,
  selected,
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
  selected: boolean
  onSelect: () => void
  onSwapTo: (targetPlaceholderId: string) => void
}) {
  const [img] = useImage(src)
  const crop = img ? computeCoverCrop(img.width, img.height, box.width, box.height, focalX, focalY, zoom) : null

  return (
    <>
      {img && crop && (
        <KonvaImage
          image={img}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          crop={{ x: crop.cropX, y: crop.cropY, width: crop.cropWidth, height: crop.cropHeight }}
          opacity={opacity}
          onClick={onSelect}
          onTap={onSelect}
          draggable
          onDragStart={(e) => {
            e.target.moveToTop()
          }}
          onDragEnd={(e) => {
            const pointer = e.target.getStage()?.getPointerPosition()
            e.target.position({ x: box.x, y: box.y })
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
        />
      )}
      {selected && (
        <Rect
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          stroke="#4f8cff"
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
        />
      )}
    </>
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
  const updateTextBox = useProjectStore((s) => s.updateTextBox)
  const addTextBox = useProjectStore((s) => s.addTextBox)
  const showGrid = useProjectStore((s) => s.showGrid)
  const toggleGrid = useProjectStore((s) => s.toggleGrid)

  const spread: Spread | undefined = project.spreads.find((s) => s.id === selectedSpreadId)
  const photosById = useMemo(() => new Map(project.photos.map((p) => [p.id, p])), [project.photos])
  const containerRef = useRef<HTMLDivElement>(null)

  const stageHeight = STAGE_WIDTH / (project.size.widthIn / project.size.heightIn)
  const boxes = spread ? computePlaceholderBoxes(spread, STAGE_WIDTH, stageHeight) : []

  const [editingTextId, setEditingTextId] = useState<string | null>(null)

  function findBoxAt(x: number, y: number) {
    return boxes.find((b) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)
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
        <p className="muted">Select a spread from the left to start designing.</p>
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
          + Add Text
        </button>
        <label className="toolbar-toggle">
          <input type="checkbox" checked={showGrid} onChange={toggleGrid} />
          Rule-of-thirds grid
        </label>
      </div>
      <div
        className="designer-canvas"
        ref={containerRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleContainerDrop}
      >
      <Stage
        width={STAGE_WIDTH}
        height={stageHeight}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) {
            selectPlaceholder(null)
            selectTextBox(null)
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
                stroke={selectedPlaceholderId === box.placeholderId ? '#4f8cff' : '#d0d4db'}
                strokeWidth={1}
                onClick={() => selectPlaceholder(box.placeholderId)}
                onTap={() => selectPlaceholder(box.placeholderId)}
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
                selected={selectedPlaceholderId === box.placeholderId}
                onSelect={() => selectPlaceholder(box.placeholderId)}
                onSwapTo={(targetId) => swapPlacements(spread.id, box.placeholderId, targetId)}
              />
            )
          })}

          {showGrid &&
            [1 / 3, 2 / 3].flatMap((f) => [
              <Line key={`v${f}`} points={[STAGE_WIDTH * f, 0, STAGE_WIDTH * f, stageHeight]} stroke="#ff5c7a" strokeWidth={1} dash={[4, 4]} listening={false} />,
              <Line key={`h${f}`} points={[0, stageHeight * f, STAGE_WIDTH, stageHeight * f]} stroke="#ff5c7a" strokeWidth={1} dash={[4, 4]} listening={false} />,
            ])}

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
