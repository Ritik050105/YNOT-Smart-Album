import { useState, Fragment } from 'react'
import Modal from './Modal'
import Icon from './Icon'
import { useProjectStore, NewProjectOptions } from '@/state/projectStore'
import { ALBUM_SIZES, ALBUM_SIZE_CATEGORIES, DEFAULT_ALBUM_SIZE } from '@/engine/albumSizes'
import { BUILT_IN_TEMPLATES } from '@/engine/templates'
import { inToDisplay, displayToIn, DisplayUnit } from '@/engine/units'
import { AlbumSize, AlbumSizeCategory } from '@/types'

const SHAPES: { category: AlbumSizeCategory; label: string; aspect: number }[] = [
  { category: 'Square', label: 'Square', aspect: 1 },
  { category: 'Portrait', label: 'Portrait', aspect: 0.8 },
  { category: 'Landscape', label: 'Landscape', aspect: 1.25 },
  { category: 'Panoramic', label: 'Panoramic', aspect: 2 },
  { category: 'Magazine', label: 'Magazine', aspect: 1.1 },
]

const COLOR_PROFILES = ['sRGB', 'Adobe RGB', 'ProPhoto RGB']

/**
 * New Project wizard, modeled on the reference app's "Choose Project Specifications" ->
 * "Template Library and Appearance Settings" flow: pick a size (preset or fully custom),
 * then set the look new spreads start with and which templates Auto-Build is allowed to use.
 */
