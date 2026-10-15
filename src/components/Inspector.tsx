import { useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { templatesForCount } from '@/engine/templates'
import { effectiveDpi, computeCoverCrop } from '@/engine/cropFit'
import { computePlaceholderBoxes } from '@/engine/layoutMath'
import { LOCAL_FONTS, CLOUD_FONTS, ensureFontLoaded } from '@/engine/fonts'

export default function Inspector() {
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

  const spread = project.spreads.find((s) => s.id === selectedSpreadId)
  if (!spread) {
    return (
      <div className="panel inspector">
        <h3>Inspector</h3>
        <p className="muted">Select a spread to see its details.</p>
      </div>
    )
  }

  const placement = spread.placements.find((p) => p.placeholderId === selectedPlaceholderId)
  const textBox = spread.textBoxes.find((t) => t.id === selectedTextBoxId)
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
      <h3>Inspector</h3>

      <section>
        <h4>Smart Grid Suggestions</h4>
        <div className="template-grid">
          {[...suggestions, ...userTemplates.filter((t) => t.photoCount === spread.placements.length)].map((t) => (
            <button
              key={t.id}
              className={`template-swatch ${spread.templateId === t.id ? 'is-active' : ''}`}
              style={{ background: t.thumbnailColor }}
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
            Save as Template
          </button>
        </div>
      </section>

      <section>
        <h4>Spread Settings</h4>
        <label>
          Background
          <input
            type="color"
            value={spread.backgroundColor}
            onChange={(e) => updateSpread(spread.id, { backgroundColor: e.target.value })}
          />
        </label>
        <label>
          Gap
          <input
            type="range"
            min={0}
            max={60}
            value={spread.gapPx}
            onChange={(e) => updateSpread(spread.id, { gapPx: Number(e.target.value) })}
          />
        </label>
        <label>
          Margin
          <input
            type="range"
            min={0}
            max={120}
            value={spread.marginPx}
            onChange={(e) => updateSpread(spread.id, { marginPx: Number(e.target.value) })}
          />
        </label>
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
          <h4>Photo Adjustments</h4>
          {photo && (
            <div className={`dpi-badge ${dpi !== null && dpi < project.size.dpi ? 'dpi-badge--warn' : ''}`}>
              {photo.fileName} · {photo.width}×{photo.height}px
              {dpi !== null && <> · {dpi} DPI {dpi < project.size.dpi && '(below target!)'}</>}
            </div>
          )}
          <label>
            Zoom
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={placement.zoom}
              onChange={(e) => updatePlacement(spread.id, placement.placeholderId, { zoom: Number(e.target.value) })}
            />
          </label>
          <label>
            Focal X
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={placement.focalX}
              onChange={(e) => updatePlacement(spread.id, placement.placeholderId, { focalX: Number(e.target.value) })}
            />
          </label>
          <label>
            Focal Y
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={placement.focalY}
              onChange={(e) => updatePlacement(spread.id, placement.placeholderId, { focalY: Number(e.target.value) })}
            />
          </label>
          <label>
            Opacity
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={placement.opacity}
              onChange={(e) => updatePlacement(spread.id, placement.placeholderId, { opacity: Number(e.target.value) })}
            />
          </label>
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
          <label>
            Tilt
            <input
              type="range"
              min={-20}
              max={20}
              value={placement.rotationDeg}
              onChange={(e) => updatePlacement(spread.id, placement.placeholderId, { rotationDeg: Number(e.target.value) })}
            />
          </label>
          <label>
            Border width
            <input
              type="range"
              min={0}
              max={30}
              value={placement.borderWidth}
              onChange={(e) => updatePlacement(spread.id, placement.placeholderId, { borderWidth: Number(e.target.value) })}
            />
          </label>
          <label>
            Border color
            <input
              type="color"
              value={placement.borderColor}
              onChange={(e) => updatePlacement(spread.id, placement.placeholderId, { borderColor: e.target.value })}
            />
          </label>
          <label>
            Warmth
            <input
              type="range"
              min={-100}
              max={100}
              value={placement.warmth}
              onChange={(e) => updatePlacement(spread.id, placement.placeholderId, { warmth: Number(e.target.value) })}
            />
          </label>
          <label>
            Brightness
            <input
              type="range"
              min={-50}
              max={50}
              value={placement.brightness}
              onChange={(e) => updatePlacement(spread.id, placement.placeholderId, { brightness: Number(e.target.value) })}
            />
          </label>
          <label>
            Contrast
            <input
              type="range"
              min={-50}
              max={50}
              value={placement.contrast}
              onChange={(e) => updatePlacement(spread.id, placement.placeholderId, { contrast: Number(e.target.value) })}
            />
          </label>
          <label>
            Saturation
            <input
              type="range"
              min={-100}
              max={100}
              value={placement.saturation}
              onChange={(e) => updatePlacement(spread.id, placement.placeholderId, { saturation: Number(e.target.value) })}
            />
          </label>
        </section>
      )}

      {textBox && (
        <section>
          <h4>Text</h4>
          <label>
            Font
            <select
              value={textBox.fontFamily}
              onChange={(e) => {
                const family = e.target.value
                void ensureFontLoaded(family)
                updateTextBox(spread.id, textBox.id, { fontFamily: family })
              }}
            >
              <optgroup label="Local Fonts">
                {LOCAL_FONTS.map((f) => (
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
            </select>
          </label>
          <label>
            Size
            <input
              type="range"
              min={10}
              max={96}
              value={textBox.fontSize}
              onChange={(e) => updateTextBox(spread.id, textBox.id, { fontSize: Number(e.target.value) })}
            />
          </label>
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
          <button className="btn btn--danger" onClick={() => removeTextBox(spread.id, textBox.id)}>
            Delete Text Box
          </button>
        </section>
      )}
    </div>
  )
}
