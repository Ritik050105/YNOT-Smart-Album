import { useEffect, useState } from 'react'
import { IMAGE_FILE_ACCEPT, imageFileSource } from '@/engine/imageSource'
import { blobUrlToDataUrl } from '@/engine/projectFile'
import { useProjectStore } from '@/state/projectStore'
import { AlbumSize, Spread } from '@/types'
import { validateCoverSize } from '@/engine/cover'
import { displayToIn, inToDisplay, DisplayUnit } from '@/engine/units'
import { uniformInset } from '@/engine/albumSizes'
import Modal from './Modal'

export default function CoverSetup() {
  const project = useProjectStore((s) => s.project)
  const configureCover = useProjectStore((s) => s.configureCover)
  const [request, setRequest] = useState<{ photoIds: string[]; mode?: 'guide' | 'custom' } | null>(null)
  useEffect(() => {
    const open = (event: Event) => setRequest({ photoIds: (event as CustomEvent).detail?.photoIds ?? [], mode: (event as CustomEvent).detail?.mode })
    window.addEventListener('album-studio:setup-cover', open)
    return () => window.removeEventListener('album-studio:setup-cover', open)
  }, [])
  return request && <CoverDialog key={project.id} projectSize={project.size} units={project.units}
    initialMode={request.mode} existing={project.spreads.find((s) => s.isCover)} onClose={() => setRequest(null)}
    onCreate={(size, details) => { configureCover(size, { ...details, reviewedPageCount: project.spreads.filter((s) => !s.isCover).reduce((n, s) => n + (s.pageSide === 'spread' ? 2 : 1), 0) }, request.photoIds); setRequest(null) }} />
}

function CoverDialog({ projectSize, units: initialUnits, existing, initialMode, onClose, onCreate }: {
  initialMode?: 'guide' | 'custom'
  projectSize: AlbumSize; units: DisplayUnit; existing?: Spread; onClose: () => void
  onCreate: (size: AlbumSize, details: Omit<NonNullable<Spread['coverDetails']>, 'reviewedPageCount'>) => void
}) {
  const [step, setStep] = useState(existing ? 2 : 1)
  const [mode, setMode] = useState<'guide' | 'custom'>(initialMode ?? 'custom')
  const [units, setUnits] = useState(initialUnits)
  const [widthIn, setWidth] = useState(existing?.size?.widthIn ?? projectSize.widthIn)
  const [heightIn, setHeight] = useState(existing?.size?.heightIn ?? projectSize.heightIn)
  const [dpi, setDpi] = useState(existing?.size?.dpi ?? projectSize.dpi)
  const [wrapIn, setWrap] = useState(existing?.coverDetails?.wrapIn ?? 0)
  const [spineIn, setSpine] = useState(existing?.coverDetails?.spineIn ?? 0)
  const [guideSrc, setGuideSrc] = useState(existing?.coverDetails?.guideSrc)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const size: AlbumSize = { ...projectSize, id: 'custom-cover', label: 'Photo Wrap Cover', category: 'Custom', widthIn, heightIn, dpi, trim: uniformInset(0), safeZone: uniformInset(0) }
  const validation = validateCoverSize(size, projectSize)

  async function readGuide(file: File | undefined) {
    if (!file) return
    setLoading(true); setError(null)
    let temporarySrc = ''
    try {
      temporarySrc = await imageFileSource(file)
      const src = await blobUrlToDataUrl(temporarySrc)
      const image = new Image()
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Choose a JPEG, PNG, or compatible PSD cover guide.')); image.src = src })
      setWidth(image.naturalWidth / dpi); setHeight(image.naturalHeight / dpi); setGuideSrc(src)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not read this cover guide.') }
    finally { if (temporarySrc.startsWith('blob:')) URL.revokeObjectURL(temporarySrc); setLoading(false) }
  }

  return <Modal title="Cover Specifications" width={720} onClose={onClose} footer={<>
    <button className="btn" onClick={onClose}>Cancel</button><div className="footer-spacer" />
    {step === 2 && <button className="btn" onClick={() => setStep(1)}>Back</button>}
    <button className="btn btn--primary" disabled={step === 2 && (!!validation || loading || (mode === 'guide' && !guideSrc))}
      onClick={() => {
        if (step === 1) { setStep(2); return }
        try { onCreate(size, { wrapIn, spineIn, guideSrc: mode === 'guide' ? guideSrc : undefined }) }
        catch (err) { setError(err instanceof Error ? err.message : 'Could not create this cover.') }
      }}>{step === 1 ? 'Next' : existing ? 'Update Photo Wrap Cover' : 'Create Photo Wrap Cover'}</button>
  </>}>
    {step === 1 ? <section className="cover-setup__intro">
      <h3>Photo Wrap Cover</h3><div className="cover-setup__diagram"><span>Back</span><span>Spine</span><span>Front</span></div>
      <p>A photo wrap cover is one continuous print around the album. Design it with images, patterns and text. Use a lab-provided guide or enter the cover dimensions in the next step.</p>
    </section> : <>
      <div className="tab-row"><button className={mode === 'guide' ? 'is-active' : ''} onClick={() => setMode('guide')}>Cover Guide File</button><button className={mode === 'custom' ? 'is-active' : ''} onClick={() => setMode('custom')}>Custom Dimensions</button></div>
      {mode === 'guide' && <label className="field">Drop a cover guide here or choose a file
        <input type="file" accept={IMAGE_FILE_ACCEPT} disabled={loading} onChange={(e) => void readGuide(e.target.files?.[0])} />
        {guideSrc && <img className="cover-setup__guide" src={guideSrc} alt="Cover guide" />}
      </label>}
      <label className="field">Units<select value={units} onChange={(e) => setUnits(e.target.value as DisplayUnit)}><option value="in">Inches</option><option value="cm">Centimeters</option><option value="px">Pixels</option></select></label>
      <div className="auto-build-range">
        <label className="field">Width ({units})<input type="number" min={0} step="any" value={inToDisplay(widthIn, units, dpi)} onChange={(e) => setWidth(displayToIn(Number(e.target.value), units, dpi))} /></label>
        <label className="field">Height ({units})<input type="number" min={0} step="any" value={inToDisplay(heightIn, units, dpi)} onChange={(e) => setHeight(displayToIn(Number(e.target.value), units, dpi))} /></label>
        <label className="field">DPI<input type="number" min={1} value={dpi} onChange={(e) => setDpi(Number(e.target.value))} /></label>
      </div>
      <div className="auto-build-range">
        <label className="field">Wrap ({units})<input type="number" min={0} step="any" value={inToDisplay(wrapIn, units, dpi)} onChange={(e) => setWrap(displayToIn(Number(e.target.value), units, dpi))} /></label>
        <label className="field">Spine ({units})<input type="number" min={0} step="any" value={inToDisplay(spineIn, units, dpi)} onChange={(e) => setSpine(displayToIn(Number(e.target.value), units, dpi))} /></label>
      </div>
      <p className="muted">Use the cover specifications supplied by your album company. Review them when the number of pages changes.</p>
      {(error || validation) && <p role="alert">{error || validation}</p>}
    </>}
  </Modal>
}
