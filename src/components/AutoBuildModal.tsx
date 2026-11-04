import {useSavedQuotes} from '@/engine/savedQuotes'
import {useTemplateCollections,matchesCollection} from '@/engine/templateCollections'
import {templatesForCount} from '@/engine/templates'
import {templateCategory} from '@/engine/templateTransfer'
import { useMemo, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { suggestAutoBuildSpreadCount, groupPhotosForCount, spreadCountRange, buildSpreadsFromGroups, autoBuildGroupFilter, autoBuildSpreadCounts, sortPhotosByCapturedAt } from '@/engine/autoLayout'
import { PhotoAsset } from '@/types'
import Modal from './Modal'
import Icon from './Icon'

type GroupingMode = 'smart' | 'range'
type TemplateReuse = 'low' | 'medium' | 'high'

/** The reference app's "Auto Build" dialog — shown before building new spreads from a set of
 *  photos (the dock's current selection, or every unplaced photo if fewer than 2 are selected),
 *  rather than building instantly. Appends the new spreads to the end of the album; existing
 *  spreads are untouched (see `runAutoBuildFromGroups`). */
export default function AutoBuildModal({ photoIds, onClose }: { photoIds: string[]; onClose: () => void }) {
  const project = useProjectStore((s) => s.project)
  const collections=useTemplateCollections(),[collection,setCollection]=useState(''),favorites=useProjectStore(s=>s.favoriteTemplateIds)
  const allPhotos = project.photos
  const frameFilter = useProjectStore((s) => s.templateFrameFilter)
  const autoLayoutOptions = useProjectStore((s) => s.autoLayoutOptions)
  const runAutoBuildFromGroups = useProjectStore((s) => s.runAutoBuildFromGroups)

  const bins=[...new Set(allPhotos.flatMap(p=>p.bins))]
  const [binMode,setBinMode]=useState(false),[chosenBins,setChosenBins]=useState(bins),[followBins,setFollowBins]=useState(true)
  const quotes=useSavedQuotes()
  const [binRules,setBinRules]=useState<Record<string,{kind:string;category:string;subcategory:string}>>({})
  const [designs,setDesigns]=useState({reference:true,creative:true,generated:false})
  // The "Template designs" checkboxes (reference/creative/generated) narrow the FULL library when
  // browsing it — but when the project wizard already restricted the library to a specific set of
  // template ids, that's an explicit per-project choice regardless of which generation family those
  // templates came from, so it shouldn't get silently re-filtered down to nothing by these checkboxes.
  const enabledIds=useMemo(()=>Array.from({length:30},(_,i)=>templatesForCount(i+1,project.enabledTemplateIds,frameFilter,project.size.widthIn/project.size.heightIn)).flat().filter(t=>(!!project.enabledTemplateIds||designs[templateCategory(t)])&&matchesCollection(t.id,collection,collections,favorites)).map(t=>t.id),[designs,project.enabledTemplateIds,frameFilter,project.size,collection,collections,favorites])
  const library=Array.from({length:30},(_,i)=>templatesForCount(i+1,project.enabledTemplateIds,frameFilter,project.size.widthIn/project.size.heightIn)).flat()
  const binRule=(bin:string)=>binRules[bin]??{kind:'image',category:'',subcategory:''}
  const records=(kind:string)=>kind==='font'?quotes:library.filter(t=>kind==='mixed'?!!t.textBoxes?.length:!t.textBoxes?.length)
  const categoryOf=(item:{category?:string})=>(item.category??'').split(' / ')[0]
  const subcategoryOf=(item:{category?:string;subcategory?:string})=>item.subcategory??item.category?.split(' / ').slice(1).join(' / ')??''
  const matching=(bin:string)=>{const rule=binRule(bin);return records(rule.kind).filter(t=>(!rule.category||categoryOf(t)===rule.category)&&(!rule.subcategory||subcategoryOf(t)===rule.subcategory))}
  const designForBin=(bin:string)=>{const rule=binRule(bin),matches=matching(bin);return {templateIds:rule.kind==='font'?enabledIds.filter(id=>library.some(t=>t.id===id&&!t.textBoxes?.length)):matches.filter(t=>enabledIds.includes(t.id)).map(t=>t.id),textBoxes:rule.kind==='font'?quotes.find(q=>q.id===matches[0]?.id)?.boxes:undefined}}
  const targetPhotos = useMemo<PhotoAsset[]>(() => {
    const ids = new Set(photoIds)
    const photos=allPhotos.filter(p=>ids.has(p.id)&&(!binMode||p.bins.some(b=>chosenBins.includes(b))));return binMode&&followBins?photos.sort((a,b)=>Math.min(...a.bins.map(b=>chosenBins.indexOf(b)).filter(i=>i>=0))-Math.min(...b.bins.map(b=>chosenBins.indexOf(b)).filter(i=>i>=0))||a.fileName.localeCompare(b.fileName,undefined,{numeric:true})):sortPhotosByCapturedAt(photos)
  }, [allPhotos, photoIds, binMode, chosenBins, followBins])

  const [buildError, setBuildError] = useState('')
  const [mode, setMode] = useState<GroupingMode>('smart')
  const [blocksOfTime, setBlocksOfTime] = useState(true)
  const [blackAndWhite, setBlackAndWhite] = useState(true)
  const [metadata, setMetadata] = useState(true)
  const [templateReuse, setTemplateReuse] = useState<TemplateReuse>('medium')
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
    const layout = { start: project.spreads.some((spread) => !spread.isCover) ? 'spread' as const : project.layoutStart,
      end: project.layoutEnd, includeFullSpreadTemplates: project.includeFullSpreadTemplates,
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
          if(!design.templateIds.length||(binRule(bin).kind==='font'&&!design.textBoxes?.length))throw new Error('No matching templates for bin '+bin+'. Choose another category.')
          let built:PhotoAsset[][]|undefined
          for(const count of autoBuildSpreadCounts(photos.length,touchedSlider?Math.max(1,Math.round(requestedCount*photos.length/targetPhotos.length)):Math.ceil(photos.length/Math.max(1,rangeSize)),design.templateIds,{...layout,start:'spread',end:'spread'},min,max)){
            try{built=groupPhotosForCount(photos,count,autoLayoutOptions,min,max,autoBuildGroupFilter(count,design.templateIds,{...layout,start:'spread',end:'spread'}),true);break}catch{}
          }
          if(!built)throw new Error('The chosen templates cannot fit bin '+bin+'. Change its category or image count.')
          groups.push(...built)
        }
        return {groups,count:groups.length,error:''}
      }
      const counts = touchedSlider ? [requestedCount] : autoBuildSpreadCounts(targetPhotos.length, requestedCount, enabledIds, layout, min, max)
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
  }, [binRules, quotes, chosenBins, enabledIds, binMode, followBins, requestedCount, touchedSlider, targetPhotos, autoLayoutOptions, mode, blocksOfTime, blackAndWhite, metadata, rangeMin, rangeSize, project.enabledTemplateIds, project.spreads, project.layoutStart, project.layoutEnd, project.includeFullSpreadTemplates, project.size, frameFilter])
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
      }, enabledIds, { start: project.spreads.some((spread) => !spread.isCover) ? 'spread' : project.layoutStart,
        end: project.layoutEnd, includeFullSpreadTemplates: project.includeFullSpreadTemplates,
        aspect: project.size.widthIn / project.size.heightIn, frameFilter }, autoLayoutOptions.matchTimelineOrder, false, templateReuse,groupDesigns)
      return { pages: spreads.reduce((sum, spread) => sum + (spread.pageSide === 'spread' ? 2 : 1), 0), error: '' }
    } catch (error) { return { pages: 0, error: error instanceof Error ? error.message : String(error) } }
  }, [binRules, quotes, enabledIds, effectiveGroups, grouping.error, project, frameFilter, autoLayoutOptions.matchTimelineOrder, templateReuse])

  function handleBuild() {
    if (noGroupingCriteria) return
    try {
      runAutoBuildFromGroups(effectiveGroups.map((group) => group.map((photo) => photo.id)), { groupDesigns,templateReuse,enabledTemplateIds:enabledIds,matchTimelineOrder:followBins&&binMode?true:autoLayoutOptions.matchTimelineOrder })
      onClose()
    } catch (error) { setBuildError(error instanceof Error ? error.message : String(error)) }
  }

  return (
    <Modal
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

      <section className="field-section"><h4>Bins</h4><label><input type="checkbox" checked={binMode} onChange={e=>setBinMode(e.target.checked)}/> Build selected bins</label>{binMode&&<><label><input type="checkbox" checked={followBins} onChange={e=>setFollowBins(e.target.checked)}/> Follow numerical bin order</label>{bins.map(bin=><div className="auto-build-bin" key={bin}><label><input type="checkbox" checked={chosenBins.includes(bin)} onChange={e=>setChosenBins(e.target.checked?bins.filter(b=>b===bin||chosenBins.includes(b)):chosenBins.filter(b=>b!==bin))}/>{bin}</label>{chosenBins.includes(bin)&&<div className="auto-build-bin__choices"><label>Template type<select value={binRule(bin).kind} onChange={e=>setBinRules({...binRules,[bin]:{kind:e.target.value,category:'',subcategory:''}})}><option value="image">Image templates</option><option value="font">Font templates with image layout</option><option value="mixed">Mixed templates</option></select></label><label>Category<select value={binRule(bin).category} onChange={e=>setBinRules({...binRules,[bin]:{...binRule(bin),category:e.target.value,subcategory:''}})}><option value="">All categories</option>{[...new Set(records(binRule(bin).kind).map(categoryOf).filter(Boolean))].map(c=><option key={c}>{c}</option>)}</select></label><label>Subcategory<select value={binRule(bin).subcategory} onChange={e=>setBinRules({...binRules,[bin]:{...binRule(bin),subcategory:e.target.value}})}><option value="">All subcategories</option>{[...new Set(records(binRule(bin).kind).filter(t=>!binRule(bin).category||categoryOf(t)===binRule(bin).category).map(subcategoryOf).filter(Boolean))].map(c=><option key={c}>{c}</option>)}</select></label></div>}</div>)}</>}</section>
      <section className="field-section"><h4>Template designs</h4>{(['reference','creative','generated'] as const).map(key=><label key={key}><input type="checkbox" checked={designs[key]} onChange={e=>setDesigns({...designs,[key]:e.target.checked})}/>{{reference:'Smart design',creative:'Creative design',generated:'Random generation'}[key]}</label>)}
      <label>Template category<select value={collection} onChange={e=>setCollection(e.target.value)}><option value="">All categories</option>{['Favorites','Frequently used',...Object.keys(collections.categories)].map(c=><option key={c}>{c}</option>)}</select></label>
      <label className="field auto-build-reuse">
        Template reuse
        <select value={templateReuse} onChange={(e) => setTemplateReuse(e.target.value as TemplateReuse)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label></section>
    </Modal>
  )
}
