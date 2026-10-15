import { useState } from 'react'
import Modal from './Modal'
import Icon from './Icon'
import { useProjectStore } from '@/state/projectStore'
import {
  exportAlbumToPdf,
  exportAlbumToJpegs,
  exportAlbumToPngs,
  exportAlbumToPsds,
  exportAlbumToProofingGallery,
} from '@/engine/exportAlbum'

type ExportFormat = 'pdf' | 'jpg' | 'png' | 'psd' | 'proofing'

const FORMATS: { id: ExportFormat; title: string; desc: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { id: 'pdf', title: 'PDF', desc: 'One print-ready, multi-page PDF for the whole album.', icon: 'frame' },
  { id: 'jpg', title: 'JPG', desc: 'One high-res JPEG per spread — for lab upload.', icon: 'image' },
  { id: 'png', title: 'PNG', desc: 'One lossless PNG per spread, if a lab requires it.', icon: 'layers' },
  { id: 'psd', title: 'PSD (layered)', desc: 'Layered Photoshop file per spread, for finishing by hand.', icon: 'palette' },
  { id: 'proofing', title: 'Proofing Gallery', desc: 'A single HTML page to email the client for review.', icon: 'bookOpen' },
]

/** Export is multiple distinct choices with real consequences (a file picker opens after), so
 *  it gets a modal rather than a topbar dropdown — the same "focused task" reasoning as the New
 *  Project wizard and Custom Size dialog. */
export default function ExportModal({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((s) => s.project)
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleExport() {
    setExporting(true)
    setResult(null)
    try {
      let outcome: { saved: boolean; filePath?: string; dirPath?: string } = { saved: false }
      if (format === 'pdf') outcome = await exportAlbumToPdf(project)
      else if (format === 'jpg') outcome = await exportAlbumToJpegs(project)
      else if (format === 'png') outcome = await exportAlbumToPngs(project)
      else if (format === 'psd') outcome = await exportAlbumToPsds(project)
      else if (format === 'proofing') outcome = await exportAlbumToProofingGallery(project)

      if (outcome.saved) {
        setResult(outcome.filePath ?? outcome.dirPath ?? 'Export complete.')
      } else {
        setResult(null)
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal
      title="Export Album"
      subtitle={`${project.spreads.length} spread${project.spreads.length === 1 ? '' : 's'} · ${project.size.label}`}
      onClose={onClose}
      width={420}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {result ? 'Done' : 'Cancel'}
          </button>
          <div className="footer-spacer" />
          <button className="btn btn--primary" disabled={exporting} onClick={() => void handleExport()}>
            <Icon name="download" size={14} />
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </>
      }
    >
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
      {result && (
        <p className="muted" style={{ marginTop: 14 }}>
          Saved to: {result}
        </p>
      )}
    </Modal>
  )
}
