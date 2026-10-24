import ExcludedTemplatePhotos, { ExclusionFilter } from './ExcludedTemplatePhotos'
import { usePreferences } from '@/state/preferences'
import { pagePlacements, templatePhotoCounts, TemplateScope } from '@/engine/pageTemplates'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { templatesForCount } from '@/engine/templates'
import { rankTemplates, templateFramesInReadingOrder } from '@/engine/templateMatching'
import { isEditableTarget } from '@/engine/keyboard'
import TemplateThumb from './TemplatePreview'
import Icon from './Icon'

/** Template previews leave the album unchanged until applied. */
export default function MatchingTemplatesPanel() {
  const autoRearrange=usePreferences(s=>s.values.autoRearrange)
  const project = useProjectStore(s => s.project)
  const spreadId = useProjectStore(s => s.selectedSpreadId)
  const open = useProjectStore(s => s.matchingTemplatesOpen)
  const preview = useProjectStore(s => s.previewMatchingTemplate)
  const close = useProjectStore(s => s.closeMatchingTemplates)
  const apply = useProjectStore(s => s.applyTemplateToSpread)
  const filter = useProjectStore(s => s.templateFrameFilter)
  const setFilter = useProjectStore(s => s.setTemplateFrameFilter)
  const favorites = useProjectStore(s => s.favoriteTemplateIds)
  const toggleFavorite = useProjectStore(s => s.toggleTemplateFavorite)
  const [excludedFilter,setExcludedFilter]=useState<ExclusionFilter|null>(null)
  const excludedTrigger=useRef<HTMLButtonElement|null>(null)
  const closeExcluded=()=>{setExcludedFilter(null);excludedTrigger.current?.focus()}
  useEffect(()=>{setExcludedFilter(null)},[spreadId,open])
  const [scope, setScope] = useState<TemplateScope>('spread')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [active, setActive] = useState<{ row: number; index: number } | null>(null)
  const [offsets, setOffsets] = useState([0, 0])
  const [tileWidth, setTileWidth] = useState(220)
  const strips = useRef<(HTMLDivElement | null)[]>([])
  const spread = project.spreads.find(s => s.id === spreadId && !s.isCover)
  const size = spread?.size ?? project.size
  const target = spread?.pageSide === 'spread' ? scope : 'spread'
  const placements = useMemo(() => spread ? pagePlacements(spread, size.widthIn / size.heightIn, target) : [], [spread, size, target])
  const count = placements.filter(p => p.photoId).length || placements.length
  const aspect = size.widthIn / size.heightIn / (target === 'spread' ? 1 : 2)
  useEffect(() => { setScope('spread') }, [spreadId, open])
  useEffect(() => {
    function resize() { const width = window.innerWidth <= 800 ? 150 : Math.max(160, Math.min(window.innerHeight <= 700 ? 240 : 360, window.innerWidth * (window.innerHeight <= 700 ? 0.2 : 0.24))); setTileWidth(Math.min(width, Math.max(42, Math.min(120, window.innerHeight * 0.14)) * aspect)) }
    resize(); window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [aspect])
  const rows = useMemo(() => {
    if (!open || !spread || !count) return [[], []]
    const photos = placements.flatMap(p => { const photo = project.photos.find(photo => photo.id === p.photoId); return photo ? [photo] : [] })
    const candidates = templatesForCount(count, project.enabledTemplateIds, filter, aspect)
      .filter(t => !favoritesOnly || favorites.includes(t.id))
    return (count > 1 ? [false, true] : [true]).map(keepOrder => rankTemplates(photos, candidates, aspect, !autoRearrange || keepOrder, spread.marginPx * (target === 'spread' ? 1 : 2), spread.gapPx * (target === 'spread' ? 1 : 2))
      .sort((a, b) => Number(favorites.includes(b.template.id)) - Number(favorites.includes(a.template.id))))
  }, [open, spread, project.photos, project.enabledTemplateIds, count, filter, aspect, favorites, favoritesOnly, placements, target, autoRearrange])
  useEffect(() => { setActive(null); setOffsets([0, 0]); preview(null); strips.current.forEach(strip => { if (strip) strip.scrollLeft = 0 }) }, [open, spreadId, count, filter, favoritesOnly, favorites, preview, target])
  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (document.querySelector('.modal-backdrop')) return
      if (event.key === 'Escape' && excludedFilter) {event.preventDefault();event.stopPropagation();closeExcluded();return}
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
      if (event.target instanceof Element && event.target.closest('.matching-templates__excluded, [data-exclusion]')) return
      if (isEditableTarget(event.target)) return
      if (event.key === 'Enter' && event.target instanceof Element && event.target.closest('.matching-templates button') && !event.target.closest('.matching-template__apply')) return
      if (!['ArrowLeft', 'ArrowRight', 'Enter'].includes(event.key) || event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault(); event.stopPropagation()
      const focusedRow = strips.current.findIndex(strip => event.target instanceof Node && strip?.contains(event.target))
      const row = Math.min(active?.row ?? Math.max(0, focusedRow), rows.length - 1)
      const keepOrder = !autoRearrange || count <= 1 || row === 1
      let index = active?.index ?? -1
      if (event.key === 'Enter') {
        const template = rows[row][Math.max(0, index)]?.template
        if (template && spreadId) { apply(spreadId, template.id, keepOrder, target); close() }
        return
      }
      index += event.key === 'ArrowLeft' ? -1 : 1
      index = Math.max(0, Math.min(rows[row].length - 1, index))
      const template = rows[row][index]?.template
      if (!template) return
      setActive({ row, index }); preview(template.id, !autoRearrange || count <= 1 || row === 1, target)
      const strip = strips.current[row], left = index * (tileWidth + 12)
      if (strip && (left < strip.scrollLeft || left + tileWidth > strip.scrollLeft + strip.clientWidth)) strip.scrollLeft = left
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, rows, active, preview, close, apply, spreadId, tileWidth, count, target, autoRearrange, excludedFilter])
  useEffect(() => {
    if (open && !spread) close()
    return () => { useProjectStore.getState().previewMatchingTemplate(null) }
  }, [open, spreadId, !!spread, close])
  if (!open || !spread) return null
  const photoCounts=templatePhotoCounts(spread,size.widthIn/size.heightIn,target)
  const number = project.spreads.filter(s => !s.isCover).sort((a, b) => a.order - b.order).findIndex(s => s.id === spread.id) + 1
  return <section className="matching-templates" aria-label="Matching templates" onMouseLeave={() => { setActive(null); preview(null) }}>
    <header className="matching-templates__header">
      <span role="status">Spread {number}: {rows[0].length} matching templates found.</span>
      {spread.pageSide === 'spread' && <select aria-label="Template page" value={scope} onChange={e=>setScope(e.target.value as TemplateScope)}>
        <option value="spread">Whole spread</option><option value="left">Left page only</option><option value="right">Right page only</option>
      </select>}
      <select aria-label="Template frame filter" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
        <option value="all">All Templates</option><option value="no-square">Without square frames</option><option value="only-3x2">Only 3:2 frame ratios</option>
      </select>
      <button className={`btn btn--tiny ${favoritesOnly ? 'is-active' : ''}`} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}><Icon name="heart" size={12} /> Favorites</button>
      <button className="btn btn--icon btn--tiny" onClick={close} aria-label="Close matching templates" title="Close matching templates (Escape)"><Icon name="x" size={14} /></button>
    </header>
    <div className="matching-templates__count-wrap">
    <div className="matching-templates__photo-counts" role="status" aria-label="Template photo counts" title="Counts refer to photo placements, not unique source files." aria-live="polite">
      <strong>Included: {photoCounts.included}</strong>
      {(['excluded','locked','hidden','background'] as const).map(key=><button type="button" className="matching-templates__count-button" data-exclusion={key} key={key} aria-expanded={excludedFilter===key} onClick={e=>{excludedTrigger.current=e.currentTarget;setExcludedFilter(excludedFilter===key?null:key)}}>{key[0].toUpperCase()+key.slice(1)}: {photoCounts[key]}</button>)}
      {photoCounts.overlap>0&&<small>{photoCounts.overlap} both locked and hidden; counted once in excluded.</small>}
      {target!=='spread'&&<small>Foreground counts cover the selected page only.</small>}
    </div>
    {excludedFilter&&<ExcludedTemplatePhotos spread={spread} photos={project.photos} aspect={size.widthIn/size.heightIn} scope={target} filter={excludedFilter} onClose={closeExcluded}/>}
    </div>
    {target !== 'spread' && <div className="matching-templates__info">Changes apply to the {target} page only. Images crossing the center line stay unchanged.</div>}
    {count === 0 && <div className="matching-templates__info">No visible, unlocked photos or frames on this page. Hidden photos, locked photos and background images stay unchanged.</div>}
    {count === 1 && <div className="matching-templates__info"><strong>Rearrange Timeline:</strong><span>A single image has no timeline order to rearrange.</span></div>}
    {(count > 1 ? ['Rearrange Timeline', 'Match Timeline Order'] : ['Match Timeline Order']).map((label, row) => <div className="matching-templates__row" key={label}>
      <span className="matching-templates__label">{label}:</span>
      <button className="btn btn--icon" aria-label={`Previous ${label} templates`} onClick={() => strips.current[row]?.scrollBy({ left: -strips.current[row]!.clientWidth * 0.8, behavior: 'smooth' })}><Icon name="chevronLeft" size={14} /></button>
      <div className="matching-templates__strip" ref={el => { strips.current[row] = el }} aria-label={label} onScroll={event => { const offset = Math.max(0, Math.floor(event.currentTarget.scrollLeft / (tileWidth + 12)) - 1); setOffsets(current => current.map((value, i) => i === row ? offset : value)) }}>
        <div style={{ position: 'relative', flex: '0 0 auto', width: Math.max(0, rows[row].length * (tileWidth + 12) - 12), height: tileWidth / aspect + 12 }}>
        {rows[row].slice(offsets[row], offsets[row] + Math.ceil((strips.current[row]?.clientWidth ?? tileWidth * 10) / (tileWidth + 12)) + 3).map(({template, photos}, slot) => { const index = offsets[row] + slot; return <div className={`matching-template ${active?.row === row && active.index === index ? 'is-previewing' : ''} ${spread.templateId === template.id ? 'is-current' : ''}`} key={template.id} style={{ position: 'absolute', left: index * (tileWidth + 12), width: tileWidth }}>
          <button className="matching-template__apply" title={`${template.name} — preview, click to apply`} onMouseEnter={() => { setActive({ row, index }); preview(template.id, !autoRearrange || count <= 1 || row === 1, target) }} onFocus={() => { setActive({ row, index }); preview(template.id, !autoRearrange || count <= 1 || row === 1, target) }} onClick={() => { apply(spread.id, template.id, !autoRearrange || count <= 1 || row === 1, target); close() }}>
            <TemplateThumb template={template} photos={templateFramesInReadingOrder(template).map(frame=>photos[template.placeholders.indexOf(frame)])} placements={placements} aspect={aspect} marginPx={spread.marginPx * (target === 'spread' ? 1 : 2)} gapPx={spread.gapPx * (target === 'spread' ? 1 : 2)} />
            <span className="sr-only">{label}: {template.name}</span>
          </button>
          <button className={`matching-template__favorite ${favorites.includes(template.id) ? 'is-favorite' : ''}`} aria-label={`${favorites.includes(template.id) ? 'Unfavorite' : 'Favorite'} ${template.name}`} aria-pressed={favorites.includes(template.id)} onClick={() => toggleFavorite(template.id)}><Icon name="heart" size={14} /></button>
        </div> })}
        </div>
        {!rows[row].length && <p className="muted">No matching templates. Change the frame filter{favoritesOnly ? ' or turn off Favorites' : ''}.</p>}
      </div>
      <button className="btn btn--icon" aria-label={`Next ${label} templates`} onClick={() => strips.current[row]?.scrollBy({ left: strips.current[row]!.clientWidth * 0.8, behavior: 'smooth' })}><Icon name="chevronRight" size={14} /></button>
    </div>)}
  </section>
}
