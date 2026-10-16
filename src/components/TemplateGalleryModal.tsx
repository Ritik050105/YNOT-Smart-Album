import { useMemo, useState } from 'react'
import Modal from './Modal'
import Icon from './Icon'
import { useProjectStore } from '@/state/projectStore'
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
 *  go to actually search the whole set (by photo count, family, and frame-ratio shape), the same
 *  role as the reference app's template browser window. */
export default function TemplateGalleryModal({
  initialCount,
  onClose,
}: {
  initialCount: number
  onClose: () => void
}) {
  const userTemplates = useProjectStore((s) => s.userTemplates)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const applyTemplateToSpread = useProjectStore((s) => s.applyTemplateToSpread)

  const [count, setCount] = useState(Math.max(1, Math.min(30, initialCount || 1)))
  const [family, setFamily] = useState<(typeof TEMPLATE_FAMILIES)[number]>('All')
  const [frameFilter, setFrameFilter] = useState<TemplateFrameFilter>('all')

  const allTemplates = useMemo(() => [...BUILT_IN_TEMPLATES, ...userTemplates], [userTemplates])

  const filtered = useMemo(() => {
    return allTemplates.filter((t) => {
      if (t.photoCount !== count) return false
      if (family !== 'All' && templateFamilyLabel(t) !== family) return false
      if (!matchesFrameFilter(t, frameFilter)) return false
      return true
    })
  }, [allTemplates, count, family, frameFilter])

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
      width={880}
      footer={
        <button className="btn" onClick={onClose}>
          Close
        </button>
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
      <div className="gallery-grid">
        {filtered.map((t) => (
          <button
            key={t.id}
            className="gallery-swatch"
            style={templateSwatchStyle(t)}
            onClick={() => apply(t.id)}
            title={t.name}
          >
            <span className="gallery-swatch__grid" aria-hidden="true">
              {t.placeholders.map((ph) => (
                <span
                  key={ph.id}
                  style={{
                    left: `${ph.x * 100}%`,
                    top: `${ph.y * 100}%`,
                    width: `${ph.width * 100}%`,
                    height: `${ph.height * 100}%`,
                  }}
                />
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
    </Modal>
  )
}
