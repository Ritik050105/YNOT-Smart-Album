import { useState } from 'react'
import Modal from './Modal'
import Icon from './Icon'
import { AlbumSize, EdgeInset } from '@/types'
import { inToDisplay, displayToIn, DisplayUnit } from '@/engine/units'
import { loadSizePresets, addSizePreset, deleteSizePreset, SizePreset } from '@/engine/sizePresets'

/** Three linked number fields for one `EdgeInset` (Left/right, Top/bottom, Inside) — shared by the
 *  Safe Zone and Trim sections, matching the reference app's own field layout exactly. */
function EdgeInsetFields({
  value,
  onChange,
  units,
  dpi,
}: {
  value: EdgeInset
  onChange: (next: EdgeInset) => void
  units: DisplayUnit
  dpi: number
}) {
  const step = units === 'px' ? 5 : units === 'cm' ? 0.1 : 0.0625
  return (
    <>
      <label className="field">
        Left/right ({units})
        <input
          type="number"
          step={step}
          value={inToDisplay(value.leftRight, units, dpi)}
          onChange={(e) => onChange({ ...value, leftRight: displayToIn(Number(e.target.value), units, dpi) })}
        />
      </label>
      <label className="field">
        Top/bottom ({units})
        <input
          type="number"
          step={step}
          value={inToDisplay(value.topBottom, units, dpi)}
          onChange={(e) => onChange({ ...value, topBottom: displayToIn(Number(e.target.value), units, dpi) })}
        />
      </label>
      <label className="field">
        Inside ({units})
        <input
          type="number"
          step={step}
          value={inToDisplay(value.inside, units, dpi)}
          onChange={(e) => onChange({ ...value, inside: displayToIn(Number(e.target.value), units, dpi) })}
        />
      </label>
    </>
  )
}

/** Full custom album size dialog — DPI, units, width/height, per-edge safe zone and trim, plus
 *  named presets you can save and reapply later. A modal (not an inline popover) because it's
 *  a focused multi-field task, the same reasoning Pixellu's own "Custom" specs screen follows. */
export default function CustomSizeModal({
  initial,
  initialUnits,
  onCancel,
  onApply,
}: {
  initial: AlbumSize
  initialUnits: DisplayUnit
  onCancel: () => void
  onApply: (size: AlbumSize, units: DisplayUnit) => void
}) {
  const [units, setUnits] = useState<DisplayUnit>(initialUnits)
  const [widthIn, setWidthIn] = useState(initial.widthIn)
  const [heightIn, setHeightIn] = useState(initial.heightIn)
  const [dpi, setDpi] = useState(initial.dpi)
  const [trim, setTrim] = useState<EdgeInset>(initial.trim)
  const [safeZone, setSafeZone] = useState<EdgeInset>(initial.safeZone)
  const [presets, setPresets] = useState<SizePreset[]>(() => loadSizePresets())
  const [selectedPreset, setSelectedPreset] = useState('')
  const [presetName, setPresetName] = useState('')

  function applyPreset(name: string) {
    const preset = presets.find((p) => p.presetName === name)
    if (!preset) return
    setSelectedPreset(name)
    setWidthIn(preset.widthIn)
    setHeightIn(preset.heightIn)
    setDpi(preset.dpi)
    setTrim(preset.trim)
    setSafeZone(preset.safeZone)
  }

  function savePreset() {
    const name = presetName.trim()
    if (!name) return
    const preset: SizePreset = {
      id: `preset-${name}`,
      presetName: name,
      label: name,
      category: 'Custom',
      widthIn,
      heightIn,
      dpi,
      trim,
      safeZone,
    }
    setPresets(addSizePreset(preset))
    setSelectedPreset(name)
    setPresetName('')
  }

  function removePreset() {
    if (!selectedPreset) return
    setPresets(deleteSizePreset(selectedPreset))
    setSelectedPreset('')
  }

  function handleApply() {
    onApply(
      {
        id: 'custom',
        label: `Custom ${widthIn}" x ${heightIn}"`,
        category: 'Custom',
        widthIn,
        heightIn,
        dpi,
        trim,
        safeZone,
      },
      units
    )
  }

  const dimStep = units === 'px' ? 10 : units === 'cm' ? 0.5 : 0.25

  return (
    <Modal
      title="Custom Album Size"
      subtitle="Set exact dimensions, DPI, and print margins — or load a saved preset."
      onClose={onCancel}
      width={440}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <div className="footer-spacer" />
          <button className="btn btn--primary" onClick={handleApply}>
            Apply Size
          </button>
        </>
      }
    >
      {presets.length > 0 && (
        <div className="preset-row">
          <select value={selectedPreset} onChange={(e) => applyPreset(e.target.value)}>
            <option value="">Load a saved preset…</option>
            {presets.map((p) => (
              <option key={p.presetName} value={p.presetName}>
                {p.presetName}
              </option>
            ))}
          </select>
          <button className="btn btn--icon" disabled={!selectedPreset} onClick={removePreset} title="Delete preset">
            <Icon name="trash" size={14} />
          </button>
        </div>
      )}

      <div className="tab-row">
        <button className={units === 'in' ? 'is-active' : ''} onClick={() => setUnits('in')}>
          Inches
        </button>
        <button className={units === 'cm' ? 'is-active' : ''} onClick={() => setUnits('cm')}>
          Centimeters
        </button>
        <button className={units === 'px' ? 'is-active' : ''} onClick={() => setUnits('px')}>
          Pixels
        </button>
      </div>

      <div className="field-section">
        <div className="field-section__title">Output Dimensions</div>
        <div className="field-grid">
          <label className="field">
            Width ({units})
            <input
              type="number"
              step={dimStep}
              value={inToDisplay(widthIn, units, dpi)}
              onChange={(e) => setWidthIn(displayToIn(Number(e.target.value), units, dpi))}
            />
          </label>
          <label className="field">
            Height ({units})
            <input
              type="number"
              step={dimStep}
              value={inToDisplay(heightIn, units, dpi)}
              onChange={(e) => setHeightIn(displayToIn(Number(e.target.value), units, dpi))}
            />
          </label>
          <label className="field">
            DPI
            <input type="number" step={1} min={72} max={600} value={dpi} onChange={(e) => setDpi(Number(e.target.value))} />
          </label>
        </div>
      </div>

      <div className="field-section-row">
        <div className="field-section">
          <div className="field-section__title">Safe Zone</div>
          <EdgeInsetFields value={safeZone} onChange={setSafeZone} units={units} dpi={dpi} />
        </div>
        <div className="field-section">
          <div className="field-section__title">Trim</div>
          <EdgeInsetFields value={trim} onChange={setTrim} units={units} dpi={dpi} />
        </div>
      </div>

      <div className="field-section">
        <div className="field-section__title">Save This as a Preset</div>
        <div className="save-template-row">
          <input placeholder="Preset name" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
          <button className="btn btn--tiny" disabled={!presetName.trim()} onClick={savePreset}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}
