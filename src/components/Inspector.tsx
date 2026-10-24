import { pagePlacements } from '@/engine/pageTemplates'
import { usePreferences } from '@/state/preferences'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useProjectStore } from '@/state/projectStore'
import { PlacedPhoto, PhotoAsset, TemplateDefinition } from '@/types'
import { rankTemplates } from '@/engine/templateMatching'
import { templatesForCount, generateCustomGrid, TemplateFrameFilter } from '@/engine/templates'
import TemplateThumb from './TemplatePreview'
import { effectiveDpi, computeCoverCrop } from '@/engine/cropFit'
import { computePlaceholderBoxes } from '@/engine/layoutMath'
import FontPicker from './FontPicker'
import Icon from './Icon'
import SliderField from './SliderField'
import ColorField from './ColorField'
import ImageDesign from './ImageDesign'
import { inToDisplay, displayToIn } from '@/engine/units'

export default function Inspector() {
  const metadataFields=usePreferences(s=>s.values.metadata)

  const project = useProjectStore((s) => s.project)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectedPlaceholderId = useProjectStore((s) => s.selectedPlaceholderId)
  const selectedTextBoxId = useProjectStore((s) => s.selectedTextBoxId)
  const multiSelectedPlaceholderIds = useProjectStore((s) => s.multiSelectedPlaceholderIds)
  const updateSpread = useProjectStore((s) => s.updateSpread)
  const updatePlacement = useProjectStore((s) => s.updatePlacement)
  const swapPlacements = useProjectStore((s) => s.swapPlacements)
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
  const photo = placement?.photoId ? project.photos.find((p) => p.id === placement.photoId) : undefined
  if (placement?.locked || textBox?.locked) return <div className="panel inspector"><strong>Layer locked</strong><p className="muted">Unlock this layer to edit, move or resize it.</p><button className="btn" onClick={()=>useProjectStore.getState().setLayerLocked(spread.id,placement?'image':'text',placement?.placeholderId??textBox!.id,false)}>Unlock layer</button></div>
  const groupId=placement?.groupId??textBox?.groupId
  if(groupId)return <div className="panel inspector"><strong>Group selected</strong><p className="muted">Drag the group on the canvas or resize it with the corner handles.</p><div className="designer-layers__actions"><button className="btn" onClick={()=>useProjectStore.getState().setLayerLocked(spread.id,placement?'image':'text',placement?.placeholderId??textBox!.id,true)}>Lock group</button><button className="btn" onClick={()=>useProjectStore.getState().setLayerHidden(spread.id,placement?'image':'text',placement?.placeholderId??textBox!.id,true)}>Hide group</button><button className="btn" onClick={()=>useProjectStore.getState().ungroupLayers(spread.id,groupId)}>Ungroup</button></div></div>
  const spreadAspect = size.widthIn / size.heightIn
  const boxForSelected = computePlaceholderBoxes(spread, 900, 900 / spreadAspect).find(
    (b) => b.placeholderId === selectedPlaceholderId
  )
  // Match only editable foreground photos, as in the template browser.
  const templatePlacements=pagePlacements(spread,spreadAspect,'spread')
  const quickPickPhotos: (PhotoAsset | undefined)[] = (() => {
    const placed = templatePlacements
      .map((p) => (p.photoId ? project.photos.find((ph) => ph.id === p.photoId) : undefined))
      .filter((p): p is PhotoAsset => !!p)
    return placed
  })()
  const suggestions = rankTemplates(quickPickPhotos.filter((photo): photo is PhotoAsset => !!photo),
    templatesForCount(templatePlacements.filter(p=>p.photoId).length||templatePlacements.length, project.enabledTemplateIds, frameFilter, spreadAspect), spreadAspect, true, spread.marginPx, spread.gapPx).map((match) => match.template)


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

      {!placement && !textBox && <section className="smart-grid">
        <h4>
          <Icon name="sparkles" size={13} />
          Smart Grid Suggestions
        </h4>
        <label className="smart-grid__filter">
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
                aria-pressed={spread.templateId === t.id}
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
        <div className="smart-grid__group">
        <span className="smart-grid__caption">Save this layout</span>
        <div className="save-template-row">
          <input
            aria-label="Template name"
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

        </div>
        <div className="smart-grid__group">
        <span className="smart-grid__caption">Custom grid</span>
        <div className="custom-grid-row">
          <label>Rows<input
            type="number"
            min={1}
            max={10}
            value={customRows}
            onChange={(e) => setCustomRows(Math.max(1, Math.min(10, Number(e.target.value))))}
          />
          </label>
          <label>Columns<input
            type="number"
            min={1}
            max={10}
            value={customCols}
            onChange={(e) => setCustomCols(Math.max(1, Math.min(10, Number(e.target.value))))}
          /></label>
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
          Apply to all spreads
        </button>
        </div>
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
        <SliderField buttons
          label="Gap"
          value={spread.gapPx}
          min={0}
          max={120}
          suffix="px"
          onChange={(v) => updateSpread(spread.id, { gapPx: v })}
        />
        <SliderField buttons
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
          {photo && <div className="image-design__heading"><strong title={photo.fileName}>{photo.fileName}</strong><span title={dpi !== null && dpi < size.dpi ? 'Low image resolution' : 'Image resolution'}>{dpi !== null && dpi < size.dpi ? '⚠' : '◈'}</span></div>}
          <ImageDesign placement={placement} photo={photo} width={boxForSelected?.width ?? 300} height={boxForSelected?.height ?? 200} update={patch => updatePlacement(spread.id, placement.placeholderId, patch)}/>
          {boxForSelected && <details className="inspector-group">
            <summary>Frame position &amp; size</summary>
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
          </details>}
          {photo && <details className="inspector-group"><summary>Image &amp; crop</summary>
          {photo && (
            <div className={`dpi-badge ${dpi !== null && dpi < size.dpi ? 'dpi-badge--warn' : ''}`}>
              <Icon name="info" size={12} />
              <span className="inspector-photo-meta"><span title={photo.fileName}>{photo.fileName}</span><small>{metadataFields.includes('Dimensions') && <>{photo.width} × {photo.height}px</>}{dpi !== null && <> · {dpi} DPI{dpi < size.dpi && ' · Low resolution'}</>}</small></span>
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
                  saturation: placement.saturation <= -100 ? 0 : -100, blackWhiteMix: undefined,
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
                } catch (error) { window.alert(error instanceof Error ? error.message : 'Could not enhance this image.') } finally {
                  setAutoAdjusting(false)
                }
              }}
            >
              <Icon name="wand" size={11} />
              {autoAdjusting ? 'Enhancing…' : 'Auto Enhance'}
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
          <label>Swap image with
            <select aria-label="Swap image with" value="" onChange={e => { if (e.target.value) swapPlacements(spread.id, placement.placeholderId, e.target.value) }}>
              <option value="">Choose another image…</option>
              {spread.placements.filter(p => p.photoId && p.placeholderId !== placement.placeholderId).map((p, i) => <option key={p.placeholderId} value={p.placeholderId}>{i + 1}. {project.photos.find(photo => photo.id === p.photoId)?.fileName}</option>)}
            </select>
          </label>
          <button className="btn btn--tiny" onClick={() => useProjectStore.getState().makePhotoBackground(spread.id, placement.placeholderId)}>Set as fixed background</button>
          <SliderField buttons
            label="Focal X"
            value={placement.focalX}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => updatePlacement(spread.id, placement.placeholderId, { focalX: v })}
          />
          <SliderField buttons
            label="Focal Y"
            value={placement.focalY}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => updatePlacement(spread.id, placement.placeholderId, { focalY: v })}
          />
          </details>}
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
          {photo && <details className="inspector-group" open><summary>Image Information</summary><dl className="inspector-metadata">
            {boxForSelected && <div><dt>Frame W × H</dt><dd>{inToDisplay(boxForSelected.width / 900 * size.widthIn, project.units, size.dpi)} × {inToDisplay(boxForSelected.height / 900 * size.widthIn, project.units, size.dpi)} {project.units}</dd></div>}
            <div><dt>Effective PPI</dt><dd>{dpi ?? 'Unavailable'}</dd></div>
            {Object.entries({'Color profile':'No color profile detected', ...photo.metadata, Dimensions:`${photo.width} × ${photo.height} px`, 'Camera model':photo.cameraModel, 'Date taken':photo.capturedAt ? new Date(photo.capturedAt).toLocaleString() : 'Unavailable'}).filter(([key,value])=>value && metadataFields.includes(key)).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
          </dl><p className="image-design__usage">Used {project.spreads.reduce((count, item) => count + item.placements.filter(p => p.photoId === photo.id).length + (item.backgroundPattern?.edits?.photoId === photo.id ? 1 : 0), 0)} times</p></details>}

        </section>
      )}

      {textBox && (
        <section>
          <h4>
            <Icon name="type" size={13} />
            Text
          </h4>
          <FontPicker value={textBox.fontFamily} onChange={family => updateTextBox(spread.id, textBox.id, { fontFamily: family })} />
          <SliderField buttons
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
              Bold
            </button>
            <button
              className={`btn btn--toggle ${textBox.italic ? 'is-active' : ''}`}
              onClick={() => updateTextBox(spread.id, textBox.id, { italic: !textBox.italic })}
            >
              Italic
            </button>
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                className={`btn btn--toggle ${textBox.align === a ? 'is-active' : ''}`}
                onClick={() => updateTextBox(spread.id, textBox.id, { align: a })}
              >
                {a === 'left' ? 'Align left' : a === 'center' ? 'Center' : 'Align right'}
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
  const firstPlacement = useProjectStore(s => s.project.spreads.find(spread => spread.id === spreadId)?.placements.find(p => placeholderIds.includes(p.placeholderId)))
  const [autoAdjusting, setAutoAdjusting] = useState(false)

  async function autoAdjustAll() {
    setAutoAdjusting(true)
    try {
      await useProjectStore.getState().autoEnhanceImages(placeholderIds.map(frameId => ({spreadId,frameId})))
    } catch (error) { window.alert(error instanceof Error ? error.message : 'Could not enhance these images.') } finally {
      setAutoAdjusting(false)
    }
  }

  return (
    <div className="panel inspector">
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
              blackWhiteMix: undefined,
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
            {autoAdjusting ? 'Enhancing…' : 'Auto Enhance'}
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
          value={firstPlacement?.opacity ?? 1}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => updateMultiplePlacements(spreadId, placeholderIds, { opacity: v })}
        />
        <SliderField buttons
          label="Border width"
          value={0}
          min={0}
          max={60}
          suffix="px"
          onChange={(v) => updateMultiplePlacements(spreadId, placeholderIds, { borderWidth: v })}
        />
        <SliderField
          label="Warmth"
          value={firstPlacement?.warmth ?? 0}
          min={-100}
          max={100}
          onChange={(v) => updateMultiplePlacements(spreadId, placeholderIds, { warmth: v })}
        />
        <SliderField
          label="Brightness"
          value={firstPlacement?.brightness ?? 0}
          min={-100}
          max={100}
          onChange={(v) => updateMultiplePlacements(spreadId, placeholderIds, { brightness: v })}
        />
        <SliderField
          label="Contrast"
          value={firstPlacement?.contrast ?? 0}
          min={-100}
          max={100}
          onChange={(v) => updateMultiplePlacements(spreadId, placeholderIds, { contrast: v })}
        />
        <SliderField
          label="Saturation"
          value={firstPlacement?.saturation ?? 0}
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
