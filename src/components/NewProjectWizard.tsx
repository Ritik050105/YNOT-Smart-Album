import { useMemo, useState, Fragment } from 'react'
import Modal from './Modal'
import Icon from './Icon'
import { useProjectStore, NewProjectOptions } from '@/state/projectStore'
import { ALBUM_SIZES, ALBUM_SIZE_CATEGORIES, DEFAULT_ALBUM_SIZE } from '@/engine/albumSizes'
import { templatesForCount, matchesFrameFilter, TemplateFrameFilter, BUILT_IN_TEMPLATES } from '@/engine/templates'
import { loadSizePresets, addSizePreset, deleteSizePreset, SizePreset } from '@/engine/sizePresets'
import { inToDisplay, displayToIn, DisplayUnit } from '@/engine/units'
import { AlbumSize, AlbumSizeCategory, EdgeInset } from '@/types'
import TemplateThumb from './TemplatePreview'

const SHAPES: { category: AlbumSizeCategory; label: string; aspect: number }[] = [
  { category: 'Square', label: 'Square', aspect: 1 },
  { category: 'Portrait', label: 'Portrait', aspect: 0.8 },
  { category: 'Landscape', label: 'Landscape', aspect: 1.25 },
  { category: 'Panoramic', label: 'Panoramic', aspect: 2 },
  { category: 'Magazine', label: 'Magazine', aspect: 1.1 },
]

const COLOR_PROFILES = ['sRGB', 'Adobe RGB', 'ProPhoto RGB']

const LIBRARY_FILTERS: { value: TemplateFrameFilter; label: string }[] = [
  { value: 'all', label: 'All Templates' },
  { value: 'no-square', label: 'Templates without square frames' },
  { value: 'only-3x2', label: 'Templates only with 3:2 frame ratios' },
]

const BORDER_STYLES = [
  { label: 'None', px: 0 },
  { label: 'Thin', px: 2 },
  { label: 'Medium', px: 5 },
  { label: 'Thick', px: 10 },
]

const GAP_STYLES = [
  { label: 'None', px: 0 },
  { label: 'Thin', px: 8 },
  { label: 'Medium', px: 16 },
  { label: 'Thick', px: 28 },
]

function stylePickFor(px: number, options: { label: string; px: number }[]): string {
  return options.find((o) => o.px === px)?.label ?? 'Custom'
}

/** Three linked number fields for one `EdgeInset` (Left/right, Top/bottom, Inside) — shared by the
 *  Safe Zone and Trim sections, matching the reference app's own field layout exactly. */
