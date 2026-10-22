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
  const allPhotos = project.photos
  const frameFilter = useProjectStore((s) => s.templateFrameFilter)
  const autoLayoutOptions = useProjectStore((s) => s.autoLayoutOptions)
  const runAutoBuildFromGroups = useProjectStore((s) => s.runAutoBuildFromGroups)

  const targetPhotos = useMemo<PhotoAsset[]>(() => {
    const ids = new Set(photoIds)
    return sortPhotosByCapturedAt(allPhotos.filter((p) => ids.has(p.id)))
  }, [allPhotos, photoIds])

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
      const counts = touchedSlider ? [requestedCount] : autoBuildSpreadCounts(targetPhotos.length, requestedCount, project.enabledTemplateIds, layout, min, max)
      let lastError: unknown
      for (const count of counts) {
        try { return { groups: groupPhotosForCount(targetPhotos, count, {
          ...autoLayoutOptions,
          gapMinutes: mode === 'smart' && blocksOfTime ? autoLayoutOptions.gapMinutes : Infinity,
          groupBlackAndWhite: mode === 'smart' && blackAndWhite,
          groupMetadata: mode === 'smart' && metadata,
        }, min, max, autoBuildGroupFilter(count, project.enabledTemplateIds, layout)), count, error: '' } }
        catch (error) {
          if (!(error instanceof Error) || !error.message.startsWith('The enabled templates cannot group')) throw error
          lastError = error
        }
      }
      throw lastError
    } catch (error) { return { groups: [], count: requestedCount, error: error instanceof Error ? error.message : String(error) } }
  }, [requestedCount, touchedSlider, targetPhotos, autoLayoutOptions, mode, blocksOfTime, blackAndWhite, metadata, rangeMin, rangeSize, project.enabledTemplateIds, project.spreads, project.layoutStart, project.layoutEnd, project.includeFullSpreadTemplates, project.size, frameFilter])
  const effectiveCount = grouping.count
  const effectiveGroups = grouping.groups
  const sizes = effectiveGroups.map((g) => g.length)
  const minPerSpread = sizes.length ? Math.min(...sizes) : 0
  const maxPerSpread = sizes.length ? Math.max(...sizes) : 0

  const preview = useMemo(() => {
    try {
      if (grouping.error) return { pages: 0, error: grouping.error }
      const spreads = buildSpreadsFromGroups(effectiveGroups, {
        backgroundColor: project.defaultBackgroundColor, gapPx: project.defaultGapPx, marginPx: project.defaultMarginPx,
        borderWidth: project.defaultBorderWidth, borderColor: project.defaultBorderColor,
      }, project.enabledTemplateIds, { start: project.spreads.some((spread) => !spread.isCover) ? 'spread' : project.layoutStart,
        end: project.layoutEnd, includeFullSpreadTemplates: project.includeFullSpreadTemplates,
        aspect: project.size.widthIn / project.size.heightIn, frameFilter }, autoLayoutOptions.matchTimelineOrder, false, templateReuse)
      return { pages: spreads.reduce((sum, spread) => sum + (spread.pageSide === 'spread' ? 2 : 1), 0), error: '' }
    } catch (error) { return { pages: 0, error: error instanceof Error ? error.message : String(error) } }
  }, [effectiveGroups, grouping.error, project, frameFilter, autoLayoutOptions.matchTimelineOrder, templateReuse])

  function handleBuild() {
    if (noGroupingCriteria) return
    try {
      runAutoBuildFromGroups(effectiveGroups.map((group) => group.map((photo) => photo.id)), { templateReuse })
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

      <label className="field auto-build-reuse">
        Template reuse
        <select value={templateReuse} onChange={(e) => setTemplateReuse(e.target.value as TemplateReuse)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
    </Modal>
  )
}
