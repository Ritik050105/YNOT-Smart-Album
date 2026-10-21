import { useMemo, useState } from 'react'
import Modal from './Modal'
import Icon from './Icon'
import { PreviewCell } from './TemplatePreview'
import { useProjectStore } from '@/state/projectStore'
import { PhotoAsset } from '@/types'
import {
  BUILT_IN_TEMPLATES,
  templateFamilyLabel,
  templateSwatchStyle,
  matchesFrameFilter,
  TemplateFrameFilter,
  TEMPLATE_FAMILIES,
} from '@/engine/templates'

/** Full-library browser for the ~500+ built-in layouts plus any saved/imported templates — the
 *  Inspector's inline "Smart Grid Suggestions" only has room for a handful, so this is where you
 *  go to actually search the whole set (by photo count, family, and frame-ratio shape). Selecting
 *  a swatch (click or just hovering) updates a large preview pane rendered with this spread's own
 *  photos — not an abstract outline — so it's clear what applying it will actually look like
 *  before you commit, the same role as the reference app's template browser window. */
export default function TemplateGalleryModal({
  initialCount,
  onClose,
}: {
  initialCount: number
  onClose: () => void
}) {
  const userTemplates = useProjectStore((s) => s.userTemplates)
  const project = useProjectStore((s) => s.project)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const applyTemplateToSpread = useProjectStore((s) => s.applyTemplateToSpread)

  const spread = project.spreads.find((s) => s.id === selectedSpreadId)

  const [count, setCount] = useState(Math.max(1, Math.min(30, initialCount || 1)))
  const [family, setFamily] = useState<(typeof TEMPLATE_FAMILIES)[number]>('All')
  const [frameFilter, setFrameFilter] = useState<TemplateFrameFilter>('all')
  const [previewId, setPreviewId] = useState<string | null>(null)

  const allTemplates = useMemo(() => [...BUILT_IN_TEMPLATES, ...userTemplates], [userTemplates])

  const filtered = useMemo(() => {
    return allTemplates.filter((t) => {
      if (t.photoCount !== count) return false
      if (family !== 'All' && templateFamilyLabel(t) !== family) return false
      if (!matchesFrameFilter(t, frameFilter)) return false
      return true
    })
  }, [allTemplates, count, family, frameFilter])

  // The spread's own placed photos, in slot order — reused to fill the preview so it shows real
  // content instead of blank/gradient boxes. Falls back to the project's unplaced photos so the
  // preview still has something to show even on a freshly auto-built or empty spread.
  const previewPhotos = useMemo(() => {
    const placed = (spread?.placements ?? [])
      .map((p) => (p.photoId ? project.photos.find((ph) => ph.id === p.photoId) : undefined))
      .filter((p): p is PhotoAsset => !!p)
    if (placed.length > 0) return placed
    return project.photos.slice(0, count)
  }, [spread, project.photos, count])

  const previewTemplate = filtered.find((t) => t.id === previewId) ?? filtered[0]
  // Spreads are two pages wide — this is the real shape templates get rendered into, so swatches
  // and the preview pane are sized to match it instead of assuming square.
  const spreadAspect = project.size.widthIn / project.size.heightIn

  function apply(templateId: string) {
    if (!selectedSpreadId) return
    applyTemplateToSpread(selectedSpreadId, templateId)
    onClose()
  }

  return (
    <Modal
      title="Template Gallery"
      subtitle={`${allTemplates.length} templates in your library · ${filtered.length} match ${count} photo${count === 1 ? '' : 's'}`}
      onClose={onClose}
      width={1320}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <div className="footer-spacer" />
          <button className="btn btn--primary" disabled={!previewTemplate} onClick={() => previewTemplate && apply(previewTemplate.id)}>
            <Icon name="check" size={14} />
            Apply {previewTemplate ? `"${previewTemplate.name}"` : 'Template'}
          </button>
        </>
      }
    >
      <div className="gallery-filters">
        <label className="gallery-filters__count">
          Photo count
          <input
            type="number"
            min={1}
            max={30}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
          />
        </label>
        <select value={frameFilter} onChange={(e) => setFrameFilter(e.target.value as TemplateFrameFilter)}>
          <option value="all">All Templates</option>
          <option value="no-square">Without square frames</option>
          <option value="only-3x2">Only 3:2 frame ratios</option>
        </select>
      </div>
      <div className="gallery-tabs">
        {TEMPLATE_FAMILIES.map((f) => (
          <button key={f} className={family === f ? 'is-active' : ''} onClick={() => setFamily(f)}>
            {f}
          </button>
        ))}
      </div>

      <div className="gallery-layout">
        <div className="gallery-grid">
          {filtered.map((t) => (
            <button
              key={t.id}
              className={`gallery-swatch ${previewTemplate?.id === t.id ? 'is-previewing' : ''}`}
              style={{ ...templateSwatchStyle(t), aspectRatio: spreadAspect }}
              onMouseEnter={() => setPreviewId(t.id)}
              onClick={() => setPreviewId(t.id)}
              onDoubleClick={() => apply(t.id)}
              title={`${t.name} — click to preview, double-click to apply`}
            >
              <span className="gallery-swatch__grid" aria-hidden="true">
                {t.placeholders.map((ph, i) => (
                  <PreviewCell key={ph.id} ph={ph} photo={previewPhotos[i]} />
                ))}
              </span>
              <span className="gallery-swatch__name">{t.name}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="empty-state">
              <Icon name="grid" size={24} />
              <p>No templates match these filters for {count} photos. Try a different count or family.</p>
            </div>
          )}
        </div>

        <div className="gallery-preview">
          <h4>Live Preview</h4>
          {previewTemplate ? (
            <>
              <div className="gallery-preview__stage" style={{ aspectRatio: spreadAspect }}>
                {previewTemplate.placeholders.map((ph, i) => (
                  <PreviewCell key={ph.id} ph={ph} photo={previewPhotos[i]} />
                ))}
              </div>
              <p className="gallery-preview__name">{previewTemplate.name}</p>
              <p className="muted">
                {previewPhotos.length < previewTemplate.photoCount
                  ? 'Using your unplaced photos to preview — exact frames may differ once applied.'
                  : "Rendered with this spread's own photos."}
              </p>
            </>
          ) : (
            <p className="muted">Hover or click a template on the left to preview it here.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
