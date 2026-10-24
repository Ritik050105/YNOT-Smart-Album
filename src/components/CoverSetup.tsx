import { useEffect, useRef, useState } from 'react'
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
  const [step, setStep] = useState(existing || initialMode ? 2 : 1)
  const [mode, setMode] = useState<'guide' | 'custom'>(initialMode ?? (existing?.coverDetails?.guideSrc ? 'guide' : existing ? 'custom' : 'guide'))
  const [units, setUnits] = useState(initialUnits)
  const [widthIn, setWidth] = useState(existing?.size?.widthIn ?? projectSize.widthIn)
  const [heightIn, setHeight] = useState(existing?.size?.heightIn ?? projectSize.heightIn)
  const [dpi, setDpi] = useState(existing?.size?.dpi ?? projectSize.dpi)
  const [wrapIn, setWrap] = useState(existing?.coverDetails?.wrapIn ?? 0)
  const [spineIn, setSpine] = useState(existing?.coverDetails?.spineIn ?? 0)
  const [guideSrc, setGuideSrc] = useState(existing?.coverDetails?.guideSrc)
  const fileInput = useRef<HTMLInputElement>(null)
  const [guideName, setGuideName] = useState(existing?.coverDetails?.guideName ?? 'Cover guide')
  const [guidePixels, setGuidePixels] = useState(existing?.coverDetails?.guidePixels ?? (existing?.coverDetails?.guideSrc && existing.size ? {width:existing.size.widthIn*existing.size.dpi,height:existing.size.heightIn*existing.size.dpi} : undefined))
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const size: AlbumSize = { ...projectSize, id: 'custom-cover', label: 'Photo Wrap Cover', category: 'Custom', widthIn: mode === 'guide' && guidePixels ? guidePixels.width / dpi : widthIn, heightIn: mode === 'guide' && guidePixels ? guidePixels.height / dpi : heightIn, dpi, trim: uniformInset(0), safeZone: uniformInset(0) }
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
      setGuidePixels({width:image.naturalWidth,height:image.naturalHeight}); setGuideName(file.name); setGuideSrc(src)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not read this cover guide.') }
    finally { if (temporarySrc.startsWith('blob:')) URL.revokeObjectURL(temporarySrc); setLoading(false) }
  }

  return <Modal title="Cover Specifications" subtitle="Photo wrap cover · Back, spine and front" className="cover-specifications" width={720} onClose={onClose} footer={<>
    <button className="btn" onClick={onClose}>Cancel</button><div className="footer-spacer" />
    {step === 2 && <button className="btn" onClick={() => setStep(1)}>Back</button>}
    <button className="btn btn--primary" disabled={step === 2 && (!!validation || loading || (mode === 'guide' && !guideSrc))}
      onClick={() => {
        if (step === 1) { setStep(2); return }
        try { onCreate(size, { wrapIn, spineIn, guideSrc: mode === 'guide' ? guideSrc : undefined, guideName: mode === 'guide' ? guideName : undefined, guidePixels: mode === 'guide' ? guidePixels : undefined }) }
        catch (err) { setError(err instanceof Error ? err.message : 'Could not create this cover.') }
      }}>{step === 1 ? 'Next' : existing ? 'Update Photo Wrap Cover' : 'Create Photo Wrap Cover'}</button>
  </>}>
    {step === 1 ? <section className="cover-setup__intro">
      <h3>Photo Wrap Cover</h3><div className="cover-setup__diagram"><span>Back</span><span>Spine</span><span>Front</span></div>
      <p>A photo wrap cover is one continuous print around the album. Design it with images, patterns and text. Use a lab-provided guide or enter the cover dimensions in the next step.</p>
    </section> : <>
      <section className={`cover-choice ${mode === 'guide' ? 'is-active' : ''}`}>
        <button className="cover-choice__heading" aria-expanded={mode === 'guide'} onClick={() => {setMode('guide');setError(null)}}>Cover Guide File<span>Use your album company's artwork guide</span></button>
        {mode === 'guide' && <div className="cover-choice__body">
          <input ref={fileInput} type="file" hidden accept={IMAGE_FILE_ACCEPT} disabled={loading} onChange={e=>{void readGuide(e.target.files?.[0]);e.target.value=''}} />
          <div className={`cover-guide-drop ${dragOver ? 'is-dragging' : ''}`} onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault();setDragOver(false);if(!loading)void readGuide(e.dataTransfer.files[0])}}>
            {guideSrc ? <><button className="btn btn--icon cover-guide-remove" aria-label="Remove cover guide" disabled={loading} onClick={()=>{setGuideSrc(undefined);setGuidePixels(undefined);setError(null)}}>×</button><img className="cover-setup__guide" src={guideSrc} alt="Cover guide preview" /><strong>{guideName}</strong><span className="muted">{guidePixels?.width} × {guidePixels?.height} pixels</span></> : <><strong>Drop your cover guide here</strong><span className="muted">JPEG, PNG, TIFF or compatible PSD</span></>}
            <button className="btn" disabled={loading} onClick={()=>fileInput.current?.click()}>{loading ? 'Reading guide…' : guideSrc ? 'Choose another file' : 'Choose File'}</button>
          </div>
          <label className="field cover-guide-dpi">Guide DPI<input type="number" min={1} value={dpi} onChange={e=>setDpi(Number(e.target.value))} /></label>
          {guidePixels && dpi > 0 && <p className="muted">Cover size: {size.widthIn.toFixed(2)} × {size.heightIn.toFixed(2)} in</p>}
        </div>}
      </section>
      <section className={`cover-choice ${mode === 'custom' ? 'is-active' : ''}`}>
        <button className="cover-choice__heading" aria-expanded={mode === 'custom'} onClick={()=>{setMode('custom');setError(null)}}>Custom Dimensions<span>Enter the complete cover size supplied by your lab</span></button>
        {mode === 'custom' && <div className="cover-choice__body">
      <label className="field">Units<select value={units} onChange={(e) => setUnits(e.target.value as DisplayUnit)}><option value="in">Inches</option><option value="cm">Centimeters</option><option value="px">Pixels</option></select></label>
      <div className="auto-build-range">
        <label className="field">Width ({units})<input type="number" min={0} step="any" value={inToDisplay(widthIn, units, dpi)} onChange={(e) => setWidth(displayToIn(Number(e.target.value), units, dpi))} /></label>
        <label className="field">Height ({units})<input type="number" min={0} step="any" value={inToDisplay(heightIn, units, dpi)} onChange={(e) => setHeight(displayToIn(Number(e.target.value), units, dpi))} /></label>
        <label className="field">DPI<input type="number" min={1} value={dpi} onChange={(e) => setDpi(Number(e.target.value))} /></label>
      </div>
        </div>}
      </section>
      <details className="cover-guide-options"><summary>Wrap & spine guides</summary>
      <div className="auto-build-range">
        <label className="field">Wrap ({units})<input type="number" min={0} step="any" value={inToDisplay(wrapIn, units, dpi)} onChange={(e) => setWrap(displayToIn(Number(e.target.value), units, dpi))} /></label>
        <label className="field">Spine ({units})<input type="number" min={0} step="any" value={inToDisplay(spineIn, units, dpi)} onChange={(e) => setSpine(displayToIn(Number(e.target.value), units, dpi))} /></label>
      </div>
      </details>
      <p className="muted">Continue to the designer to add photos, text and ruler guides for safe zone, trim, wrap and spine. Use the cover specifications supplied by your album company. Review them when the number of pages changes.</p>
      {(error || (mode === 'custom' || guideSrc) && validation) && <p className="cover-specifications__error" role="alert">{error || validation}</p>}
    </>}
  </Modal>
}
