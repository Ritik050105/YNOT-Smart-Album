import { setSlideDirection } from '@/engine/slideDirection'
import {useTemplateBrowsing} from '@/state/templateBrowsing'
import {askTemplateCategory} from './ClassifyTemplate'
import ContextMenu from './ContextMenu'
import {classifyTemplates,useTemplateCollections,matchesCollection,matchesAlbumSize} from '@/engine/templateCollections'
import {offeredLayouts,varyPatterns} from '@/engine/layoutOffer'
import {defaultLayouts} from '@/engine/autoLayout'
import {supportsUniformGap} from '@/engine/templateLayout'
import TemplateTransfer from './TemplateTransfer'
import {templateCategory,mustHoldGap} from '@/engine/templateTransfer'
import {wantedTemplates} from '@/engine/templateCounts'
import QuoteTemplates from './QuoteTemplates'
import { usePreferences } from '@/state/preferences'
import { pagePlacements, TemplateScope } from '@/engine/pageTemplates'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { findTemplate, importedDesignTemplates, isFullSpreadTemplate, mixCandidates, sequenceCandidates, showcaseCandidates, templatesForCount, uniqueTemplates } from '@/engine/templates'
import {rankTemplates, templateFramesInReadingOrder, templateOrderMismatches, templateShapeMismatches} from '@/engine/templateMatching'
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
  // The card slides toward the template chosen: forward when the tile is to the right of the last one looked at, back when to the
  // left, and back the way it came when the preview is taken off.
  const lastTile = useRef<{ row: number; index: number } | null>(null), lastDirection = useRef<1 | -1>(1)
  const slideToward = (row: number, index: number) => {
    const last = lastTile.current, direction: 1 | -1 = last && last.row === row ? (index >= last.index ? 1 : -1) : 1
    lastTile.current = { row, index }; lastDirection.current = direction; setSlideDirection(direction)
  }
  const slideBack = () => { setSlideDirection(lastDirection.current === 1 ? -1 : 1) }
  const [offsets, setOffsets] = useState([0, 0])
  // Either row of templates can be folded away with its eye button, and stays so: the panel is then as tall as what shows (nothing cut off or scrolled, and
  // with both folded only its bars), and the row left is drawn as big as the room allows.
  const [folded, setFolded] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem('ynot.templateRowsFolded') || '{}') } catch { return {} } })
  const toggleFold = (label: string) => setFolded(current => { const next = { ...current, [label]: !current[label] }; try { localStorage.setItem('ynot.templateRowsFolded', JSON.stringify(next)) } catch { /* private window */ } return next })
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
      // The height the panel has when both rows show (a folded row shrinks the panel, but the tiles keep their size).
      const variable = getComputedStyle(document.documentElement).getPropertyValue('--template-browser-height').trim(), parsed = parseFloat(variable)
      const panel = variable.endsWith('vh') ? parsed / 100 * window.innerHeight : variable.endsWith('px') ? parsed : document.querySelector('.matching-templates')?.clientHeight || window.innerHeight * 0.42
      // Room taken by the two labels, the header and the padding between the strips.
      // With a row folded away to its bar, the one left shows bigger (it has the room of both); with none folded the two share it.
      const labels = count > 1 ? ['Rearrange Timeline', 'Match Timeline Order'] : ['Match Timeline Order'], foldedCount = labels.filter(label => folded[label]).length
      const perRow = Math.max(44, (panel - 86 - 34 * foldedCount) / (foldedCount ? Math.max(1, labels.length - foldedCount) : 2))
      const widest = window.innerWidth <= 800 ? 150 : Math.max(160, Math.min(420, window.innerWidth * 0.24))
      setTileWidth(Math.max(42, Math.min(widest, perRow * aspect)))
    }
    resize()
    window.addEventListener('resize', resize)
    // The resizer writes the panel height onto the document element, so watch it for drags.
    const observer = new MutationObserver(resize)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
    return () => { window.removeEventListener('resize', resize); observer.disconnect() }
  }, [aspect,designer,open,folded,count])
  const {categories,setCategories,collection,setCollection,albumSize,setAlbumSize,favoritesOnly,setFavoritesOnly}=useTemplateBrowsing()
  const rows = useMemo(() => {
    if (!open || !spread || !count) return [[], []]
    const photos = placements.flatMap(p => { const photo = project.photos.find(photo => photo.id === p.photoId); return photo ? [photo] : [] })
    // A single page (a split spread) is offered what sits on its half, the layouts a split starts it with among them.
    const halfPage = kind === 'image' && (spread.pageSide === 'left' || spread.pageSide === 'right') && photos.length === count
    const candidates = halfPage ? defaultLayouts(photos, spread.pageSide, aspect, spread.marginPx, spread.gapPx, project.enabledTemplateIds) : uniqueTemplates([...sequenceCandidates(photos, count, project.enabledTemplateIds, filter, aspect), ...showcaseCandidates(photos, count, project.enabledTemplateIds, filter, aspect), ...mixCandidates(photos, count, project.enabledTemplateIds, filter, aspect), ...templatesForCount(count, project.enabledTemplateIds, filter, aspect), ...importedDesignTemplates(count, project.enabledTemplateIds, filter, aspect)])
      .filter(t => (kind==='mixed'?!!t.textBoxes?.length:!t.textBoxes?.length) && (!mustHoldGap(t)||supportsUniformGap(t.placeholders,aspect,spread.marginPx*(target==='spread'?1:2),spread.gapPx*(target==='spread'?1:2))) && categories[templateCategory(t)] && matchesCollection(t.id,collection,collections,favorites)&&matchesAlbumSize(t.id,albumSize,collections) && (!favoritesOnly || favorites.includes(t.id)))
    // Offer only layouts that can give every photo a frame of its own shape — a portrait photo in
    // a landscape frame loses its top and bottom. If nothing fits, show everything rather than an
    // empty browser, since the designer may want to crop deliberately.
    const marginPx = spread.marginPx * (target === 'spread' ? 1 : 2), gapPx = spread.gapPx * (target === 'spread' ? 1 : 2)
    // A layout that cannot give every photograph a frame of its own shape is still shown — the
    // designer may want to crop one deliberately, and hiding two thirds of the library to spare
    // them the choice is not help. It simply sorts after the ones that fit, so the first tile in
    // the row is always a layout the photographs go into whole.
    // Ordered by how many photographs the layout cannot give a frame of their own shape, so the
    // row opens with the ones that suit every photograph, then the ones that suit all but one.
    // The row that keeps the timeline order judges each photograph against the frame it would
    // really be given; the rearranging row only needs the right number of each shape.
    const shelf = (keep: boolean) => {
      const fitting = offeredLayouts(photos.length === count ? photos : [], candidates, aspect, marginPx, gapPx, keep, true)
      const mismatches = keep ? templateOrderMismatches : templateShapeMismatches
      const missed = new Map(fitting.map(t => [t.id, photos.length === count ? mismatches(photos, t, aspect, marginPx, gapPx) : 0]))
      return { fitting, missed }
    }
    // The template the spread has now comes first (and is marked), the favourites follow it, then the rest. It is put there even when the shelf would not have
    // offered it, so the one in use is always the first thing in the row.
    const currentTemplate = spread.templateId ? findTemplate(spread.templateId) : undefined
    const selectedFirst = (rowKeep: boolean, list: ReturnType<typeof rankTemplates>) => {
      let pinned = list.find(r => r.template.id === spread.templateId)
      if (!pinned && currentTemplate && !halfPage && target === 'spread' && !favoritesOnly && !collection && photos.length === count && currentTemplate.placeholders.length === count && (kind === 'mixed' ? !!currentTemplate.textBoxes?.length : !currentTemplate.textBoxes?.length)) pinned = rankTemplates(photos, [currentTemplate], aspect, rowKeep, marginPx, gapPx)[0]
      const rest = list.filter(r => r !== pinned)
      return [...(pinned ? [pinned] : []), ...rest.filter(r => favorites.includes(r.template.id)), ...rest.filter(r => !favorites.includes(r.template.id))]
    }
    return (count > 1 ? [false, true] : [true]).map(keepOrder => { const rowKeep = !autoRearrange || keepOrder, { fitting, missed } = shelf(rowKeep); return selectedFirst(rowKeep, varyPatterns((rankTemplates(photos, fitting, aspect, rowKeep, spread.marginPx * (target === 'spread' ? 1 : 2), spread.gapPx * (target === 'spread' ? 1 : 2)))
      .sort((a, b) => (missed.get(a.template.id)! - missed.get(b.template.id)!) || Number(/^(ref-(bleed|album|edge|signature)-|mix(seq3?)?-)/.test(b.template.id)) - Number(/^(ref-(bleed|album|edge|signature)-|mix(seq3?)?-)/.test(a.template.id)) || Number(isFullSpreadTemplate(b.template)) - Number(isFullSpreadTemplate(a.template)) || (['reference','creative'].indexOf(templateCategory(a.template))-['reference','creative'].indexOf(templateCategory(b.template))) || Number(favorites.includes(b.template.id)) - Number(favorites.includes(a.template.id))), r => r.template, aspect, photos.length === count ? wantedTemplates(photos) : undefined)) })
  }, [kind,collection,albumSize,collections,userTemplates, categories, open, spread, project.photos, project.enabledTemplateIds, count, filter, aspect, favorites, favoritesOnly, placements, target, autoRearrange])
  useEffect(() => { setActive(null); setOffsets([0, 0]); preview(null); strips.current.forEach(strip => { if (strip) strip.scrollLeft = 0 }) }, [kind,collection,albumSize, categories, userTemplates, open, spreadId, count, filter, favoritesOnly, favorites, preview, target])
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
      const labels = count > 1 ? ['Rearrange Timeline', 'Match Timeline Order'] : ['Match Timeline Order']
      let row = Math.min(active?.row ?? Math.max(0, focusedRow), rows.length - 1)
      if (folded[labels[row]]) row = labels.findIndex(label => !folded[label])
      if (row < 0) return
      const keepOrder = !autoRearrange || count <= 1 || row === 1
      // The template the spread already has is the first tile, so the arrow keys start from it and the first press moves on to the next one.
      let index = active?.index ?? (rows[row][0]?.template.id === spread?.templateId ? 0 : -1)
      if (event.key === 'Enter') {
        const template = rows[row][Math.max(0, index)]?.template
        if (template && spreadId) { apply(spreadId, template.id, keepOrder, target); close() }
        return
      }
      index += event.key === 'ArrowLeft' ? -1 : 1
      index = Math.max(0, Math.min(rows[row].length - 1, index))
      const template = rows[row][index]?.template
      if (!template) return
      slideToward(row, index); setActive({ row, index }); preview(template.id, !autoRearrange || count <= 1 || row === 1, target)
      const strip = strips.current[row], left = index * (tileWidth + 12)
      if (strip && (left < strip.scrollLeft || left + tileWidth > strip.scrollLeft + strip.clientWidth)) strip.scrollLeft = left
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, rows, active, preview, close, apply, spreadId, spread?.templateId, tileWidth, count, target, autoRearrange, folded])
  useEffect(() => {
    if (open && !spread) close()
    return () => { useProjectStore.getState().previewMatchingTemplate(null) }
  }, [open, spreadId, !!spread, close])
  if (!open || !spread) return null
  const number = project.spreads.filter(s => !s.isCover).sort((a, b) => a.order - b.order).findIndex(s => s.id === spread.id) + 1
  return <section className="matching-templates" aria-label="Matching templates" style={(count > 1 ? ['Rearrange Timeline', 'Match Timeline Order'] : ['Match Timeline Order']).some(label => folded[label]) ? { height: 'auto', maxHeight: 'none' } : undefined} onMouseLeave={() => { slideBack(); setActive(null); preview(null) }}>
    <header className="matching-templates__header">
      <span role="status">Spread {number}: {rows[0].length} matching {kind} templates found.</span>
      {!designer&&<QuoteTemplates spreadId={spread.id} buttonsOnly/>}{spread.pageSide === 'spread' && <select aria-label="Template page" value={scope} onChange={e=>setScope(e.target.value as TemplateScope)}>
        <option value="spread">Whole spread</option><option value="left">Left page only</option><option value="right">Right page only</option>
      </select>}
      <select aria-label="Template frame filter" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
        <option value="all">All Templates</option><option value="no-square">Without square frames</option><option value="only-3x2">Only 3:2 frame ratios</option>
      </select>
      <button className={`btn btn--tiny ${favoritesOnly ? 'is-active' : ''}`} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}><Icon name="heart" size={12} /> Favorites</button>
      <button className="btn btn--icon btn--tiny" onClick={close} aria-label="Close matching templates" title="Close matching templates (Escape)"><Icon name="x" size={14} /></button>
    </header>
    <div className="template-source-controls">{(['reference','creative'] as const).filter(key=>kind!=='mixed'||key==='creative').map(key=><label key={key}><input type="checkbox" checked={categories[key]} onChange={e=>setCategories({...categories,[key]:e.target.checked})}/>{key==='reference'?'Smart design':kind==='mixed'?'Mixed design':'Creative design'}</label>)}<TemplateTransfer/><select aria-label="Saved template category" value={collection} onChange={e=>setCollection(e.target.value)}><option value="">All categories</option>{['Favorites','Frequently used',...Object.keys(collections.categories)].map(c=><option key={c}>{c}</option>)}</select><select aria-label="Album size category" title="Show only the templates saved for one album size" value={albumSize} onChange={e=>setAlbumSize(e.target.value)}><option value="">All album sizes</option>{Object.keys(collections.sizes).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).map(s=><option key={s}>{s}</option>)}</select></div>
    {target !== 'spread' && <div className="matching-templates__info">Changes apply to the {target} page only. Images crossing the center line stay unchanged.</div>}
    {count === 0 && <div className="matching-templates__info">No visible, unlocked photos or frames on this page. Hidden photos, locked photos and background images stay unchanged.</div>}
    {count === 1 && <div className="matching-templates__info"><strong>Rearrange Timeline:</strong><span>A single image has no timeline order to rearrange.</span></div>}
    {(count > 1 ? ['Rearrange Timeline', 'Match Timeline Order'] : ['Match Timeline Order']).map((label, row) => <div className={`matching-templates__row ${folded[label] ? 'is-folded' : ''}`} key={label}>
      <span className="matching-templates__label">{label}:<button className="btn btn--icon btn--tiny matching-templates__eye" aria-pressed={!folded[label]} aria-label={`${folded[label] ? 'Show' : 'Hide'} ${label} templates`} title={`${folded[label] ? 'Show' : 'Hide'} the ${label} templates`} onClick={() => toggleFold(label)}><Icon name={folded[label] ? 'eyeOff' : 'eye'} size={14} /></button></span>
      {!folded[label] && <><button className="btn btn--icon" aria-label={`Previous ${label} templates`} onClick={() => strips.current[row]?.scrollBy({ left: -strips.current[row]!.clientWidth * 0.8, behavior: 'smooth' })}><Icon name="chevronLeft" size={14} /></button>
      <div className="matching-templates__strip" ref={el => { strips.current[row] = el }} aria-label={label} onPointerDown={e=>{if(e.button!==0||(e.target as Element).closest('button'))return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setMarquee({x:e.clientX,y:e.clientY,left:e.clientX,top:e.clientY,width:0,height:0});setSelection([])}} onPointerMove={e=>{if(!marquee)return;const box={...marquee,left:Math.min(marquee.x,e.clientX),top:Math.min(marquee.y,e.clientY),width:Math.abs(e.clientX-marquee.x),height:Math.abs(e.clientY-marquee.y)};setMarquee(box);setSelection(Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-template-id]')).filter(el=>{const r=el.getBoundingClientRect();return r.right>=box.left&&r.left<=box.left+box.width&&r.bottom>=box.top&&r.top<=box.top+box.height}).map(el=>el.dataset.templateId!))}} onPointerUp={()=>setMarquee(null)} onPointerCancel={()=>setMarquee(null)} onScroll={event => { const offset = Math.max(0, Math.floor(event.currentTarget.scrollLeft / (tileWidth + 12)) - 2); setOffsets(current => current[row] === offset ? current : current.map((value, i) => i === row ? offset : value)) }}>
        <div style={{ position: 'relative', flex: '0 0 auto', width: Math.max(0, rows[row].length * (tileWidth + 12) - 12), height: tileWidth / aspect + 12 }}>
        {rows[row].slice(offsets[row], offsets[row] + Math.ceil((strips.current[row]?.clientWidth ?? tileWidth * 10) / (tileWidth + 12)) + 8).map(({template, photos}, slot) => { const index = offsets[row] + slot; return <div className={`matching-template ${active?.row === row && active.index === index ? 'is-previewing' : ''} ${spread.templateId === template.id ? 'is-current' : ''} ${selection.includes(template.id)?'is-selected':''}`} key={template.id} data-template-id={template.id} onContextMenu={e=>{e.preventDefault();setMenu({x:e.clientX,y:e.clientY,id:template.id});if(!selection.includes(template.id))setSelection([template.id])}} style={{ position: 'absolute', left: index * (tileWidth + 12), width: tileWidth }}>
          <button className="matching-template__apply" title={`${template.name} — preview, click to apply`} onMouseEnter={() => { slideToward(row, index); setActive({ row, index }); preview(template.id, !autoRearrange || count <= 1 || row === 1, target) }} onMouseLeave={() => { slideBack(); setActive(current => current?.row === row && current.index === index ? null : current); preview(null) }} onFocus={() => { slideToward(row, index); setActive({ row, index }); preview(template.id, !autoRearrange || count <= 1 || row === 1, target) }} onClick={e => { if(e.shiftKey||e.ctrlKey||e.metaKey){setSelection(ids=>ids.includes(template.id)?ids.filter(id=>id!==template.id):[...ids,template.id]);return}apply(spread.id, template.id, !autoRearrange || count <= 1 || row === 1, target); close() }}>
            <TemplateThumb template={template} photos={templateFramesInReadingOrder(template).map(frame=>photos[template.placeholders.indexOf(frame)])} placements={placements} aspect={aspect} marginPx={spread.marginPx * (target === 'spread' ? 1 : 2)} gapPx={spread.gapPx * (target === 'spread' ? 1 : 2)} backgroundColor={spread.backgroundHidden ? undefined : spread.backgroundColor} />
            <span className="sr-only">{label}: {template.name}</span>
          </button>
          <button className={`matching-template__favorite ${favorites.includes(template.id) ? 'is-favorite' : ''}`} aria-label={`${favorites.includes(template.id) ? 'Unfavorite' : 'Favorite'} ${template.name}`} aria-pressed={favorites.includes(template.id)} onClick={() => toggleFavorite(template.id)}><Icon name="heart" size={14} /></button>
        </div> })}
        </div>
        {!rows[row].length && <p className="muted">No matching templates. Change the frame filter{favoritesOnly ? ' or turn off Favorites' : ''}.</p>}
      </div>
      <button className="btn btn--icon" aria-label={`Next ${label} templates`} onClick={() => strips.current[row]?.scrollBy({ left: strips.current[row]!.clientWidth * 0.8, behavior: 'smooth' })}><Icon name="chevronRight" size={14} /></button></>}
    </div>)}
    {marquee&&<div style={{position:"fixed",left:marquee.left,top:marquee.top,width:marquee.width,height:marquee.height,border:"1px solid var(--accent)",background:"rgba(100,140,220,.16)",pointerEvents:"none",zIndex:1000}}/>}
    {menu&&<ContextMenu x={menu.x} y={menu.y} onClose={()=>setMenu(null)} items={[
 {label:'Add selected to category…',onClick:async()=>{const ids=selection.length?selection:[menu.id],template=useProjectStore.getState().allTemplates().find(t=>t.id===menu.id);setMenu(null);const category=await askTemplateCategory(template);if(category)classifyTemplates(ids,category)}},
 {label:'Add selected to Favorites',onClick:()=>{for(const id of selection.length?selection:[menu.id])if(!favorites.includes(id))toggleFavorite(id)}},
 {label:'Delete selected creative templates',danger:true,disabled:!selection.some(id=>userTemplates.some(t=>t.id===id)),onClick:()=>{for(const id of selection)if(userTemplates.some(t=>t.id===id))useProjectStore.getState().deleteUserTemplate(id);setSelection([])}}]}/>}
  </section>
}
