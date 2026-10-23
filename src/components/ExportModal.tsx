import { useState } from 'react'
import Modal from './Modal'
import Icon from './Icon'
import { useProjectStore } from '@/state/projectStore'
import {
  exportAlbumToPdf,
  exportAlbumToPdfPages,
  exportAlbumToJpegs,
  exportAlbumToPngs,
  exportAlbumToPsds,
  exportAlbumToProofingGallery,
  exportAlbumForManualProofing,
  checkPageLimits,
  selectSpreads,
  ManualProofingOptions,
} from '@/engine/exportAlbum'
import { parseSpreadRange } from '@/engine/exportUtil'
import { exportPreflight } from '@/engine/exportPreflight'

type ExportFormat = 'pdf' | 'pdfx' | 'jpg' | 'png' | 'psd' | 'proofing'
type ExportTab = 'cloud' | 'print' | 'proofing'

const FORMATS: { id: ExportFormat; title: string; desc: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'pdf', title: 'PDF', desc: 'One print-ready, multi-page PDF for the whole album.', icon: 'frame' },
  { id: 'pdfx', title: 'PDF/X-3', desc: 'Color-managed PDF with an embedded sRGB profile.', icon: 'frame' },
  { id: 'jpg', title: 'JPG', desc: 'One high-res JPEG per spread — for lab upload.', icon: 'image' },
  { id: 'png', title: 'PNG', desc: 'One lossless PNG per spread, if a lab requires it.', icon: 'layers' },
  { id: 'psd', title: 'PSD (layered)', desc: 'Layered Photoshop file per spread, for finishing by hand.', icon: 'palette' },
  { id: 'proofing', title: 'Proofing Gallery', desc: 'A single HTML page to email the client for review.', icon: 'bookOpen' },
]

/** Export is multiple distinct choices with real consequences (a file picker opens after), so
 *  it gets a modal rather than a topbar dropdown — the same "focused task" reasoning as the New
 *  Project wizard and Custom Size dialog. Two tabs: "For Printing" (lab-ready files, with an
 *  Output Range) and "Manual Proofing" (annotated low-res review images with reference marks —
 *  the honest, no-backend equivalent of a hosted "cloud proofing" upload). */
