import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useProjectStore } from '@/state/projectStore'
import { PlacedPhoto, PhotoAsset, TemplateDefinition } from '@/types'
import { rankTemplates } from '@/engine/templateMatching'
import { templatesForCount, generateCustomGrid, TemplateFrameFilter } from '@/engine/templates'
import TemplateThumb from './TemplatePreview'
import { effectiveDpi, computeCoverCrop } from '@/engine/cropFit'
import { computePlaceholderBoxes } from '@/engine/layoutMath'
import { LOCAL_FONTS, CLOUD_FONTS, FontOption, getLocalFonts, ensureFontLoaded } from '@/engine/fonts'
import Icon from './Icon'
import SliderField from './SliderField'
import ColorField from './ColorField'
import { inToDisplay, displayToIn } from '@/engine/units'

export default function Inspector() {
  const [localFonts, setLocalFonts] = useState<FontOption[]>(LOCAL_FONTS)
  useEffect(() => {
    void getLocalFonts().then(setLocalFonts)
  }, [])

  const project = useProjectStore((s) => s.project)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectedPlaceholderId = useProjectStore((s) => s.selectedPlaceholderId)
  const selectedTextBoxId = useProjectStore((s) => s.selectedTextBoxId)
  const multiSelectedPlaceholderIds = useProjectStore((s) => s.multiSelectedPlaceholderIds)
  const updateSpread = useProjectStore((s) => s.updateSpread)
  const updatePlacement = useProjectStore((s) => s.updatePlacement)
  const updateImageFrame = useProjectStore((s) => s.updateImageFrame)
  const removeImageFrame = useProjectStore((s) => s.removeImageFrame)
  const updateMultiplePlacements = useProjectStore((s) => s.updateMultiplePlacements)
  const updateTextBox = useProjectStore((s) => s.updateTextBox)
  const removeTextBox = useProjectStore((s) => s.removeTextBox)
  const resetPlacementToOriginal = useProjectStore((s) => s.resetPlacementToOriginal)
  const applyTemplateToSpread = useProjectStore((s) => s.applyTemplateToSpread)
  const applyTemplateToAllSpreads = useProjectStore((s) => s.applyTemplateToAllSpreads)
  const saveSpreadAsTemplate = useProjectStore((s) => s.saveSpreadAsTemplate)
  const userTemplates = useProjectStore((s) => s.userTemplates)
  const toneClipboard = useProjectStore((s) => s.toneClipboard)
  const copyToneAdjustments = useProjectStore((s) => s.copyToneAdjustments)
  const pasteToneAdjustments = useProjectStore((s) => s.pasteToneAdjustments)
  const autoAlignPlacement = useProjectStore((s) => s.autoAlignPlacement)
  const autoAdjustPlacement = useProjectStore((s) => s.autoAdjustPlacement)
  const [autoAdjusting, setAutoAdjusting] = useState(false)
  // Shared with the menu bar's Templates menu (All Templates / Templates without square frames /
  // Templates only with 3:2 frame ratios), so picking it from either place stays in sync.
  const frameFilter = useProjectStore((s) => s.templateFrameFilter)
  const setFrameFilter = useProjectStore((s) => s.setTemplateFrameFilter)
  const [templateName, setTemplateName] = useState('')
  const [customRows, setCustomRows] = useState(3)
  const [customCols, setCustomCols] = useState(3)
  const openMatchingTemplates = useProjectStore(s => s.openMatchingTemplates)
  useEffect(() => {
    function onOpenGallery() {
      const state = useProjectStore.getState()
      if (state.selectedSpreadId) state.openMatchingTemplates(state.selectedSpreadId)
    }
    window.addEventListener('album-studio:open-template-gallery', onOpenGallery)
    return () => window.removeEventListener('album-studio:open-template-gallery', onOpenGallery)
  }, [])
  // Hover preview for the quick-pick swatches below — portaled to <body> (not just absolutely
  // positioned in place) so it isn't clipped by the sidebar's own scroll container, and sized to
  // the album's real spread aspect ratio instead of a generic square so it shows the layout's
  // true proportions.
  const [hoverPreview, setHoverPreview] = useState<{ template: TemplateDefinition; rect: DOMRect } | null>(null)

  const spread = project.spreads.find((s) => s.id === selectedSpreadId)
  if (!spread) {
    return (
      <div className="panel inspector">
        <h3>
          <Icon name="palette" size={14} />
          Inspector
        </h3>
        <div className="empty-state">
          <Icon name="swatch" size={24} />
          <p>Select a spread, photo, or text box to edit its details here.</p>
        </div>
      </div>
    )
  }

  if (multiSelectedPlaceholderIds.length > 1) {
    return (
      <MultiSelectInspector
        spreadId={spread.id}
        placeholderIds={multiSelectedPlaceholderIds}
        updateMultiplePlacements={updateMultiplePlacements}
      />
    )
  }

  const size = spread.size ?? project.size
  const placement = spread.placements.find((p) => p.placeholderId === selectedPlaceholderId)
  const textBox = spread.textBoxes.find((t) => t.id === selectedTextBoxId)
  const knownFontNames = new Set([...localFonts, ...CLOUD_FONTS].map((f) => f.family))
  const isCustomFont = !!textBox && !knownFontNames.has(textBox.fontFamily)
  const photo = placement?.photoId ? project.photos.find((p) => p.id === placement.photoId) : undefined
  const spreadAspect = size.widthIn / size.heightIn
  const boxForSelected = computePlaceholderBoxes(spread, 900, 900 / spreadAspect).find(
    (b) => b.placeholderId === selectedPlaceholderId
  )
  // This spread's own placed photos, in slot order, so quick-pick swatches/hover previews show
  // real content — falling back to unplaced photos so there's still something to preview on a
  // freshly auto-built or empty spread.
  const quickPickPhotos: (PhotoAsset | undefined)[] = (() => {
    const placed = spread.placements
      .map((p) => (p.photoId ? project.photos.find((ph) => ph.id === p.photoId) : undefined))
      .filter((p): p is PhotoAsset => !!p)
    return placed.length > 0 ? placed : project.photos.slice(0, spread.placements.length)
  })()
  const suggestions = rankTemplates(quickPickPhotos.filter((photo): photo is PhotoAsset => !!photo),
    templatesForCount(spread.placements.length, project.enabledTemplateIds, frameFilter, spreadAspect), spreadAspect, true, spread.marginPx, spread.gapPx).map((match) => match.template)


  let dpi: number | null = null
  if (photo && boxForSelected && placement) {
    const boxWIn = (boxForSelected.width / 900) * size.widthIn
    const boxHIn =
      (boxForSelected.height / (900 / (size.widthIn / size.heightIn))) * size.heightIn
    const crop = computeCoverCrop(photo.width, photo.height, boxForSelected.width, boxForSelected.height, placement.focalX, placement.focalY, placement.zoom)
    dpi = Math.round(effectiveDpi(photo.width, photo.height, crop, boxWIn, boxHIn))
  }

  return (
    <>
    <div className="panel inspector">
      <h3>
        <Icon name="palette" size={14} />
        Inspector
      </h3>

      {!placement && !textBox && <section>
        <h4>
          <Icon name="sparkles" size={13} />
          Smart Grid Suggestions
        </h4>
        <label>
          Frame ratio filter
          <select value={frameFilter} onChange={(e) => setFrameFilter(e.target.value as TemplateFrameFilter)}>
            <option value="all">All Templates</option>
            <option value="no-square">Templates without square frames</option>
            <option value="only-3x2">Templates only with 3:2 frame ratios</option>
          </select>
        </label>
        <p className="template-match-count">{suggestions.length} matching templates found</p>
        <div className="template-grid">
          {suggestions
            .slice(0, 9)
            .map((t) => (
              <button
                key={t.id}
                className={`template-swatch ${spread.templateId === t.id ? 'is-active' : ''}`}
                onClick={() => applyTemplateToSpread(spread.id, t.id)}
                onMouseEnter={(e) => setHoverPreview({ template: t, rect: e.currentTarget.getBoundingClientRect() })}
                onMouseLeave={() => setHoverPreview((cur) => (cur?.template.id === t.id ? null : cur))}
                title={t.name}
              >
                <TemplateThumb template={t} aspect={spreadAspect} marginPx={spread.marginPx} gapPx={spread.gapPx} className="template-swatch__shape" />
                <span className="template-swatch__name">{t.name}</span>
              </button>
            ))}
        </div>
        <button className="btn btn--tiny btn--block" onClick={() => openMatchingTemplates(spread.id)}>
          <Icon name="grid" size={11} />
          Browse All Templates ({suggestions.length})
        </button>
        <div className="save-template-row">
          <input
            placeholder="Template name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
          <button
            className="btn"
            disabled={!templateName.trim()}
            onClick={() => {
              saveSpreadAsTemplate(spread.id, templateName.trim())
              setTemplateName('')
            }}
          >
            <Icon name="save" size={13} />
            Save
          </button>
        </div>

        <div className="custom-grid-row">
          <span className="custom-grid-row__label">Custom grid</span>
          <input
            type="number"
            min={1}
            max={10}
            value={customRows}
            onChange={(e) => setCustomRows(Math.max(1, Math.min(10, Number(e.target.value))))}
          />
          <span className="custom-grid-row__x">×</span>
          <input
            type="number"
            min={1}
            max={10}
            value={customCols}
            onChange={(e) => setCustomCols(Math.max(1, Math.min(10, Number(e.target.value))))}
          />
          <button
            className="btn btn--tiny"
            onClick={() => applyTemplateToSpread(spread.id, generateCustomGrid(customRows, customCols).id)}
          >
            <Icon name="grid" size={11} />
            Apply
          </button>
        </div>
        <button
          className="btn btn--tiny btn--block"
          title="Re-apply this spread's current template to every spread in the album"
          onClick={() => applyTemplateToAllSpreads(spread.templateId)}
        >
          <Icon name="layers" size={11} />
          Apply Template to All Spreads
        </button>
      </section>}

      {!placement && !textBox && <><section>
        <h4>
          <Icon name="layers" size={13} />
          Spread Settings
        </h4>
        <label>
          Background
          <ColorField value={spread.backgroundColor} onChange={(hex) => updateSpread(spread.id, { backgroundColor: hex })} />
        </label>
        <SliderField
          label="Gap"
          value={spread.gapPx}
          min={0}
          max={120}
          suffix="px"
          onChange={(v) => updateSpread(spread.id, { gapPx: v })}
        />
        <SliderField
          label="Margin"
          value={spread.marginPx}
          min={0}
          max={240}
          suffix="px"
          onChange={(v) => updateSpread(spread.id, { marginPx: v })}
        />
        <label>
          Page side
          <select
            value={spread.pageSide}
            onChange={(e) => updateSpread(spread.id, { pageSide: e.target.value as typeof spread.pageSide })}
          >
            <option value="spread">Full Spread</option>
            <option value="left">Left Page</option>
            <option value="right">Right Page</option>
            <option value="single">Single Page</option>
          </select>
        </label>
      </section>

      <section>
        <h4>
          <Icon name="info" size={13} />
          Usage Information
        </h4>
        {(() => {
          const spreadPhotos = spread.placements
            .map((p) => (p.photoId ? project.photos.find((ph) => ph.id === p.photoId) : undefined))
            .filter((p): p is NonNullable<typeof p> => !!p)
          const squareCount = spreadPhotos.filter((p) => p.orientation === 'square').length
          const horizontalCount = spreadPhotos.filter((p) => p.orientation === 'landscape').length
          const verticalCount = spreadPhotos.filter((p) => p.orientation === 'portrait').length
          const templateUses = project.spreads.filter((s) => s.templateId === spread.templateId).length
          const parts = [
            horizontalCount > 0 ? `${horizontalCount} horizontal` : null,
            verticalCount > 0 ? `${verticalCount} vertical` : null,
            squareCount > 0 ? `${squareCount} square` : null,
          ].filter((p): p is string => !!p)
          return (
            <p className="muted">
              {spreadPhotos.length} image{spreadPhotos.length === 1 ? '' : 's'}
              {parts.length > 0 && `: ${parts.join(', ')}`}
              <br />
              Template used {templateUses} time{templateUses === 1 ? '' : 's'} in the project
            </p>
          )
        })()}
      </section>

      </>}
      {placement && (
        <section>
          {boxForSelected && <>
            <h4>Frame position and size</h4>
            <div className="frame-dimensions">
              {(['x', 'y', 'width', 'height'] as const).map((key) => {
                const horizontal = key === 'x' || key === 'width'
                const dimension = horizontal ? size.widthIn : size.heightIn
                const canvasDimension = horizontal ? 900 : 900 / spreadAspect
                const value = boxForSelected[key] / canvasDimension
                return <label key={key} className="field">{key} ({project.units})<input type="number" step="any"
                  value={inToDisplay(value * dimension, project.units, size.dpi)}
                  onChange={(e) => updateImageFrame(spread.id, placement.placeholderId, {
                    x: boxForSelected.x / 900, y: boxForSelected.y / (900 / spreadAspect), width: boxForSelected.width / 900, height: boxForSelected.height / (900 / spreadAspect),
                    [key]: displayToIn(Number(e.target.value), project.units, size.dpi) / dimension,
                  })} /></label>
              })}
            </div>
            <button className="btn btn--tiny" onClick={() => removeImageFrame(spread.id, placement.placeholderId)}>Delete Frame</button>
          </>}
          {photo && <><h4>
            <Icon name="droplet" size={13} />
            Photo Adjustments
          </h4>
          {photo && (
            <div className={`dpi-badge ${dpi !== null && dpi < size.dpi ? 'dpi-badge--warn' : ''}`}>
              <Icon name="info" size={12} />
              {photo.fileName} · {photo.width}×{photo.height}px
              {dpi !== null && <> · {dpi} DPI {dpi < size.dpi && '(below target!)'}</>}
            </div>
          )}
          <div className="text-style-row">
            <button
              className="btn btn--tiny"
              title="Undo every crop, zoom, border, and tone edit on this photo — keeps the same photo in place"
              onClick={() => resetPlacementToOriginal(spread.id, placement.placeholderId)}
            >
              <Icon name="undo" size={11} />
              Reload from Original
            </button>
            <button
              className={`btn btn--tiny ${placement.saturation <= -100 ? 'is-active' : ''}`}
              title="Toggle black & white"
              onClick={() =>
                updatePlacement(spread.id, placement.placeholderId, {
                  saturation: placement.saturation <= -100 ? 0 : -100,
                })
              }
            >
              <Icon name="droplet" size={11} />
              {placement.saturation <= -100 ? 'Color' : 'Black & White'}
            </button>
          </div>
          <div className="text-style-row">
            <button
              className="btn btn--tiny"
              title="Analyze this photo and correct its exposure, contrast, and saturation"
              disabled={autoAdjusting}
              onClick={async () => {
                setAutoAdjusting(true)
                try {
                  await autoAdjustPlacement(spread.id, placement.placeholderId)
                } finally {
                  setAutoAdjusting(false)
                }
              }}
            >
              <Icon name="wand" size={11} />
              {autoAdjusting ? 'Adjusting…' : 'Auto Adjust'}
            </button>
            <button
              className="btn btn--tiny"
              title="Recenter and fit the photo within its frame"
              onClick={() => autoAlignPlacement(spread.id, placement.placeholderId)}
            >
              <Icon name="align" size={11} />
              Auto Align
            </button>
          </div>
          <SliderField
            label="Zoom"
            value={placement.zoom}
            min={1}
            max={5}
            step={0.05}
            onChange={(v) => updatePlacement(spread.id, placement.placeholderId, { zoom: v })}
          />
          <SliderField
            label="Focal X"
            value={placement.focalX}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => updatePlacement(spread.id, placement.placeholderId, { focalX: v })}
          />
          <SliderField
            label="Focal Y"
            value={placement.focalY}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => updatePlacement(spread.id, placement.placeholderId, { focalY: v })}
          />
          </>}
          <h4>Design</h4>
          <SliderField
            label="Opacity"
            value={placement.opacity}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => updatePlacement(spread.id, placement.placeholderId, { opacity: v })}
          />
          <label>
            Frame
            <select
              value={placement.frameStyle}
              onChange={(e) =>
                updatePlacement(spread.id, placement.placeholderId, { frameStyle: e.target.value as typeof placement.frameStyle })
              }
            >
              <option value="none">None</option>
              <option value="rounded">Rounded</option>
              <option value="polaroid">Polaroid</option>
              <option value="shadow">Drop Shadow</option>
            </select>
          </label>
          {placement.frameStyle === 'rounded' && (
            <SliderField
              label="Radius"
              value={placement.cornerRadiusPx}
              min={0}
              max={200}
              suffix="px"
              onChange={(v) => updatePlacement(spread.id, placement.placeholderId, { cornerRadiusPx: v })}
            />
          )}
          <SliderField
            label="Tilt"
            value={placement.rotationDeg}
            min={-45}
            max={45}
            suffix="°"
            onChange={(v) => updatePlacement(spread.id, placement.placeholderId, { rotationDeg: v })}
          />
          <SliderField
            label="Border width"
            value={placement.borderWidth}
            min={0}
            max={60}
            suffix="px"
            onChange={(v) => updatePlacement(spread.id, placement.placeholderId, { borderWidth: v })}
          />
          <label>
            Border color
            <ColorField
              value={placement.borderColor}
              onChange={(hex) => updatePlacement(spread.id, placement.placeholderId, { borderColor: hex })}
            />
          </label>
          {photo && <><SliderField
            label="Warmth"
            value={placement.warmth}
            min={-100}
            max={100}
            onChange={(v) => updatePlacement(spread.id, placement.placeholderId, { warmth: v })}
          />
          <SliderField
            label="Brightness"
            value={placement.brightness}
            min={-100}
            max={100}
            onChange={(v) => updatePlacement(spread.id, placement.placeholderId, { brightness: v })}
          />
          <SliderField
            label="Contrast"
            value={placement.contrast}
            min={-100}
            max={100}
            onChange={(v) => updatePlacement(spread.id, placement.placeholderId, { contrast: v })}
          />
          <SliderField
            label="Saturation"
            value={placement.saturation}
            min={-100}
            max={100}
            onChange={(v) => updatePlacement(spread.id, placement.placeholderId, { saturation: v })}
          />
          <SliderField
            label="Relight"
            value={placement.relightIntensity}
            min={-100}
            max={100}
            onChange={(v) => updatePlacement(spread.id, placement.placeholderId, { relightIntensity: v })}
          />
          <div className="text-style-row">
            <button className="btn btn--tiny" onClick={() => copyToneAdjustments(spread.id, placement.placeholderId)}>
              <Icon name="save" size={11} />
              Copy Tone
            </button>
            <button
              className="btn btn--tiny"
              disabled={!toneClipboard}
              onClick={() => pasteToneAdjustments(spread.id, [placement.placeholderId])}
            >
              <Icon name="download" size={11} />
              Paste Tone
            </button>
          </div>
          </>}
        </section>
      )}

      {textBox && (
        <section>
          <h4>
            <Icon name="type" size={13} />
            Text
          </h4>
          <label>
            Font
            <select
              value={isCustomFont ? '__custom__' : textBox.fontFamily}
              onChange={(e) => {
                const family = e.target.value
                if (family === '__custom__') {
                  updateTextBox(spread.id, textBox.id, { fontFamily: '' })
                  return
                }
                void ensureFontLoaded(family)
                updateTextBox(spread.id, textBox.id, { fontFamily: family })
              }}
            >
              <optgroup label="Local Fonts">
                {localFonts.map((f) => (
                  <option key={f.family} value={f.family}>
                    {f.family}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Cloud Fonts">
                {CLOUD_FONTS.map((f) => (
                  <option key={f.family} value={f.family}>
                    {f.family}
                  </option>
                ))}
              </optgroup>
              <option value="__custom__">Custom…</option>
            </select>
          </label>
          {isCustomFont && (
            <label>
              Custom font name
              <input
                placeholder="e.g. a font installed on this PC"
                value={textBox.fontFamily}
                onChange={(e) => updateTextBox(spread.id, textBox.id, { fontFamily: e.target.value })}
              />
            </label>
          )}
          <SliderField
            label="Size"
            value={textBox.fontSize}
            min={8}
            max={240}
            suffix="px"
            onChange={(v) => updateTextBox(spread.id, textBox.id, { fontSize: v })}
          />
          <label>
            Color
            <ColorField value={textBox.color} onChange={(hex) => updateTextBox(spread.id, textBox.id, { color: hex })} />
          </label>
          <div className="text-style-row">
            <button
              className={`btn btn--toggle ${textBox.bold ? 'is-active' : ''}`}
              onClick={() => updateTextBox(spread.id, textBox.id, { bold: !textBox.bold })}
            >
              B
            </button>
            <button
              className={`btn btn--toggle ${textBox.italic ? 'is-active' : ''}`}
              onClick={() => updateTextBox(spread.id, textBox.id, { italic: !textBox.italic })}
            >
              I
            </button>
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                className={`btn btn--toggle ${textBox.align === a ? 'is-active' : ''}`}
                onClick={() => updateTextBox(spread.id, textBox.id, { align: a })}
              >
                {a[0].toUpperCase()}
              </button>
            ))}
          </div>
          <button className="btn btn--danger btn--block" onClick={() => removeTextBox(spread.id, textBox.id)}>
            <Icon name="trash" size={13} />
            Delete Text Box
          </button>
        </section>
      )}
    </div>
    {hoverPreview &&
      createPortal(
        <TemplateHoverPreview template={hoverPreview.template} rect={hoverPreview.rect} aspect={spreadAspect} photos={quickPickPhotos} marginPx={spread.marginPx} gapPx={spread.gapPx} placements={spread.placements} />,
        document.body
      )}
    </>
  )
}