function EdgeInsetFields({
  value,
  onChange,
  units,
  dpi,
  step,
}: {
  value: EdgeInset
  onChange: (next: EdgeInset) => void
  units: DisplayUnit
  dpi: number
  step: number
}) {
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

/**
 * New Project wizard, modeled on the reference app's "Choose Project Specifications" ->
 * "Template Library and Appearance Settings" flow: pick a size (an album-company-style preset, or
 * fully custom specs with saved presets), then narrow the template library and set the look new
 * spreads start with.
 */
export default function NewProjectWizard({
  onClose,
  onCreated,
  onSubmit,
  bare = false,
}: {
  onClose: () => void
  onCreated?: () => void
  /** When set (the dedicated New Project OS window), hands the finished options off instead of
   *  creating the project directly — that window has its own isolated store, so the real project
   *  creation happens back in the main window once the options round-trip there over IPC. */
  onSubmit?: (opts: NewProjectOptions) => void
  /** Renders without the modal backdrop/card chrome, filling the whole window — set when this
   *  wizard IS the New Project window's entire content. */
  bare?: boolean
}) {
  const createProjectFromWizard = useProjectStore((s) => s.createProjectFromWizard)

  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('Untitled Album')
  const [specTab, setSpecTab] = useState<'company' | 'custom'>('company')
  const [shape, setShape] = useState<AlbumSizeCategory>('Square')
  const [presetId, setPresetId] = useState(DEFAULT_ALBUM_SIZE.id)

  const [presets, setPresets] = useState<SizePreset[]>(() => loadSizePresets())
  const [selectedPreset, setSelectedPreset] = useState('')
  const [presetName, setPresetName] = useState('')
  const [units, setUnits] = useState<DisplayUnit>('in')
  const [widthIn, setWidthIn] = useState(DEFAULT_ALBUM_SIZE.widthIn)
  const [heightIn, setHeightIn] = useState(DEFAULT_ALBUM_SIZE.heightIn)
  const [dpi, setDpi] = useState(DEFAULT_ALBUM_SIZE.dpi)
  const [trim, setTrim] = useState<EdgeInset>(DEFAULT_ALBUM_SIZE.trim)
  const [safeZone, setSafeZone] = useState<EdgeInset>(DEFAULT_ALBUM_SIZE.safeZone)
  const [minPages, setMinPages] = useState(0)
  const [maxPages, setMaxPages] = useState(0)
  const [layoutStart, setLayoutStart] = useState<'spread' | 'single'>('spread')
  const [layoutEnd, setLayoutEnd] = useState<'spread' | 'single'>('spread')
  const [includeFullSpreadTemplates, setIncludeFullSpreadTemplates] = useState(true)
  const [colorProfile, setColorProfile] = useState('sRGB')

  const [backgroundColor, setBackgroundColor] = useState('#ffffff')
  const [gapPx, setGapPx] = useState(8)
  const [borderWidth, setBorderWidth] = useState(0)
  const [borderColor, setBorderColor] = useState('#000000')
  const [libraryFilter, setLibraryFilter] = useState<TemplateFrameFilter>('all')

  function applyPreset(presetName: string) {
    const preset = presets.find((p) => p.presetName === presetName)
    if (!preset) return
    setSelectedPreset(presetName)
    setWidthIn(preset.widthIn)
    setHeightIn(preset.heightIn)
    setDpi(preset.dpi)
    setTrim(preset.trim)
    setSafeZone(preset.safeZone)
    setMinPages(preset.minPages ?? 0)
    setMaxPages(preset.maxPages ?? 0)
  }

  function saveCurrentAsPreset() {
    const trimmed = presetName.trim()
    if (!trimmed) return
    const preset: SizePreset = {
      id: `preset-${trimmed}`,
      presetName: trimmed,
      label: trimmed,
      category: 'Custom',
      widthIn,
      heightIn,
      dpi,
      trim,
      safeZone,
      minPages: minPages || undefined,
      maxPages: maxPages || undefined,
    }
    setPresets(addSizePreset(preset))
    setSelectedPreset(trimmed)
    setPresetName('')
  }

  function removeSelectedPreset() {
    if (!selectedPreset) return
    setPresets(deleteSizePreset(selectedPreset))
    setSelectedPreset('')
  }

  // A small, fixed-size preview of what the chosen library filter leaves available — one
  // representative layout per common photo count — instead of a 500+ item checkbox list, matching
  // the reference app's own small gallery-style preview (it doesn't offer per-template toggles here
  // either; that level of curation still lives in the Inspector's per-spread template picker).
  const previewTemplates = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15]
        .map((count) => templatesForCount(count, null, libraryFilter)[0])
        .filter((t): t is NonNullable<typeof t> => !!t),
    [libraryFilter]
  )

  const enabledTemplateIds = useMemo(() => {
    if (libraryFilter === 'all') return null
    const narrowed = BUILT_IN_TEMPLATES.filter((t) => matchesFrameFilter(t, libraryFilter)).map((t) => t.id)
    return narrowed.length > 0 ? narrowed : null
  }, [libraryFilter])

  function toggleShape(category: AlbumSizeCategory) {
    setSelectedPreset('')
    setShape(category)
    const first = ALBUM_SIZES.find((a) => a.category === category)
    if (first) setPresetId(first.id)
  }

  function resolveSize(): AlbumSize {
    // A saved preset (loaded via `applyPreset`, reachable from either tab) always wins — it's
    // already populated width/height/dpi/trim/safeZone below, same shape as a fully custom size.
    if (specTab === 'company' && !selectedPreset) {
      return ALBUM_SIZES.find((s) => s.id === presetId) ?? DEFAULT_ALBUM_SIZE
    }
    return {
      id: selectedPreset ? `preset-${selectedPreset}` : 'custom',
      label: selectedPreset || `Custom ${widthIn}" x ${heightIn}"`,
      category: 'Custom',
      widthIn,
      heightIn,
      dpi,
      trim,
      safeZone,
      minPages: minPages || undefined,
      maxPages: maxPages || undefined,
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
      defaultMarginPx: 24,
      defaultBorderWidth: borderWidth,
      defaultBorderColor: borderColor,
      enabledTemplateIds,
      layoutStart,
      layoutEnd,
      includeFullSpreadTemplates,
    }
    if (onSubmit) {
      onSubmit(opts)
      return
    }
    createProjectFromWizard(opts)
    onCreated?.()
    onClose()
  }

  const dimStep = units === 'cm' ? 0.5 : units === 'px' ? 10 : 0.25
  const marginStep = units === 'cm' ? 0.1 : units === 'px' ? 5 : 0.0625

  return (
    <Modal
      title="New Album"
      onClose={onClose}
      width={620}
      bare={bare}
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
              Start
            </button>
          )}
        </>
      }
    >
      <div className="wizard-steps">
        {(['Choose Project Specifications', 'Template Library and Appearance Settings'] as const).map((label, i) => (
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
            <button className={specTab === 'company' ? 'is-active' : ''} onClick={() => setSpecTab('company')}>
              Album Company Preset
            </button>
            <button className={specTab === 'custom' ? 'is-active' : ''} onClick={() => setSpecTab('custom')}>
              Custom
            </button>
          </div>

          {specTab === 'company' ? (
            <>
              <label className="field">
                Album Company:
                <select value="ynot" onChange={() => undefined}>
                  <option value="ynot">YNOT Photography</option>
                </select>
              </label>

              {presets.length > 0 && (
                <div className="field-section" style={{ marginTop: 10 }}>
                  <div className="field-section__title">Saved Presets</div>
                  <div className="preset-row">
                    <select value={selectedPreset} onChange={(e) => applyPreset(e.target.value)}>
                      <option value="">Use a standard size below instead…</option>
                      {presets.map((p) => (
                        <option key={p.presetName} value={p.presetName}>
                          {p.presetName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="field-section">
                <div className="field-section__title">Album Format and Size</div>
                <div className="shape-picker">
                  {SHAPES.map((s) => (
                    <button
                      key={s.category}
                      className={`shape-option ${!selectedPreset && shape === s.category ? 'is-selected' : ''}`}
                      onClick={() => toggleShape(s.category)}
                    >
                      <span className="shape-option__swatch" style={{ width: 28, height: 28 / s.aspect }} />
                      {s.label}
                    </button>
                  ))}
                </div>
                <label className="field">
                  Exact size
                  <select
                    value={presetId}
                    onChange={(e) => {
                      setSelectedPreset('')
                      setPresetId(e.target.value)
                    }}
                  >
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
              </div>
            </>
          ) : (
            <>
              {presets.length > 0 && (
                <div className="preset-row">
                  <select value={selectedPreset} onChange={(e) => applyPreset(e.target.value)}>
                    <option value="">[New Preset]</option>
                    {presets.map((p) => (
                      <option key={p.presetName} value={p.presetName}>
                        {p.presetName}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn--tiny" disabled={!presetName.trim()} onClick={saveCurrentAsPreset}>
                    Save Preset
                  </button>
                  <button className="btn btn--tiny btn--danger" disabled={!selectedPreset} onClick={removeSelectedPreset}>
                    Delete Preset
                  </button>
                </div>
              )}
              <div className="save-template-row" style={{ marginBottom: 14 }}>
                <input placeholder="Preset name" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
                <button className="btn btn--tiny" disabled={!presetName.trim()} onClick={saveCurrentAsPreset}>
                  Save Preset
                </button>
              </div>

              <div className="field-grid">
                <label className="field">
                  DPI
                  <input type="number" min={72} max={600} value={dpi} onChange={(e) => setDpi(Number(e.target.value))} />
                </label>
                <label className="field">
                  Units
                  <select value={units} onChange={(e) => setUnits(e.target.value as DisplayUnit)}>
                    <option value="in">in</option>
                    <option value="cm">cm</option>
                    <option value="px">px</option>
                  </select>
                </label>
                <label className="field">
                  Min pages (0 = no limit)
                  <input type="number" min={0} max={999} value={minPages} onChange={(e) => setMinPages(Math.max(0, Number(e.target.value)))} />
                </label>
                <label className="field">
                  Max pages (0 = no limit)
                  <input type="number" min={0} max={999} value={maxPages} onChange={(e) => setMaxPages(Math.max(0, Number(e.target.value)))} />
                </label>
              </div>

              <div className="field-section-row">
                <div className="field-section">
                  <div className="field-section__title">Output Dimensions</div>
                  <label className="field">
                    Spread width ({units})
                    <input
                      type="number"
                      step={dimStep}
                      value={inToDisplay(widthIn, units, dpi)}
                      onChange={(e) => setWidthIn(displayToIn(Number(e.target.value), units, dpi))}
                    />
                  </label>
                  <label className="field">
                    Spread height ({units})
                    <input
                      type="number"
                      step={dimStep}
                      value={inToDisplay(heightIn, units, dpi)}
                      onChange={(e) => setHeightIn(displayToIn(Number(e.target.value), units, dpi))}
                    />
                  </label>
                </div>
                <div className="field-section">
                  <div className="field-section__title">Layout Type</div>
                  <label className="field">
                    Starts with
                    <select value={layoutStart} onChange={(e) => setLayoutStart(e.target.value as 'spread' | 'single')}>
                      <option value="spread">Full spread</option>
                      <option value="single">Single page</option>
                    </select>
                  </label>
                  <label className="field">
                    Ends with
                    <select value={layoutEnd} onChange={(e) => setLayoutEnd(e.target.value as 'spread' | 'single')}>
                      <option value="spread">Full spread</option>
                      <option value="single">Single page</option>
                    </select>
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={includeFullSpreadTemplates}
                      onChange={(e) => setIncludeFullSpreadTemplates(e.target.checked)}
                    />
                    Include full spread templates
                  </label>
                </div>
              </div>

              <div className="field-section-row">
                <div className="field-section">
                  <div className="field-section__title">Safe Zone</div>
                  <EdgeInsetFields value={safeZone} onChange={setSafeZone} units={units} dpi={dpi} step={marginStep} />
                </div>
                <div className="field-section">
                  <div className="field-section__title">Trim</div>
                  <EdgeInsetFields value={trim} onChange={setTrim} units={units} dpi={dpi} step={marginStep} />
                </div>
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
          <label className="field" style={{ marginBottom: 14 }}>
            Template Library Filter
            <select value={libraryFilter} onChange={(e) => setLibraryFilter(e.target.value as TemplateFrameFilter)}>
              {LIBRARY_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <div className="template-preview-grid">
            {previewTemplates.map((t) => (
              <TemplateThumb key={t.id} template={t} aspect={widthIn / heightIn} className="template-preview-grid__swatch" />
            ))}
          </div>

          <div className="field-section">
            <div className="field-section__title">Appearance</div>
            <label className="field">
              Background color
              <input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} />
            </label>

            <div className="style-field">
              <span className="style-field__label">Border around images</span>
              <select
                value={stylePickFor(borderWidth, BORDER_STYLES)}
                onChange={(e) => {
                  const found = BORDER_STYLES.find((s) => s.label === e.target.value)
                  if (found) setBorderWidth(found.px)
                }}
              >
                {BORDER_STYLES.map((s) => (
                  <option key={s.label} value={s.label}>
                    {s.label}
                  </option>
                ))}
                <option value="Custom" disabled hidden>
                  Custom
                </option>
              </select>
              <input
                type="number"
                min={0}
                max={200}
                value={borderWidth}
                onChange={(e) => setBorderWidth(Number(e.target.value))}
              />
              <span className="style-field__unit">pt</span>
              <input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} />
            </div>

            <div className="style-field">
              <span className="style-field__label">Gap between images</span>
              <select
                value={stylePickFor(gapPx, GAP_STYLES)}
                onChange={(e) => {
                  const found = GAP_STYLES.find((s) => s.label === e.target.value)
                  if (found) setGapPx(found.px)
                }}
              >
                {GAP_STYLES.map((s) => (
                  <option key={s.label} value={s.label}>
                    {s.label}
                  </option>
                ))}
                <option value="Custom" disabled hidden>
                  Custom
                </option>
              </select>
              <input type="number" min={0} max={200} value={gapPx} onChange={(e) => setGapPx(Number(e.target.value))} />
              <span className="style-field__unit">pt</span>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