export default function ExportModal({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)
  const spreadCount = project.spreads.filter((s) => !s.isCover).length

  const [tab, setTab] = useState<ExportTab>('print')
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<{filePath?:string;dirPath?:string} | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enhancing, setEnhancing] = useState(false)
  const [enhanced, setEnhanced] = useState(false)
  const [enhanceError, setEnhanceError] = useState('')
  const [preflightWarning, setPreflightWarning] = useState<string | null>(null)
  const [pendingPageLimit, setPendingPageLimit] = useState<{ pageCount: number; min?: number; max?: number } | null>(null)

  // "For Printing" state
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [rangeMode, setRangeMode] = useState<'all' | 'range'>('all')
  const [rangeText, setRangeText] = useState('')
  const [singlePages, setSinglePages] = useState(false)
  const [includeCover, setIncludeCover] = useState(false)
  const [jpegQuality, setJpegQuality] = useState(100)

  // "Manual Proofing" state
  const [proofWidth, setProofWidth] = useState(1600)
  const [includeGutterLine, setIncludeGutterLine] = useState(false)
  const [includeTrimArea, setIncludeTrimArea] = useState(false)
  const [includeSpreadNumbers, setIncludeSpreadNumbers] = useState(true)
  const [includeFileNames, setIncludeFileNames] = useState(false)
  const [includeImageNumbers, setIncludeImageNumbers] = useState(true)
  const [numberingMode, setNumberingMode] = useState<'spread' | 'album'>('spread')
  const [includeWatermark, setIncludeWatermark] = useState(false)
  const [watermarkText, setWatermarkText] = useState(project.clientName || 'YNOT Photography')

  const proofHeight = Math.round((proofWidth / project.size.widthIn) * project.size.heightIn)

  function resolveRange(): number[] | undefined {
    if (rangeMode === 'all') return undefined
    return parseSpreadRange(rangeText, spreadCount)
  }

  async function handleExportPrint() {
    const spreadIndices = resolveRange()
    let outcome: { saved: boolean; filePath?: string; dirPath?: string } = { saved: false }
    if (format === 'pdf' || format === 'pdfx') {
      const options = { pdfX: format === 'pdfx', jpegQuality: jpegQuality / 100 }
      outcome = singlePages
        ? await exportAlbumToPdfPages(project, spreadIndices, includeCover, options)
        : await exportAlbumToPdf(project, spreadIndices, includeCover, options)
    } else if (format === 'jpg') outcome = await exportAlbumToJpegs(project, spreadIndices, includeCover, singlePages, jpegQuality / 100)
    else if (format === 'png') outcome = await exportAlbumToPngs(project, spreadIndices, includeCover, singlePages)
    else if (format === 'psd') outcome = await exportAlbumToPsds(project, spreadIndices, includeCover)
    else if (format === 'proofing') outcome = await exportAlbumToProofingGallery(project)
    return outcome
  }

  async function handleExportManualProofing(): Promise<{ saved: boolean; filePath?: string; dirPath?: string }> {
    const options: ManualProofingOptions = {
      widthPx: proofWidth,
      includeGutterLine,
      includeTrimArea,
      includeSpreadNumbers,
      includeFileNames,
      includeImageNumbers,
      numberingMode,
      includeWatermark,
      watermarkText,
    }
    return exportAlbumForManualProofing(project, options, resolveRange())
  }

  async function handleExport(ignoreLimits = false, ignorePreflight = false) {
    if (tab === 'print' && !ignorePreflight) {
      const checks = exportPreflight(project, resolveRange(), includeCover)
      if (checks.coverNeedsReview || checks.lowResolution.length > 0) {
        setEnhanced(false)
        setEnhanceError('')
        setPreflightWarning([checks.coverNeedsReview ? 'The album page count has changed since the cover specifications were reviewed. Review the cover dimensions with your album company.' : '', checks.lowResolution.length ? `${checks.lowResolution.length} spread(s) contain images enlarged beyond 120% of the target resolution.` : ''].filter(Boolean).join(' '))
        return
      }
    }
    if (tab === 'print' && !ignoreLimits) {
      const limits = checkPageLimits(project)
      if (limits.violated) {
        setPendingPageLimit(limits)
        return
      }
    }
    setExporting(true)
    setResult(null)
    setError(null)
    try {
      const outcome = tab === 'print' ? await handleExportPrint() : await handleExportManualProofing()
      setResult(outcome.saved ? outcome : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const rangeInvalid = rangeMode === 'range' && parseSpreadRange(rangeText, spreadCount).length === 0

  if (result) {
    const location = result.filePath ?? result.dirPath
    const name = location?.split(/[\\/]/).pop()
    return <Modal title={location ? 'Export successful' : 'Export ready'} onClose={onClose} width={540} className="export-success" footer={<>
      <button className="btn" onClick={() => {setResult(null);setError(null)}}>Export again</button>
      <div className="footer-spacer" />
      <button className="btn btn--primary" autoFocus onClick={onClose}>Done</button>
    </>}>
      <div className="export-success__summary" role="status">
        <span className="export-success__check"><Icon name="check" size={26}/></span>
        <div><h3>{location ? 'Your export is saved' : 'Your download has started'}</h3><p>{location ? 'Ready to print or share.' : 'Check your browser downloads for the exported files.'}</p></div>
      </div>
      {location && <div className="export-success__file"><span>{result.dirPath ? 'OUTPUT FOLDER' : 'EXPORTED FILE'}</span><strong>{name}</strong><p>{location}</p>
        {window.albumStudio?.revealExportLocation && <button className="btn" onClick={async () => {
          try {setError(null);await window.albumStudio!.revealExportLocation(location)}
          catch (err) {setError(err instanceof Error ? err.message : 'Could not open the saved location.')}
        }}><Icon name="folder" size={15}/>Open location</button>}
      </div>}
      {error && <p role="alert">{error}</p>}
    </Modal>
  }

  return (
    <Modal
      title="Export Album"
      subtitle={`${spreadCount} spread${spreadCount === 1 ? '' : 's'} · ${project.size.label}`}
      onClose={onClose}
      width={720}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {result ? 'Done' : 'Cancel'}
          </button>
          <div className="footer-spacer" />
          <button
            className="btn btn--primary"
            disabled={exporting || rangeInvalid || tab === 'cloud' || (spreadCount === 0 && !(tab === 'print' && includeCover && project.spreads.some((s) => s.isCover)))}
            onClick={() => void handleExport()}
          >
            <Icon name="download" size={14} />
            {exporting ? 'Exporting…' : tab === 'print' ? 'Export for Print' : tab === 'proofing' ? 'Export for Manual Proofing' : 'Export for Cloud Proofing'}
          </button>
        </>
      }
    >
      {error && <p role="alert">{error}</p>}
      {preflightWarning && <Modal title="Enhance images for print" onClose={() => { if (!enhancing) setPreflightWarning(null) }} width={540} footer={<>
        <button className="btn" disabled={enhancing} onClick={() => { setPreflightWarning(null); onClose() }}>Back to editing</button>
        <div className="footer-spacer" />
        <button className="btn" disabled={enhancing} onClick={() => { setPreflightWarning(null); void handleExport(false, true) }}>Continue to export</button>
      </>}>
        <p>Balance exposure, contrast and color for the images in your selected export range, including backgrounds.</p>
        <button className="btn btn--primary" disabled={enhancing || enhanced} onClick={async () => {
          setEnhancing(true); setEnhanceError('')
          try {
            const targets = selectSpreads(project, resolveRange(), includeCover).flatMap(s => [
              ...s.placements.filter(p => p.photoId).map(p => ({spreadId:s.id,frameId:p.placeholderId})),
              ...(s.backgroundPattern?.mode === 'cover' ? [{spreadId:s.id}] : []),
            ])
            await useProjectStore.getState().autoEnhanceImages(targets)
            setEnhanced(true)
          } catch (err) { setEnhanceError(err instanceof Error ? err.message : 'Could not enhance images.') }
          finally { setEnhancing(false) }
        }}><Icon name="wand" size={16} />{enhancing ? 'Enhancing images…' : enhanced ? 'Images enhanced' : 'Auto Enhance'}</button>
        {enhanced && <p role="status">Tone and color updated. You can review the result in the editor and undo the enhancement.</p>}
        {enhanceError && <p role="alert">{enhanceError}</p>}
        <p className="muted">{preflightWarning} Auto Enhance improves tone and color; it does not increase source resolution.</p>
      </Modal>}
      <div className="tab-row">
        <button className={tab === 'cloud' ? 'is-active' : ''} onClick={() => { setTab('cloud'); setResult(null) }}>
          Cloud Proofing
        </button>
        <button className={tab === 'print' ? 'is-active' : ''} onClick={() => { setTab('print'); setResult(null) }}>
          For Printing
        </button>
        <button className={tab === 'proofing' ? 'is-active' : ''} onClick={() => { setTab('proofing'); setResult(null) }}>
          Manual Proofing
        </button>
      </div>

      {tab === 'cloud' && (
        <section className="export-options">
          <p className="muted" style={{ marginTop: 0 }}>
            Cloud Proofing (hosting a review gallery on SmartAlbums' own servers) needs a hosted
            backend this app doesn't have. Use <strong>Manual Proofing</strong> instead — it builds
            the same kind of annotated review images, which you then share however you like (email,
            a drive link, etc).
          </p>
        </section>
      )}

      {tab === 'print' && (
        <>
          <label className="field">Output Format
            <select value={format} onChange={(e) => { setFormat(e.target.value as ExportFormat); setResult(null) }}>
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </label>

          {format !== 'proofing' && (
            <section className="export-options">
              {['jpg', 'pdf', 'pdfx'].includes(format) && <label>JPEG quality: {jpegQuality}%<input type="range" min={1} max={100} value={jpegQuality} onChange={(e) => setJpegQuality(Number(e.target.value))} /></label>}
              {format === 'pdfx' && <p className="muted">sRGB color-managed output with an embedded ICC profile.</p>}
              <h4>Output Range</h4>
              <label className="radio-row">
                <input type="radio" checked={rangeMode === 'all'} onChange={() => setRangeMode('all')} />
                All spreads
              </label>
              <label className="radio-row">
                <input type="radio" checked={rangeMode === 'range'} onChange={() => setRangeMode('range')} />
                Spread range
                <input
                  type="text"
                  placeholder="1, 2, 5-7"
                  disabled={rangeMode !== 'range'}
                  value={rangeText}
                  onChange={(e) => setRangeText(e.target.value)}
                  style={{ marginLeft: 8, width: 120 }}
                />
              </label>
              {rangeInvalid && <p className="muted" style={{ color: '#ff6b6b' }}>No valid spreads in that range.</p>}

              <label className="checkbox-row">
                <input type="checkbox" checked={includeCover} onChange={(e) => setIncludeCover(e.target.checked)} />
                Include cover
              </label>
              {format !== 'psd' && (
                <label className="checkbox-row">
                  <input type="checkbox" checked={singlePages} onChange={(e) => setSinglePages(e.target.checked)} />
                  Export as single pages
                </label>
              )}
            </section>
          )}
        </>
      )}

      {tab === 'proofing' && (
        <section className="export-options">
          <p className="muted" style={{ marginTop: 0 }}>
            Annotated low-res images for client or lab review — reference marks are baked into each
            image so you can send them any way you like (email, drive link, etc).
          </p>

          <h4>Output Range</h4>
          <label className="radio-row">
            <input type="radio" checked={rangeMode === 'all'} onChange={() => setRangeMode('all')} />
            All spreads
          </label>
          <label className="radio-row">
            <input type="radio" checked={rangeMode === 'range'} onChange={() => setRangeMode('range')} />
            Spread range
            <input
              type="text"
              placeholder="1, 2, 5-7"
              disabled={rangeMode !== 'range'}
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              style={{ marginLeft: 8, width: 120 }}
            />
          </label>
          {rangeInvalid && <p className="muted" style={{ color: '#ff6b6b' }}>No valid spreads in that range.</p>}

          <h4>Output Specifications</h4>
          <label className="checkbox-row">
            Spread width:
            <input
              type="number"
              min={400}
              max={6000}
              value={proofWidth}
              onChange={(e) => setProofWidth(Math.max(400, Math.min(6000, Number(e.target.value))))}
              style={{ marginLeft: 8, width: 90 }}
            />
            px
          </label>
          <p className="muted">Spread height: {proofHeight} px (locked to the album's aspect ratio)</p>

          <h4>Spread Settings</h4>
          <label className="checkbox-row">
            <input type="checkbox" checked={includeGutterLine} onChange={(e) => setIncludeGutterLine(e.target.checked)} />
            Include gutter line
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={includeTrimArea} onChange={(e) => setIncludeTrimArea(e.target.checked)} />
            Include the trim area (bleed / safe-zone guides)
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={includeSpreadNumbers} onChange={(e) => setIncludeSpreadNumbers(e.target.checked)} />
            Include spread numbers
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={includeFileNames} onChange={(e) => setIncludeFileNames(e.target.checked)} />
            Include image file names
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={includeImageNumbers} onChange={(e) => setIncludeImageNumbers(e.target.checked)} />
            Include image numbers
          </label>
          {includeImageNumbers && (
            <div className="text-style-row" style={{ marginLeft: 22 }}>
              <button
                className={`btn btn--tiny ${numberingMode === 'spread' ? 'is-active' : ''}`}
                onClick={() => setNumberingMode('spread')}
              >
                Spread-based
              </button>
              <button
                className={`btn btn--tiny ${numberingMode === 'album' ? 'is-active' : ''}`}
                onClick={() => setNumberingMode('album')}
              >
                Album-based
              </button>
            </div>
          )}
          <label className="checkbox-row">
            <input type="checkbox" checked={includeWatermark} onChange={(e) => setIncludeWatermark(e.target.checked)} />
            Include watermark
          </label>
          {includeWatermark && (
            <input
              type="text"
              placeholder="Watermark text"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
              style={{ marginLeft: 22, width: 'calc(100% - 22px)' }}
            />
          )}
        </section>
      )}



      {pendingPageLimit && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setPendingPageLimit(null)}>
          <div className="modal-card" style={{ width: 420 }} role="dialog" aria-modal="true" aria-label="Page count outside limits">
            <div className="modal-card__header">
              <div>
                <h2>
                  {project.name} · {project.size.label}
                </h2>
              </div>
            </div>
            <div className="modal-card__body">
              <p>
                According to the album size's page limits, the album needs to have between{' '}
                {pendingPageLimit.min ?? 0} and {pendingPageLimit.max ?? '∞'} pages.
              </p>
              <p>Current page count: {pendingPageLimit.pageCount}</p>
              <p>Are you sure you want to continue?</p>
            </div>
            <div className="modal-card__footer">
              <button className="btn" onClick={() => setPendingPageLimit(null)}>
                Cancel
              </button>
              <div className="footer-spacer" />
              <button
                className="btn btn--primary"
                onClick={() => {
                  setPendingPageLimit(null)
                  void handleExport(true, true)
                }}
              >
                Ignore Limitations
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