/** The larger, true-shape preview shown while hovering a quick-pick swatch — portaled to <body>
 *  so it floats above everything (not clipped by the sidebar's scroll container) and positioned
 *  next to the swatch that triggered it. */
function TemplateHoverPreview({
  template,
  rect,
  aspect,
  photos,
  marginPx,
  gapPx,
  placements,
}: {
  template: TemplateDefinition
  rect: DOMRect
  aspect: number
  photos: (PhotoAsset | undefined)[]
  marginPx: number
  gapPx: number
  placements: PlacedPhoto[]
}) {
  const width = 220
  const gap = 10
  // Prefer floating to the left of the swatch (sidebar is on the right edge of the window), but
  // fall back to the right if there's not enough room — e.g. a narrower window.
  const left = rect.left - width - gap >= 0 ? rect.left - width - gap : rect.right + gap
  const estHeight = width / aspect + 36
  const top = Math.min(Math.max(8, rect.top + rect.height / 2 - estHeight / 2), window.innerHeight - estHeight - 8)

  return (
    <div className="template-hover-preview" style={{ left, top, width }}>
      <TemplateThumb template={template} photos={photos} aspect={aspect} marginPx={marginPx} gapPx={gapPx} placements={placements} />
      <span className="template-hover-preview__name">{template.name}</span>
    </div>
  )
}

