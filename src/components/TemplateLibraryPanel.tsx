import { useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { BUILT_IN_TEMPLATES } from '@/engine/templates'
import { blobUrlToDataUrl } from '@/engine/projectFile'
import TemplateThumb from './TemplatePreview'
import Icon from './Icon'

/** Browse the full template library (built-in + user-saved/imported) and register new templates
 *  from an uploaded reference photo — "template registration" + "template importing via photo
 *  uploading". Importing a photo doesn't attempt to detect a layout from it (no vision model
 *  here); instead you pick which built-in grid the new template should use, and the photo
 *  becomes its thumbnail in the library so it's easy to recognize later. */
export default function TemplateLibraryPanel() {
  const userTemplates = useProjectStore((s) => s.userTemplates)
  const importTemplateFromPhoto = useProjectStore((s) => s.importTemplateFromPhoto)
  const deleteUserTemplate = useProjectStore((s) => s.deleteUserTemplate)
  const spreadAspect = useProjectStore((s) => s.project.size.widthIn / s.project.size.heightIn)

  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null)
  const [importName, setImportName] = useState('')
  const [importBaseId, setImportBaseId] = useState(BUILT_IN_TEMPLATES[0].id)
  const [importing, setImporting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    const url = URL.createObjectURL(file)
    const dataUrl = await blobUrlToDataUrl(url)
    URL.revokeObjectURL(url)
    setPendingPhoto(dataUrl)
    setImportName(file.name.replace(/\.[^.]+$/, ''))
  }

  async function confirmImport() {
    if (!pendingPhoto || !importName.trim()) return
    setImporting(true)
    try {
      await importTemplateFromPhoto(importName.trim(), importBaseId, pendingPhoto)
      setPendingPhoto(null)
      setImportName('')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="panel template-library">
      <h3>
        <Icon name="bookOpen" size={14} />
        Template Library
      </h3>

      {!pendingPhoto ? (
        <button className="btn btn--block" onClick={() => inputRef.current?.click()}>
          <Icon name="upload" size={14} />
          Import Template from Photo
        </button>
      ) : (
        <div className="template-import-form">
          <img src={pendingPhoto} alt="" className="template-import-form__preview" />
          <input placeholder="Template name" value={importName} onChange={(e) => setImportName(e.target.value)} />
          <select value={importBaseId} onChange={(e) => setImportBaseId(e.target.value)}>
            {BUILT_IN_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.photoCount} photo{t.photoCount === 1 ? '' : 's'})
              </option>
            ))}
          </select>
          <div className="template-import-form__actions">
            <button className="btn" onClick={() => setPendingPhoto(null)}>
              Cancel
            </button>
            <button className="btn btn--primary" disabled={importing || !importName.trim()} onClick={() => void confirmImport()}>
              {importing ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {userTemplates.length === 0 ? (
        <div className="empty-state">
          <Icon name="layers" size={24} />
          <p>No saved templates yet. Use "Save" on a spread's layout, or import one from a photo above.</p>
        </div>
      ) : (
        <div className="template-library__grid">
          {userTemplates.map((t) => (
            <div key={t.id} className="template-library__item">
              <TemplateThumb template={t} aspect={spreadAspect} className="template-library__swatch" />
              <span className="template-library__name">{t.name}</span>
              <button className="btn btn--tiny btn--danger" onClick={() => deleteUserTemplate(t.id)}>
                <Icon name="trash" size={10} />
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
