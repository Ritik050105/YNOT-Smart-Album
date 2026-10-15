import { useState } from 'react'
import Modal from './Modal'
import Icon from './Icon'
import { AlbumSize } from '@/types'
import { inToDisplay, displayToIn } from '@/engine/units'
import { loadSizePresets, addSizePreset, deleteSizePreset, SizePreset } from '@/engine/sizePresets'

/** Full custom album size dialog — DPI, units, width/height, safe zone and bleed/trim, plus
 *  named presets you can save and reapply later. A modal (not an inline popover) because it's
 *  a focused multi-field task, the same reasoning Pixellu's own "Custom" specs screen follows. */
export default function CustomSizeModal({
  initial,
  initialUnits,
  onCancel,
  onApply,
}: {
  initial: AlbumSize
  initialUnits: 'in' | 'cm'
  onCancel: () => void
  onApply: (size: AlbumSize, units: 'in' | 'cm') => void
}) {
  const [units, setUnits] = useState<'in' | 'cm'>(initialUnits)
  const [widthIn, setWidthIn] = useState(initial.widthIn)
  const [heightIn, setHeightIn] = useState(initial.heightIn)
  const [dpi, setDpi] = useState(initial.dpi)
  const [bleedIn, setBleedIn] = useState(initial.bleedIn)
  const [safeZoneIn, setSafeZoneIn] = useState(initial.safeZoneIn)
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
    setBleedIn(preset.bleedIn)
    setSafeZoneIn(preset.safeZoneIn)
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
      bleedIn,
      safeZoneIn,
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
        bleedIn,
        safeZoneIn,
      },
      units
    )
  }

  const dimStep = units === 'cm' ? 0.5 : 0.25
  const marginStep = units === 'cm' ? 0.1 : 0.0625

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
      </div>

      <div className="field-section">
        <div className="field-section__title">Output Dimensions</div>
        <div className="field-grid">
          <label className="field">
            Width ({units})
            <input
              type="number"
              step={dimStep}
              value={inToDisplay(widthIn, units)}
              onChange={(e) => setWidthIn(displayToIn(Number(e.target.value), units))}
            />
          </label>
          <label className="field">
            Height ({units})
            <input
              type="number"
              step={dimStep}
              value={inToDisplay(heightIn, units)}
              onChange={(e) => setHeightIn(displayToIn(Number(e.target.value), units))}
            />
          </label>
        </div>
      </div>

      <div className="field-section">
        <div className="field-section__title">Print Settings</div>
        <div className="field-grid">
          <label className="field">
            DPI
            <input type="number" step={1} min={72} max={600} value={dpi} onChange={(e) => setDpi(Number(e.target.value))} />
          </label>
          <label className="field">
            Bleed / Trim ({units})
            <input
              type="number"
              step={marginStep}
              value={inToDisplay(bleedIn, units)}
              onChange={(e) => setBleedIn(displayToIn(Number(e.target.value), units))}
            />
          </label>
          <label className="field">
            Safe Zone ({units})
            <input
              type="number"
              step={marginStep}
              value={inToDisplay(safeZoneIn, units)}
              onChange={(e) => setSafeZoneIn(displayToIn(Number(e.target.value), units))}
            />
          </label>
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