/** Shown instead of the single-photo panel when more than one placeholder is multi-selected
 *  (shift/ctrl+click on the canvas) — lets the user batch-apply tone adjustments across all of them. */
function MultiSelectInspector({
  spreadId,
  placeholderIds,
  updateMultiplePlacements,
}: {
  spreadId: string
  placeholderIds: string[]
  updateMultiplePlacements: (spreadId: string, placeholderIds: string[], patch: Partial<PlacedPhoto>) => void
}) {
  const autoAdjustPlacement = useProjectStore((s) => s.autoAdjustPlacement)
  const [autoAdjusting, setAutoAdjusting] = useState(false)

  async function autoAdjustAll() {
    setAutoAdjusting(true)
    try {
      // Each photo analyzes separately (a batch patch can't apply — the correction differs per
      // photo), so these run one at a time rather than as a single store update.
      for (const placeholderId of placeholderIds) {
        await autoAdjustPlacement(spreadId, placeholderId)
      }
    } finally {
      setAutoAdjusting(false)
    }
  }

  return (
    <div className="panel inspector">
      <h3>
        <Icon name="palette" size={14} />
        Inspector
      </h3>
      <section>
        <h4>
          <Icon name="layers" size={13} />
          {placeholderIds.length} Photos Selected
        </h4>
        <p className="template-match-count">Changes below apply to all selected photos.</p>
        <button
          className="btn btn--tiny btn--block"
          title="Undo every crop, zoom, border, and tone edit on all selected photos"
          onClick={() =>
            updateMultiplePlacements(spreadId, placeholderIds, {
              focalX: 0.5,
              focalY: 0.5,
              zoom: 1,
              borderWidth: 0,
              borderColor: '#ffffff',
              opacity: 1,
              warmth: 0,
              brightness: 0,
              contrast: 0,
              saturation: 0,
              frameStyle: 'none',
              rotationDeg: 0,
              relightIntensity: 0,
              cornerRadiusPx: 24,
            })
          }
        >
          <Icon name="undo" size={11} />
          Reload from Original
        </button>
        <div className="text-style-row">
          <button className="btn btn--tiny" disabled={autoAdjusting} onClick={() => void autoAdjustAll()}>
            <Icon name="wand" size={11} />
            {autoAdjusting ? 'Adjusting…' : 'Auto Adjust'}
          </button>
          <button
            className="btn btn--tiny"
            onClick={() => updateMultiplePlacements(spreadId, placeholderIds, { focalX: 0.5, focalY: 0.5, zoom: 1 })}
          >
            <Icon name="align" size={11} />
            Auto Align
          </button>
        </div>
        <SliderField
          label="Opacity"
          value={1}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => updateMultiplePlacements(spreadId, placeholderIds, { opacity: v })}
        />
        <SliderField
          label="Border width"
          value={0}
          min={0}
          max={60}
          suffix="px"
          onChange={(v) => updateMultiplePlacements(spreadId, placeholderIds, { borderWidth: v })}
        />
        <SliderField
          label="Warmth"
          value={0}
          min={-100}
          max={100}
          onChange={(v) => updateMultiplePlacements(spreadId, placeholderIds, { warmth: v })}
        />
        <SliderField
          label="Brightness"
          value={0}
          min={-100}
          max={100}
          onChange={(v) => updateMultiplePlacements(spreadId, placeholderIds, { brightness: v })}
        />
        <SliderField
          label="Contrast"
          value={0}
          min={-100}
          max={100}
          onChange={(v) => updateMultiplePlacements(spreadId, placeholderIds, { contrast: v })}
        />
        <SliderField
          label="Saturation"
          value={0}
          min={-100}
          max={100}
          onChange={(v) => updateMultiplePlacements(spreadId, placeholderIds, { saturation: v })}
        />
        <button
          className="btn btn--tiny btn--block"
          title="Black & white"
          onClick={() => updateMultiplePlacements(spreadId, placeholderIds, { saturation: -100 })}
        >
          <Icon name="droplet" size={11} />
          Black &amp; White
        </button>
      </section>
    </div>
  )
}
