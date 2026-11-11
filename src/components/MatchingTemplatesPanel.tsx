import {useTemplateBrowsing} from '@/state/templateBrowsing'
import {askTemplateCategory} from './ClassifyTemplate'
import ContextMenu from './ContextMenu'
import {classifyTemplates,useTemplateCollections,matchesCollection} from '@/engine/templateCollections'
import {supportsUniformGap} from '@/engine/templateLayout'
import TemplateTransfer from './TemplateTransfer'
import {templateCategory} from '@/engine/templateTransfer'
import QuoteTemplates from './QuoteTemplates'
import { usePreferences } from '@/state/preferences'
import { pagePlacements, TemplateScope } from '@/engine/pageTemplates'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { importedDesignTemplates, isFullSpreadTemplate, templatesForCount, uniqueTemplates } from '@/engine/templates'
import {rankTemplates, templateFramesInReadingOrder, templateShapesFit} from '@/engine/templateMatching'
import { isEditableTarget } from '@/engine/keyboard'
import TemplateThumb from './TemplatePreview'
import Icon from './Icon'

/** Template previews leave the album unchanged until applied. */
export default function MatchingTemplatesPanel() {
  const collections=useTemplateCollections(),[selection,setSelection]=useState<string[]>([]),[menu,setMenu]=useState<{x:number;y:number;id:string}|null>(null)
  const [marquee,setMarquee]=useState<{x:number;y:number;left:number;top:number;width:number;height:number}|null>(null)
  const kind=useProjectStore(s=>s.templateBrowseKind)
  const designer=useProjectStore(s=>!!s.designerViewSpreadId)
  const autoRearrange=usePreferences(s=>s.values.autoRearrange)
  const userTemplates=useProjectStore(s=>s.userTemplates)
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
  const [scope, setScope] = useState<TemplateScope>('spread')

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
    // A template tile is as tall as the panel can give it, not a fixed slice of the window. The
    // two strips share the panel height, so dragging the browser taller makes the templates
    // bigger — which is the point of being able to drag it. The previous cap was 8% of the window
    // height in the designer, about 60px, which made the previews too small to tell apart.
    function resize() {
      // Measured off the panel itself rather than read from the CSS variable: that variable is
      // '42vh' until the resizer has been dragged, and parseFloat of '42vh' is 42, which collapsed
      // the tiles to their minimum.
      const panel = document.querySelector('.matching-templates')?.clientHeight || window.innerHeight * 0.42
      // Room taken by the two labels, the header and the padding between the strips.
      const perRow = Math.max(44, (panel - 86) / 2)
      const widest = window.innerWidth <= 800 ? 150 : Math.max(160, Math.min(420, window.innerWidth * 0.24))
      setTileWidth(Math.max(42, Math.min(widest, perRow * aspect)))
    }
    resize()
    window.addEventListener('resize', resize)
    // The resizer writes the panel height onto the document element, so watch it for drags.
    const observer = new MutationObserver(resize)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => { window.removeEventListener('resize', resize); observer.disconnect() }
  }, [aspect,designer,open])
  const {categories,setCategories,collection,setCollection,favoritesOnly,setFavoritesOnly}=useTemplateBrowsing()
  const rows = useMemo(() => {
    if (!open || !spread || !count) return [[], []]
    const photos = placements.flatMap(p => { const photo = project.photos.find(photo => photo.id === p.photoId); return photo ? [photo] : [] })
    const candidates = uniqueTemplates([...templatesForCount(count, project.enabledTemplateIds, filter, aspect), ...importedDesignTemplates(count, project.enabledTemplateIds, filter, aspect)])
      .filter(t => (kind==='mixed'?!!t.textBoxes?.length:!t.textBoxes?.length) && (templateCategory(t)!=='reference'||isFullSpreadTemplate(t)||supportsUniformGap(t.placeholders,aspect,spread.marginPx*(target==='spread'?1:2),spread.gapPx*(target==='spread'?1:2))) && categories[templateCategory(t)] && matchesCollection(t.id,collection,collections,favorites) && (!favoritesOnly || favorites.includes(t.id)))
    // Offer only layouts that can give every photo a frame of its own shape — a portrait photo in
    // a landscape frame loses its top and bottom. If nothing fits, show everything rather than an
    // empty browser, since the designer may want to crop deliberately.
    const marginPx = spread.marginPx * (target === 'spread' ? 1 : 2), gapPx = spread.gapPx * (target === 'spread' ? 1 : 2)
    const shapesFit = photos.length === count ? candidates.filter(t => templateShapesFit(photos, t, aspect, marginPx, gapPx)) : []
    const offered = shapesFit.length ? shapesFit : candidates
    return (count > 1 ? [false, true] : [true]).map(keepOrder => (rankTemplates(photos, offered, aspect, !autoRearrange || keepOrder, spread.marginPx * (target === 'spread' ? 1 : 2), spread.gapPx * (target === 'spread' ? 1 : 2)))
      .sort((a, b) => Number(/^ref-(album|edge|signature)-/.test(b.template.id)) - Number(/^ref-(album|edge|signature)-/.test(a.template.id)) || Number(isFullSpreadTemplate(b.template)) - Number(isFullSpreadTemplate(a.template)) || (['reference','creative'].indexOf(templateCategory(a.template))-['reference','creative'].indexOf(templateCategory(b.template))) || Number(favorites.includes(b.template.id)) - Number(favorites.includes(a.template.id))))
  }, [kind,collection,collections,userTemplates, categories, open, spread, project.photos, project.enabledTemplateIds, count, filter, aspect, favorites, favoritesOnly, placements, target, autoRearrange])
  useEffect(() => { setActive(null); setOffsets([0, 0]); preview(null); strips.current.forEach(strip => { if (strip) strip.scrollLeft = 0 }) }, [kind,collection, categories, userTemplates, open, spreadId, count, filter, favoritesOnly, favorites, preview, target])
  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (document.querySelector('.modal-backdrop')) return
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
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
  }, [open, rows, active, preview, close, apply, spreadId, tileWidth, count, target, autoRearrange])
  useEffect(() => {
    if (open && !spread) close()
    return () => { useProjectStore.getState().previewMatchingTemplate(null) }
  }, [open, spreadId, !!spread, close])
  if (!open || !spread) return null
  const number = project.spreads.filter(s => !s.isCover).sort((a, b) => a.order - b.order).findIndex(s => s.id === spread.id) + 1
  return <section className="matching-templates" aria-label="Matching templates" onMouseLeave={() => { setActive(null); preview(null) }}>
    <header className="matching-templates__header">
      <span role="status">Spread {number}: {rows[0].length} matching {kind} templates found.</span>
      {!designer&&<QuoteTemplates spreadId={spread.id}/>}{spread.pageSide === 'spread' && <select aria-label="Template page" value={scope} onChange={e=>setScope(e.target.value as TemplateScope)}>
        <option value="spread">Whole spread</option><option value="left">Left page only</option><option value="right">Right page only</option>
      </select>}
      <select aria-label="Template frame filter" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
        <option value="all">All Templates</option><option value="no-square">Without square frames</option><option value="only-3x2">Only 3:2 frame ratios</option>
      </select>
      <button className={`btn btn--tiny ${favoritesOnly ? 'is-active' : ''}`} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}><Icon name="heart" size={12} /> Favorites</button>
      <button className="btn btn--icon btn--tiny" onClick={close} aria-label="Close matching templates" title="Close matching templates (Escape)"><Icon name="x" size={14} /></button>
    </header>
    <div className="template-source-controls">{(['reference','creative'] as const).filter(key=>kind!=='mixed'||key==='creative').map(key=><label key={key}><input type="checkbox" checked={categories[key]} onChange={e=>setCategories({...categories,[key]:e.target.checked})}/>{key==='reference'?'Smart design':'Creative design'}</label>)}<TemplateTransfer/><select aria-label="Saved template category" value={collection} onChange={e=>setCollection(e.target.value)}><option value="">All categories</option>{['Favorites','Frequently used',...Object.keys(collections.categories)].map(c=><option key={c}>{c}</option>)}</select></div>
    {target !== 'spread' && <div className="matching-templates__info">Changes apply to the {target} page only. Images crossing the center line stay unchanged.</div>}
    {count === 0 && <div className="matching-templates__info">No visible, unlocked photos or frames on this page. Hidden photos, locked photos and background images stay unchanged.</div>}
    {count === 1 && <div className="matching-templates__info"><strong>Rearrange Timeline:</strong><span>A single image has no timeline order to rearrange.</span></div>}
    {(count > 1 ? ['Rearrange Timeline', 'Match Timeline Order'] : ['Match Timeline Order']).map((label, row) => <div className="matching-templates__row" key={label}>
      <span className="matching-templates__label">{label}:</span>
      <button className="btn btn--icon" aria-label={`Previous ${label} templates`} onClick={() => strips.current[row]?.scrollBy({ left: -strips.current[row]!.clientWidth * 0.8, behavior: 'smooth' })}><Icon name="chevronLeft" size={14} /></button>
      <div className="matching-templates__strip" ref={el => { strips.current[row] = el }} aria-label={label} onPointerDown={e=>{if(e.button!==0||(e.target as Element).closest('button'))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setMarquee({x:e.clientX,y:e.clientY,left:e.clientX,top:e.clientY,width:0,height:0});setSelection([])}} onPointerMove={e=>{if(!marquee)return;const box={...marquee,left:Math.min(marquee.x,e.clientX),top:Math.min(marquee.y,e.clientY),width:Math.abs(e.clientX-marquee.x),height:Math.abs(e.clientY-marquee.y)};setMarquee(box);setSelection(Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-template-id]')).filter(el=>{const r=el.getBoundingClientRect();return r.right>=box.left&&r.left<=box.left+box.width&&r.bottom>=box.top&&r.top<=box.top+box.height}).map(el=>el.dataset.templateId!))}} onPointerUp={()=>setMarquee(null)} onPointerCancel={()=>setMarquee(null)} onScroll={event => { const offset = Math.max(0, Math.floor(event.currentTarget.scrollLeft / (tileWidth + 12)) - 2); setOffsets(current => current[row] === offset ? current : current.map((value, i) => i === row ? offset : value)) }}>
        <div style={{ position: 'relative', flex: '0 0 auto', width: Math.max(0, rows[row].length * (tileWidth + 12) - 12), height: tileWidth / aspect + 12 }}>
        {rows[row].slice(offsets[row], offsets[row] + Math.ceil((strips.current[row]?.clientWidth ?? tileWidth * 10) / (tileWidth + 12)) + 8).map(({template, photos}, slot) => { const index = offsets[row] + slot; return <div className={`matching-template ${active?.row === row && active.index === index ? 'is-previewing' : ''} ${spread.templateId === template.id ? 'is-current' : ''} ${selection.includes(template.id)?'is-selected':''}`} key={template.id} data-template-id={template.id} onContextMenu={e=>{e.preventDefault();setMenu({x:e.clientX,y:e.clientY,id:template.id});if(!selection.includes(template.id))setSelection([template.id])}} style={{ position: 'absolute', left: index * (tileWidth + 12), width: tileWidth }}>
          <button className="matching-template__apply" title={`${template.name} — preview, click to apply`} onMouseEnter={() => { setActive({ row, index }); preview(template.id, !autoRearrange || count <= 1 || row === 1, target) }} onFocus={() => { setActive({ row, index }); preview(template.id, !autoRearrange || count <= 1 || row === 1, target) }} onClick={e => { if(e.shiftKey||e.ctrlKey||e.metaKey){setSelection(ids=>ids.includes(template.id)?ids.filter(id=>id!==template.id):[...ids,template.id]);return}apply(spread.id, template.id, !autoRearrange || count <= 1 || row === 1, target); close() }}>
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
    {marquee&&<div style={{position:"fixed",left:marquee.left,top:marquee.top,width:marquee.width,height:marquee.height,border:"1px solid var(--accent)",background:"rgba(100,140,220,.16)",pointerEvents:"none",zIndex:1000}}/>}
    {menu&&<ContextMenu x={menu.x} y={menu.y} onClose={()=>setMenu(null)} items={[
 {label:'Add selected to category…',onClick:async()=>{const ids=selection.length?selection:[menu.id],template=useProjectStore.getState().allTemplates().find(t=>t.id===menu.id);setMenu(null);const category=await askTemplateCategory(template);if(category)classifyTemplates(ids,category)}},
 {label:'Add selected to Favorites',onClick:()=>{for(const id of selection.length?selection:[menu.id])if(!favorites.includes(id))toggleFavorite(id)}},
 {label:'Delete selected creative templates',danger:true,disabled:!selection.some(id=>userTemplates.some(t=>t.id===id)),onClick:()=>{for(const id of selection)if(userTemplates.some(t=>t.id===id))useProjectStore.getState().deleteUserTemplate(id);setSelection([])}}]}/>}
  </section>
}
