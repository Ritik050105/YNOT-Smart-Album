import {templatesForCount} from '@/engine/templates'
import {useTemplateCollections,matchesCollection} from '@/engine/templateCollections'
import {templateCategory} from '@/engine/templateTransfer'
import { useCallback, useMemo, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { suggestAutoBuildSpreadCount, groupPhotosForCount, spreadCountRange, buildSpreadsFromGroups, autoBuildGroupFilter, autoBuildSpreadCounts, sortPhotosByCapturedAt } from '@/engine/autoLayout'
import { PhotoAsset, TemplateDefinition } from '@/types'
import Modal from './Modal'
import Icon from './Icon'

type GroupingMode = 'smart' | 'range'

/** What a bin builds from. The first three are image layouts, split by the design family they
 *  come from; 'creative-mixed' is the same creative family but the layouts that carry text. */
type BinKind = 'reference' | 'creative' | 'creative-mixed'
const BIN_KINDS: { value: BinKind; label: string }[] = [
  { value: 'reference', label: 'Smart design' },
  { value: 'creative', label: 'Creative design' },
  { value: 'creative-mixed', label: 'Creative design mixed' },
]
interface BinRule { kind: BinKind; category: string; subcategory: string; favorites: boolean }

/** Spreads avoid repeating the layout of the one before unless nothing else fits. This used to be
 *  a dropdown; it is the setting almost everyone wants, so it is no longer asked. */
const TEMPLATE_REUSE = 'medium' as const

/** The reference app's "Auto Build" dialog — shown before building new spreads from a set of
 *  photos (the dock's current selection, or every unplaced photo if fewer than 2 are selected),
 *  rather than building instantly. Appends the new spreads to the end of the album; existing
 *  spreads are untouched (see `runAutoBuildFromGroups`). */
export default function AutoBuildModal({ photoIds, onClose }: { photoIds: string[]; onClose: () => void }) {
  const project = useProjectStore((s) => s.project)
  const favorites=useProjectStore(s=>s.favoriteTemplateIds)
  const collections=useTemplateCollections()
  const allPhotos = project.photos
  const frameFilter = useProjectStore((s) => s.templateFrameFilter)
  const autoLayoutOptions = useProjectStore((s) => s.autoLayoutOptions)
  const runAutoBuildFromGroups = useProjectStore((s) => s.runAutoBuildFromGroups)

  const bins=[...new Set(allPhotos.flatMap(p=>p.bins))]
  const [binMode,setBinMode]=useState(false),[chosenBins,setChosenBins]=useState(bins),[followBins,setFollowBins]=useState(true)
  const [binRules,setBinRules]=useState<Record<string,BinRule>>({})
  // Every template the project allows, in one pass over the 1-30 photo counts. A bin narrows it
  // further by design family, by category and, with the heart, to the ones marked as favourites.
  const userTemplates=useProjectStore(s=>s.userTemplates)
  const library=useMemo(()=>Array.from({length:30},(_,i)=>templatesForCount(i+1,project.enabledTemplateIds,frameFilter,project.size.widthIn/project.size.heightIn)).flat(),[project.enabledTemplateIds,frameFilter,project.size.widthIn,project.size.heightIn,userTemplates])
  const enabledIds=useMemo(()=>library.map(t=>t.id),[library])
  const binRule=(bin:string):BinRule=>binRules[bin]??{kind:'reference',category:'',subcategory:'',favorites:false}
  const records=useCallback((rule:BinRule):TemplateDefinition[]=>{
    const family=rule.kind==='creative-mixed'?'creative':rule.kind
    const wantsText=rule.kind==='creative-mixed'
    return library.filter(t=>templateCategory(t)===family&&!!t.textBoxes?.length===wantsText&&(!rule.favorites||favorites.includes(t.id)))
  },[library,favorites])
  // A saved template carries its own category. A built-in has none, so it is filed under the
  // family it belongs to — otherwise these two dropdowns would be empty for every built-in design.
  // The categories a designer has actually filed templates under: the category a saved template
  // carries, and the collections they have sorted templates into by hand. Built-in layouts have
  // no category of their own, and labelling them by the family they came from only filled this
  // dropdown with names nobody chose.
  const categoryOf=(item:TemplateDefinition)=>(item.category??'').split(' / ')[0]
  const savedCategories=(pool:TemplateDefinition[])=>[...new Set([
    ...pool.map(categoryOf).filter(Boolean),
    ...Object.keys(collections.categories).filter(name=>pool.some(t=>matchesCollection(t.id,name,collections,favorites))),
  ])].sort()
  const subcategoryOf=(item:TemplateDefinition)=>item.subcategory??item.category?.split(' / ').slice(1).join(' / ')??''
  // A chosen category matches either way: a template saved under that name, or one filed into a
  // collection of that name.
  const inCategory=(t:TemplateDefinition,category:string)=>!category||categoryOf(t)===category||matchesCollection(t.id,category,collections,favorites)
  const matching=(bin:string)=>{const rule=binRule(bin);return records(rule).filter(t=>inCategory(t,rule.category)&&(!rule.subcategory||subcategoryOf(t)===rule.subcategory))}
  const designForBin=(bin:string)=>({templateIds:matching(bin).map(t=>t.id)})
  const targetPhotos = useMemo<PhotoAsset[]>(() => {
    const ids = new Set(photoIds)
    const photos=allPhotos.filter(p=>ids.has(p.id)&&(!binMode||p.bins.some(b=>chosenBins.includes(b))));return binMode&&followBins?photos.sort((a,b)=>Math.min(...a.bins.map(b=>chosenBins.indexOf(b)).filter(i=>i>=0))-Math.min(...b.bins.map(b=>chosenBins.indexOf(b)).filter(i=>i>=0))||a.fileName.localeCompare(b.fileName,undefined,{numeric:true})):sortPhotosByCapturedAt(photos)
  }, [allPhotos, photoIds, binMode, chosenBins, followBins])

  const [buildError, setBuildError] = useState('')
  const [mode, setMode] = useState<GroupingMode>('smart')
  const [blocksOfTime, setBlocksOfTime] = useState(true)
  // The album may open on a right-hand page and close on a left-hand one. Only the first and last
  // spread of the album can do that, so appending to an album that already has spreads cannot.
  const appending = project.spreads.some((spread) => !spread.isCover)
  const [startRight, setStartRight] = useState(project.layoutStart === 'single')
  const [endLeft, setEndLeft] = useState(project.layoutEnd === 'single')
  // Builds at exactly the chosen number of spreads instead of the nearest number that works.
  const [restrictCount, setRestrictCount] = useState(false)
  const [blackAndWhite, setBlackAndWhite] = useState(true)
  const [metadata, setMetadata] = useState(true)
  const [rangeSize, setRangeSize] = useState(Math.max(1, Math.min(30, autoLayoutOptions.maxPhotosPerSpread)))
  const [rangeMin, setRangeMin] = useState(Math.max(1, Math.min(3, autoLayoutOptions.maxPhotosPerSpread)))
  const noGroupingCriteria = mode === 'smart' && !blocksOfTime && !blackAndWhite && !metadata

  const smartCount = useMemo(
    () =>
      suggestAutoBuildSpreadCount(targetPhotos, {
        ...autoLayoutOptions,
        gapMinutes: blocksOfTime ? autoLayoutOptions.gapMinutes : Infinity,
      }),
    [targetPhotos, autoLayoutOptions, blocksOfTime]
  )
  const countRange = mode === 'range'
    ? spreadCountRange(targetPhotos.length, rangeMin, rangeSize)
    : spreadCountRange(targetPhotos.length, 1, 30)
  const suggestedCount = mode === 'smart' ? smartCount
    : Math.ceil(targetPhotos.length / ((rangeMin + rangeSize) / 2))

  const [spreadCount, setSpreadCount] = useState(suggestedCount)
  // Re-suggests the spread count whenever the grouping inputs change, unless the user already
  // dragged the slider away from the last suggestion — same "don't fight a manual choice" rule
  // the panel-reveal logic elsewhere in this app follows.
  const [touchedSlider, setTouchedSlider] = useState(false)
  const requestedCount = Math.max(countRange.min, Math.min(countRange.max, touchedSlider ? spreadCount : suggestedCount))

  const grouping = useMemo(() => {
    const layout = { start: (!appending && startRight ? 'single' : 'spread') as 'single' | 'spread',
      end: (endLeft ? 'single' : 'spread') as 'single' | 'spread', includeFullSpreadTemplates: project.includeFullSpreadTemplates,
      aspect: project.size.widthIn / project.size.heightIn, frameFilter }
    const min = mode === 'range' ? rangeMin : 1, max = mode === 'range' ? rangeSize : 30
    try {
      if(!enabledIds.length)throw new Error('Select a template design category with available templates.')
      if(binMode){
        const assigned=new Set<string>(),groups:PhotoAsset[][]=[]
        for(const bin of (followBins?[...chosenBins].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})):chosenBins)){
          const photos=targetPhotos.filter(p=>p.bins.includes(bin)&&!assigned.has(p.id));if(!photos.length)continue
          photos.forEach(p=>assigned.add(p.id))
          const design=designForBin(bin)
          if(!design.templateIds.length)throw new Error('No matching templates for bin '+bin+'. Choose another category.')
          let built:PhotoAsset[][]|undefined
          for(const count of autoBuildSpreadCounts(photos.length,touchedSlider?Math.max(1,Math.round(requestedCount*photos.length/targetPhotos.length)):Math.ceil(photos.length/Math.max(1,rangeSize)),design.templateIds,{...layout,start:'spread',end:'spread'},min,max)){
            try{built=groupPhotosForCount(photos,count,autoLayoutOptions,min,max,autoBuildGroupFilter(count,design.templateIds,{...layout,start:'spread',end:'spread'}),true);break}catch{}
          }
          if(!built)throw new Error('The chosen templates cannot fit bin '+bin+'. Change its category or image count.')
          groups.push(...built)
        }
        return {groups,count:groups.length,error:''}
      }
      const counts = touchedSlider || restrictCount ? [requestedCount] : autoBuildSpreadCounts(targetPhotos.length, requestedCount, enabledIds, layout, min, max)
      let lastError: unknown
      for (const count of counts) {
        try { return { groups: groupPhotosForCount(targetPhotos, count, {
          ...autoLayoutOptions,
          gapMinutes: mode === 'smart' && blocksOfTime ? autoLayoutOptions.gapMinutes : Infinity,
          groupBlackAndWhite: mode === 'smart' && blackAndWhite,
          groupMetadata: mode === 'smart' && metadata,
        }, min, max, autoBuildGroupFilter(count, enabledIds, layout),binMode&&followBins), count, error: '' } }
        catch (error) {
          if (!(error instanceof Error) || !error.message.startsWith('The enabled templates cannot group')) throw error
          lastError = error
        }
      }
      throw lastError
    } catch (error) { return { groups: [], count: requestedCount, error: error instanceof Error ? error.message : String(error) } }
  }, [binRules, chosenBins, enabledIds, binMode, followBins, requestedCount, touchedSlider, targetPhotos, autoLayoutOptions, mode, blocksOfTime, blackAndWhite, metadata, rangeMin, rangeSize, project.enabledTemplateIds, appending, startRight, endLeft, restrictCount, project.includeFullSpreadTemplates, project.size, frameFilter])
  const effectiveCount = grouping.count
  const effectiveGroups = grouping.groups
  const groupDesigns=binMode?effectiveGroups.map(group=>designForBin((followBins?[...chosenBins].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})):chosenBins).find(bin=>group[0]?.bins.includes(bin))??'')):undefined
  const sizes = effectiveGroups.map((g) => g.length)
  const minPerSpread = sizes.length ? Math.min(...sizes) : 0
  const maxPerSpread = sizes.length ? Math.max(...sizes) : 0

  const preview = useMemo(() => {
    try {
      if (grouping.error) return { pages: 0, error: grouping.error }
      const spreads = buildSpreadsFromGroups(effectiveGroups, {
        backgroundColor: project.defaultBackgroundColor, gapPx: project.defaultGapPx, marginPx: project.defaultMarginPx,
        borderWidth: project.defaultBorderWidth, borderColor: project.defaultBorderColor,
      }, enabledIds, { start: !appending && startRight ? 'single' : 'spread',
        end: endLeft ? 'single' : 'spread', includeFullSpreadTemplates: project.includeFullSpreadTemplates,
        aspect: project.size.widthIn / project.size.heightIn, frameFilter }, autoLayoutOptions.matchTimelineOrder, false, TEMPLATE_REUSE,groupDesigns)
      return { pages: spreads.reduce((sum, spread) => sum + (spread.pageSide === 'spread' ? 2 : 1), 0), error: '' }
    } catch (error) { return { pages: 0, error: error instanceof Error ? error.message : String(error) } }
  }, [binRules, enabledIds, effectiveGroups, grouping.error, project, frameFilter, autoLayoutOptions.matchTimelineOrder])

  function handleBuild() {
    if (noGroupingCriteria) return
    try {
      runAutoBuildFromGroups(effectiveGroups.map((group) => group.map((photo) => photo.id)), { groupDesigns,templateReuse:TEMPLATE_REUSE,enabledTemplateIds:enabledIds,layout:{start:!appending&&startRight?'single':'spread',end:endLeft?'single':'spread'},matchTimelineOrder:followBins&&binMode?true:autoLayoutOptions.matchTimelineOrder })
      onClose()
    } catch (error) { setBuildError(error instanceof Error ? error.message : String(error)) }
  }

  return (
    <Modal
      className="auto-build-modal"
      title={`Auto Build - ${targetPhotos.length} image${targetPhotos.length === 1 ? '' : 's'}`}
      onClose={onClose}
      width={735}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <div className="footer-spacer" />
          <button className="btn btn--primary" disabled={targetPhotos.length === 0 || noGroupingCriteria || !!preview.error} onClick={handleBuild}>
            <Icon name="sparkles" size={14} />
            Auto Build
          </button>
        </>
      }
    >
      {(preview.error || buildError) && <p role="alert">{preview.error || buildError}</p>}
      <div className="auto-build-stats">
        <div className="auto-build-stats__card">
          <div className="auto-build-stats__number">{effectiveCount}</div>
          <div className="auto-build-stats__label">Spread{effectiveCount === 1 ? '' : 's'} ({preview.pages} pages)</div>
        </div>
        <div className="auto-build-stats__card">
          <div className="auto-build-stats__number">
            {minPerSpread}
            {minPerSpread !== maxPerSpread && <><span className="auto-build-stats__to"> to </span>{maxPerSpread}</>}
          </div>
          <div className="auto-build-stats__label">Images per spread</div>
        </div>
      </div>

      <div className="auto-build-count">
        <label htmlFor="auto-build-count">Number of spreads:</label>
        <input type="range" aria-label="Number of spreads slider" min={countRange.min} max={countRange.max} value={effectiveCount}
          onChange={(event) => { setTouchedSlider(true); setSpreadCount(Number(event.target.value)) }} />
        <input id="auto-build-count" type="number" aria-label="Number of spreads" min={countRange.min} max={countRange.max} value={effectiveCount}
          onChange={(event) => { setTouchedSlider(true); setSpreadCount(Number(event.target.value)) }} />
      </div>

      <div className="auto-build-pages">
        <label className="checkbox-row" title={appending ? 'Only the first spread of an album can start on a right-hand page, and this build is adding to an album that already has spreads.' : 'Leave the left page of the first spread out of the design.'}>
          <input type="checkbox" checked={startRight && !appending} disabled={appending} onChange={e=>{setStartRight(e.target.checked);setTouchedSlider(false)}} />
          Start RHS
        </label>
        <label className="checkbox-row" title="Leave the right page of the last spread out of the design.">
          <input type="checkbox" checked={endLeft} onChange={e=>{setEndLeft(e.target.checked);setTouchedSlider(false)}} />
          End LHS
        </label>
        <label className="checkbox-row" title="Build exactly this many spreads instead of the nearest number the templates can fill.">
          <input type="checkbox" checked={restrictCount} onChange={e=>{setRestrictCount(e.target.checked);if(e.target.checked){setSpreadCount(effectiveCount);setTouchedSlider(true)}}} />
          Restrict spread count
        </label>
        {/* Asking for the number is the point of the option: without it the build is pinned to
            wherever the slider happened to be left. */}
        {restrictCount && <label className="auto-build-pages__count">
          to
          <input type="number" aria-label="Exact number of spreads" min={countRange.min} max={countRange.max} value={effectiveCount}
            onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)){setTouchedSlider(true);setSpreadCount(Math.max(countRange.min,Math.min(countRange.max,Math.round(n))))}}} />
          spread{effectiveCount===1?'':'s'}
        </label>}
      </div>

      <div className="field-section" style={{ marginTop: 14 }}>
        <div className="field-section__title">Image grouping</div>
        <div className="radio-row-group">
          <label className="radio-row">
            <input
              type="radio"
              checked={mode === 'smart'}
              onChange={() => {
                setMode('smart')
                setTouchedSlider(false)
              }}
            />
            Smart Grouping
          </label>
          <label className="radio-row">
            <input
              type="radio"
              checked={mode === 'range'}
              onChange={() => {
                setRangeMin(Math.max(1, minPerSpread))
                setRangeSize(Math.max(1, maxPerSpread))
                setSpreadCount(effectiveCount)
                setMode('range')
                setTouchedSlider(true)
              }}
            />
            Specify range
          </label>
        </div>

        {mode === 'smart' ? (
          <div className="checkbox-row-group">
            <label className="checkbox-row">
              <input type="checkbox" checked={blocksOfTime} onChange={(e) => setBlocksOfTime(e.target.checked)} />
              Blocks of time
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={blackAndWhite} onChange={(e) => setBlackAndWhite(e.target.checked)} />
              Black &amp; White
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={metadata} onChange={(e) => setMetadata(e.target.checked)} />
              Metadata
            </label>
          </div>
        ) : (
          <div className="auto-build-range">
            <label className="field">
              Minimum images per spread
              <input type="number" min={1} max={rangeSize} value={rangeMin}
                onChange={(e) => { setRangeMin(Math.max(1, Math.min(rangeSize, Number(e.target.value)))); setTouchedSlider(false) }} />
            </label>
            <label className="field">
              Maximum images per spread
              <input type="number" min={rangeMin} max={30} value={rangeSize}
                onChange={(e) => { setRangeSize(Math.max(rangeMin, Math.min(30, Number(e.target.value)))); setTouchedSlider(false) }} />
            </label>
          </div>
        )}
      </div>

      <section className="field-section"><h4>Bins</h4>
        <label><input type="checkbox" checked={binMode} onChange={e=>setBinMode(e.target.checked)}/> Build selected bins</label>
        {binMode&&<><label><input type="checkbox" checked={followBins} onChange={e=>setFollowBins(e.target.checked)}/> Follow numerical bin order</label>
        {bins.map(bin=>{
          const rule=binRule(bin)
          const pool=records(rule)
          const update=(patch:Partial<BinRule>)=>setBinRules({...binRules,[bin]:{...rule,...patch}})
          return <div className="auto-build-bin" key={bin}>
            <label><input type="checkbox" checked={chosenBins.includes(bin)} onChange={e=>setChosenBins(e.target.checked?bins.filter(b=>b===bin||chosenBins.includes(b)):chosenBins.filter(b=>b!==bin))}/>{bin}</label>
            {chosenBins.includes(bin)&&<div className="auto-build-bin__choices">
              <label>Template type<div className="auto-build-bin__type">
                <select value={rule.kind} onChange={e=>update({kind:e.target.value as BinKind,category:'',subcategory:''})}>{BIN_KINDS.map(k=><option key={k.value} value={k.value}>{k.label}</option>)}</select>
                <button type="button" className={`auto-build-bin__fav${rule.favorites?' is-on':''}`} aria-pressed={rule.favorites} aria-label={`Only favourite templates for bin ${bin}`} title="Build this bin from the templates you have marked as favourites" onClick={()=>update({favorites:!rule.favorites,category:'',subcategory:''})}><Icon name="heart" size={14}/></button>
              </div></label>
              <label>Category<select value={rule.category} onChange={e=>update({category:e.target.value,subcategory:''})}><option value="">All categories</option>{savedCategories(pool).map(c=><option key={c}>{c}</option>)}</select></label>
              <label>Subcategory<select value={rule.subcategory} onChange={e=>update({subcategory:e.target.value})}><option value="">All subcategories</option>{[...new Set(pool.filter(t=>inCategory(t,rule.category)).map(subcategoryOf).filter(Boolean))].sort().map(c=><option key={c}>{c}</option>)}</select></label>
              <p className="muted auto-build-bin__count">{matching(bin).length} template{matching(bin).length===1?'':'s'} match</p>
            </div>}
          </div>
        })}</>}
      </section>
    </Modal>
  )
}
