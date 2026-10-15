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
  ManualProofingOptions,
} from '@/engine/exportAlbum'
import { parseSpreadRange } from '@/engine/exportUtil'

type ExportFormat = 'pdf' | 'jpg' | 'png' | 'psd' | 'proofing'
type ExportTab = 'print' | 'proofing'

const FORMATS: { id: ExportFormat; title: string; desc: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'pdf', title: 'PDF', desc: 'One print-ready, multi-page PDF for the whole album.', icon: 'frame' },
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
  const spreadCount = project.spreads.length

  const [tab, setTab] = useState<ExportTab>('print')
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  // "For Printing" state
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [rangeMode, setRangeMode] = useState<'all' | 'range'>('all')
  const [rangeText, setRangeText] = useState('')
  const [singlePages, setSinglePages] = useState(false)

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
    if (format === 'pdf') {
      outcome = singlePages ? await exportAlbumToPdfPages(project, spreadIndices) : await exportAlbumToPdf(project, spreadIndices)
    } else if (format === 'jpg') outcome = await exportAlbumToJpegs(project, spreadIndices)
    else if (format === 'png') outcome = await exportAlbumToPngs(project, spreadIndices)
    else if (format === 'psd') outcome = await exportAlbumToPsds(project, spreadIndices)
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

  async function handleExport() {
    setExporting(true)
    setResult(null)
    try {
      const outcome = tab === 'print' ? await handleExportPrint() : await handleExportManualProofing()
      setResult(outcome.saved ? outcome.filePath ?? outcome.dirPath ?? 'Export complete.' : null)
    } finally {
      setExporting(false)
    }
  }

  const rangeInvalid = rangeMode === 'range' && parseSpreadRange(rangeText, spreadCount).length === 0

  return (
    <Modal
      title="Export Album"
      subtitle={`${spreadCount} spread${spreadCount === 1 ? '' : 's'} · ${project.size.label}`}
      onClose={onClose}
      width={480}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {result ? 'Done' : 'Cancel'}
          </button>
          <div className="footer-spacer" />
          <button className="btn btn--primary" disabled={exporting || rangeInvalid} onClick={() => void handleExport()}>
            <Icon name="download" size={14} />
            {exporting ? 'Exporting…' : tab === 'print' ? 'Export' : 'Export for Manual Proofing'}
          </button>
        </>
      }
    >
      <div className="tab-row">
        <button className={tab === 'print' ? 'is-active' : ''} onClick={() => { setTab('print'); setResult(null) }}>
          For Printing
        </button>
        <button className={tab === 'proofing' ? 'is-active' : ''} onClick={() => { setTab('proofing'); setResult(null) }}>
          Manual Proofing
        </button>
      </div>

      {tab === 'print' && (
        <>
          <div className="format-grid">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                className={`format-option ${format === f.id ? 'is-selected' : ''}`}
                onClick={() => {
                  setFormat(f.id)
                  setResult(null)
                }}
              >
                <span className="format-option__icon">
                  <Icon name={f.icon} size={18} />
                </span>
                <span>
                  <span className="format-option__title">{f.title}</span>
                  <div className="format-option__desc">{f.desc}</div>
                </span>
              </button>
            ))}
          </div>

          {format !== 'proofing' && (
            <section className="export-options">
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

              {format === 'pdf' && (
                <label className="checkbox-row">
                  <input type="checkbox" checked={singlePages} onChange={(e) => setSinglePages(e.target.checked)} />
                  Export as single pages (one PDF per spread, instead of one combined file)
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

      {result && (
        <p className="muted" style={{ marginTop: 14 }}>
          Saved to: {result}
        </p>
      )}
    </Modal>
  )
}
