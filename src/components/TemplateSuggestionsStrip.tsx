import { useProjectStore } from '@/state/projectStore'
import { templatesForCount } from '@/engine/templates'
import TemplateThumb from './TemplatePreview'
import Icon from './Icon'

/** The reference app shows its matching-template suggestions as a horizontally scrollable strip
 *  sitting right above the spread filmstrip — not tucked away in a side panel you have to open
 *  first. Reuses the same matching logic as Inspector's "Smart Grid Suggestions" section, just
 *  surfaced here so switching a spread's layout doesn't require selecting a placeholder first. */
export default function TemplateSuggestionsStrip() {
  const project = useProjectStore((s) => s.project)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const frameFilter = useProjectStore((s) => s.templateFrameFilter)
  const applyTemplateToSpread = useProjectStore((s) => s.applyTemplateToSpread)

  const spread = project.spreads.find((s) => s.id === selectedSpreadId)
  if (!spread) return null

  const spreadAspect = project.size.widthIn / project.size.heightIn
  const suggestions = templatesForCount(spread.placements.length, null, frameFilter)
  const interior = project.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order)
  const label = spread.isCover ? 'Cover' : `Spread ${interior.findIndex((s) => s.id === spread.id) + 1}`

  if (suggestions.length === 0) return null

  return (
    <div className="template-suggestions">
      <div className="template-suggestions__header">
        <Icon name="sparkles" size={12} />
        {label}: {suggestions.length} matching templates found.
      </div>
      <div className="template-suggestions__strip">
        {suggestions.map((t) => (
          <button
            key={t.id}
            className={`template-swatch ${spread.templateId === t.id ? 'is-active' : ''}`}
            onClick={() => applyTemplateToSpread(spread.id, t.id)}
            title={t.name}
          >
            <TemplateThumb template={t} aspect={spreadAspect} className="template-swatch__shape" />
          </button>
        ))}
      </div>
    </div>
  )
}