export default function NewProjectWizard({ onClose }: { onClose: () => void }) {
  const createProjectFromWizard = useProjectStore((s) => s.createProjectFromWizard)

  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('Untitled Album')
  const [sizeTab, setSizeTab] = useState<'presets' | 'custom'>('presets')
  const [shape, setShape] = useState<AlbumSizeCategory>('Square')
  const [presetId, setPresetId] = useState(DEFAULT_ALBUM_SIZE.id)
  const [units, setUnits] = useState<DisplayUnit>('in')
  const [widthIn, setWidthIn] = useState(DEFAULT_ALBUM_SIZE.widthIn)
  const [heightIn, setHeightIn] = useState(DEFAULT_ALBUM_SIZE.heightIn)
  const [dpi, setDpi] = useState(DEFAULT_ALBUM_SIZE.dpi)
  const [bleedIn, setBleedIn] = useState(DEFAULT_ALBUM_SIZE.bleedIn)
  const [safeZoneIn, setSafeZoneIn] = useState(DEFAULT_ALBUM_SIZE.safeZoneIn)
  const [colorProfile, setColorProfile] = useState('sRGB')

  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [gapPx, setGapPx] = useState(8)
  const [marginPx, setMarginPx] = useState(24)
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set(BUILT_IN_TEMPLATES.map((t) => t.id)))

  function toggleTemplate(id: string) {
    setEnabledIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function resolveSize(): AlbumSize {
    if (sizeTab === 'presets') {
      return ALBUM_SIZES.find((s) => s.id === presetId) ?? DEFAULT_ALBUM_SIZE
    }
    return {
      id: 'custom',
      label: `Custom ${widthIn}" x ${heightIn}"`,
      category: 'Custom',
      widthIn,
      heightIn,
      dpi,
      bleedIn,
      safeZoneIn,
    }
  }

  function handleCreate() {
    const opts: NewProjectOptions = {
      name: name.trim() || 'Untitled Album',
      size: resolveSize(),
      units,
      colorProfile,
      defaultBackgroundColor: backgroundColor,
      defaultGapPx: gapPx,
      defaultMarginPx: marginPx,
      enabledTemplateIds: enabledIds.size === BUILT_IN_TEMPLATES.length ? null : Array.from(enabledIds),
    }
    createProjectFromWizard(opts)
    onClose()
  }

  const dimStep = units === 'cm' ? 0.5 : 0.25

  return (
    <Modal
      title="New Album"
      onClose={onClose}
      width={560}
      footer={
        <>
          {step === 2 ? (
            <button className="btn" onClick={() => setStep(1)}>
              Back
            </button>
          ) : (
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
          )}
          <div className="footer-spacer" />
          {step === 1 ? (
            <button className="btn btn--primary" onClick={() => setStep(2)}>
              Next
            </button>
          ) : (
            <button className="btn btn--primary" onClick={handleCreate}>
              <Icon name="sparkles" size={14} />
              Create Album
            </button>
          )}
        </>
      }
    >
      <div className="wizard-steps">
        {(['Specifications', 'Templates & Appearance'] as const).map((label, i) => (
          <Fragment key={label}>
            <div className={`wizard-steps__step ${step === i + 1 ? 'is-active' : ''} ${step > i + 1 ? 'is-done' : ''}`}>
              <span className="wizard-steps__dot">{step > i + 1 ? <Icon name="check" size={10} /> : i + 1}</span>
              {label}
            </div>
            {i === 0 && <div className="wizard-steps__connector" />}
          </Fragment>
        ))}
      </div>

      {step === 1 ? (
        <>
          <label className="field" style={{ marginBottom: 14 }}>
            Album name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Arjun & Meera Wedding" />
          </label>

          <div className="tab-row">
            <button className={sizeTab === 'presets' ? 'is-active' : ''} onClick={() => setSizeTab('presets')}>
              Size Presets
            </button>
            <button className={sizeTab === 'custom' ? 'is-active' : ''} onClick={() => setSizeTab('custom')}>
              Custom
            </button>
          </div>

          {sizeTab === 'presets' ? (
            <>
              <div className="shape-picker">
                {SHAPES.map((s) => (
                  <button
                    key={s.category}
                    className={`shape-option ${shape === s.category ? 'is-selected' : ''}`}
                    onClick={() => {
                      setShape(s.category)
                      const first = ALBUM_SIZES.find((a) => a.category === s.category)
                      if (first) setPresetId(first.id)
                    }}
                  >
                    <span
                      className="shape-option__swatch"
                      style={{ width: 28, height: 28 / s.aspect }}
                    />
                    {s.label}
                  </button>
                ))}
              </div>
              <label className="field">
                Exact size
                <select value={presetId} onChange={(e) => setPresetId(e.target.value)}>
                  {ALBUM_SIZE_CATEGORIES.filter((c) => c === shape).map((category) => (
                    <optgroup key={category} label={category}>
                      {ALBUM_SIZES.filter((s) => s.category === category).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <div className="tab-row">
                <button className={units === 'in' ? 'is-active' : ''} onClick={() => setUnits('in')}>
                  Inches
                </button>
                <button className={units === 'cm' ? 'is-active' : ''} onClick={() => setUnits('cm')}>
                  Centimeters
                </button>
              </div>
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
                <label className="field">
                  DPI
                  <input type="number" min={72} max={600} value={dpi} onChange={(e) => setDpi(Number(e.target.value))} />
                </label>
                <label className="field">
                  Bleed / Trim ({units})
                  <input
                    type="number"
                    step={0.0625}
                    value={inToDisplay(bleedIn, units)}
                    onChange={(e) => setBleedIn(displayToIn(Number(e.target.value), units))}
                  />
                </label>
                <label className="field">
                  Safe Zone ({units})
                  <input
                    type="number"
                    step={0.0625}
                    value={inToDisplay(safeZoneIn, units)}
                    onChange={(e) => setSafeZoneIn(displayToIn(Number(e.target.value), units))}
                  />
                </label>
              </div>
            </>
          )}

          <div className="field-section">
            <label className="field">
              Color profile
              <select value={colorProfile} onChange={(e) => setColorProfile(e.target.value)}>
                {COLOR_PROFILES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      ) : (
        <>
          <div className="field-section" style={{ marginTop: 0 }}>
            <div className="field-section__title">Spread Appearance Defaults</div>
            <div className="field-grid field-grid--4">
              <label className="field">
                Background
                <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
              </label>
              <label className="field">
                Gap (px)
                <input type="number" min={0} max={200} value={gapPx} onChange={(e) => setGapPx(Number(e.target.value))} />
              </label>
              <label className="field">
                Margin (px)
                <input type="number" min={0} max={400} value={marginPx} onChange={(e) => setMarginPx(Number(e.target.value))} />
              </label>
            </div>
          </div>

          <div className="field-section">
            <div className="field-section__title">
              Template Library ({enabledIds.size}/{BUILT_IN_TEMPLATES.length} enabled for Auto-Build)
            </div>
            <div className="template-pick-grid">
              {BUILT_IN_TEMPLATES.map((t) => (
                <div
                  key={t.id}
                  className={`template-pick-item ${enabledIds.has(t.id) ? 'is-enabled' : ''}`}
                  onClick={() => toggleTemplate(t.id)}
                >
                  <div className="template-pick-item__swatch" style={{ background: t.thumbnailColor }}>
                    {enabledIds.has(t.id) && (
                      <span className="template-pick-item__check">
                        <Icon name="check" size={9} />
                      </span>
                    )}
                  </div>
                  <span className="template-pick-item__label">{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
