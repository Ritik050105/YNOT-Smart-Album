import { useEffect, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { templatesForCount, generateCustomGrid } from '@/engine/templates'
import { effectiveDpi, computeCoverCrop } from '@/engine/cropFit'
import { computePlaceholderBoxes } from '@/engine/layoutMath'
import { LOCAL_FONTS, CLOUD_FONTS, FontOption, getLocalFonts, ensureFontLoaded } from '@/engine/fonts'
import Icon from './Icon'
import SliderField from './SliderField'

export default function Inspector() {
  const [localFonts, setLocalFonts] = useState<FontOption[]>(LOCAL_FONTS)
  useEffect(() => {
    void getLocalFonts().then(setLocalFonts)
  }, [])

  const project = useProjectStore((s) => s.project)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectedPlaceholderId = useProjectStore((s) => s.selectedPlaceholderId)
  const selectedTextBoxId = useProjectStore((s) => s.selectedTextBoxId)
  const updateSpread = useProjectStore((s) => s.updateSpread)
  const updatePlacement = useProjectStore((s) => s.updatePlacement)
  const updateTextBox = useProjectStore((s) => s.updateTextBox)
  const removeTextBox = useProjectStore((s) => s.removeTextBox)
  const applyTemplateToSpread = useProjectStore((s) => s.applyTemplateToSpread)
  const saveSpreadAsTemplate = useProjectStore((s) => s.saveSpreadAsTemplate)
  const userTemplates = useProjectStore((s) => s.userTemplates)
  const [templateName, setTemplateName] = useState('')
  const [customRows, setCustomRows] = useState(3)
  const [customCols, setCustomCols] = useState(3)

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

  const placement = spread.placements.find((p) => p.placeholderId === selectedPlaceholderId)
  const textBox = spread.textBoxes.find((t) => t.id === selectedTextBoxId)
  const knownFontNames = new Set([...localFonts, ...CLOUD_FONTS].map((f) => f.family))
  const isCustomFont = !!textBox && !knownFontNames.has(textBox.fontFamily)
  const photo = placement?.photoId ? project.photos.find((p) => p.id === placement.photoId) : undefined
  const suggestions = templatesForCount(spread.placements.length)
  const boxForSelected = computePlaceholderBoxes(spread, 900, 900 / (project.size.widthIn / project.size.heightIn)).find(
    (b) => b.placeholderId === selectedPlaceholderId
  )

  let dpi: number | null = null
  if (photo && boxForSelected && placement) {
    const boxWIn = (boxForSelected.width / 900) * project.size.widthIn
    const boxHIn =
      (boxForSelected.height / (900 / (project.size.widthIn / project.size.heightIn))) * project.size.heightIn
    const crop = computeCoverCrop(photo.width, photo.height, boxForSelected.width, boxForSelected.height, placement.focalX, placement.focalY, placement.zoom)
    dpi = Math.round(effectiveDpi(photo.width, photo.height, crop, boxWIn, boxHIn))
  }

  return (
    <div className="panel inspector">
      <h3>
        <Icon name="palette" size={14} />
        Inspector
      </h3>

      <section>
        <h4>
          <Icon name="sparkles" size={13} />
          Smart Grid Suggestions
        </h4>
        <div className="template-grid">
          {[...suggestions, ...userTemplates.filter((t) => t.photoCount === spread.placements.length)].map((t) => (
            <button
              key={t.id}
              className={`template-swatch ${spread.templateId === t.id ? 'is-active' : ''}`}
              style={{
                background: t.thumbnailImage ? undefined : t.thumbnailColor,
                backgroundImage: t.thumbnailImage ? `url(${t.thumbnailImage})` : undefined,
              }}
              onClick={() => applyTemplateToSpread(spread.id, t.id)}
              title={t.name}
            >
              {t.name}
            </button>
          ))}
        </div>
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
      </section>

      <section>
        <h4>
          <Icon name="layers" size={13} />
          Spread Settings
        </h4>
        <label>
          Background
          <input
            type="color"
            value={spread.backgroundColor}
            onChange={(e) => updateSpread(spread.id, { backgroundColor: e.target.value })}
          />
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

      {placement && (
        <section>
          <h4>
            <Icon name="droplet" size={13} />
            Photo Adjustments
          </h4>
          {photo && (
            <div className={`dpi-badge ${dpi !== null && dpi < project.size.dpi ? 'dpi-badge--warn' : ''}`}>
              <Icon name="info" size={12} />
              {photo.fileName} · {photo.width}×{photo.height}px
              {dpi !== null && <> · {dpi} DPI {dpi < project.size.dpi && '(below target!)'}</>}
            </div>
          )}
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
            <input
              type="color"
              value={placement.borderColor}
              onChange={(e) => updatePlacement(spread.id, placement.placeholderId, { borderColor: e.target.value })}
            />
          </label>
          <SliderField
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
            <input
              type="color"
              value={textBox.color}
              onChange={(e) => updateTextBox(spread.id, textBox.id, { color: e.target.value })}
            />
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
  )
}
