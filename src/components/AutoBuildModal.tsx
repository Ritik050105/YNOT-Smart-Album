import { useMemo, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { groupPhotosIntoMoments, splitPhotosIntoGroups } from '@/engine/autoLayout'
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
  const allPhotos = useProjectStore((s) => s.project.photos)
  const autoLayoutOptions = useProjectStore((s) => s.autoLayoutOptions)
  const runAutoBuildFromGroups = useProjectStore((s) => s.runAutoBuildFromGroups)

  const targetPhotos = useMemo<PhotoAsset[]>(() => {
    const ids = new Set(photoIds)
    return allPhotos
      .filter((p) => ids.has(p.id))
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
  }, [allPhotos, photoIds])

  const [mode, setMode] = useState<GroupingMode>('smart')
  const [blocksOfTime, setBlocksOfTime] = useState(true)
  const [blackAndWhite, setBlackAndWhite] = useState(true)
  const [metadata, setMetadata] = useState(true)
  const [templateReuse, setTemplateReuse] = useState<TemplateReuse>('medium')
  const [rangeSize, setRangeSize] = useState(autoLayoutOptions.maxPhotosPerSpread)

  const smartGroups = useMemo(
    () =>
      groupPhotosIntoMoments(targetPhotos, {
        ...autoLayoutOptions,
        gapMinutes: blocksOfTime ? autoLayoutOptions.gapMinutes : Infinity,
      }),
    [targetPhotos, autoLayoutOptions, blocksOfTime]
  )
  const rangeGroups = useMemo(
    () => splitPhotosIntoGroups(targetPhotos, Math.max(1, Math.ceil(targetPhotos.length / Math.max(1, rangeSize)))),
    [targetPhotos, rangeSize]
  )
  const suggestedGroups = mode === 'smart' ? smartGroups : rangeGroups
  const suggestedCount = Math.max(1, suggestedGroups.length)

  const [spreadCount, setSpreadCount] = useState(suggestedCount)
  // Re-suggests the spread count whenever the grouping inputs change, unless the user already
  // dragged the slider away from the last suggestion — same "don't fight a manual choice" rule
  // the panel-reveal logic elsewhere in this app follows.
  const [touchedSlider, setTouchedSlider] = useState(false)
  const effectiveCount = touchedSlider ? spreadCount : suggestedCount

  const effectiveGroups = useMemo(
    () => (effectiveCount === suggestedGroups.length ? suggestedGroups : splitPhotosIntoGroups(targetPhotos, effectiveCount)),
    [effectiveCount, suggestedGroups, targetPhotos]
  )
  const sizes = effectiveGroups.map((g) => g.length)
  const minPerSpread = sizes.length ? Math.min(...sizes) : 0
  const maxPerSpread = sizes.length ? Math.max(...sizes) : 0

  function handleBuild() {
    runAutoBuildFromGroups(
      effectiveGroups.map((g) => g.map((p) => p.id)),
      { allowTemplateRepeats: templateReuse === 'high' }
    )
    onClose()
  }

  return (
    <Modal
      title={`Auto Build - ${targetPhotos.length} image${targetPhotos.length === 1 ? '' : 's'}`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <div className="footer-spacer" />
          <button className="btn btn--primary" disabled={targetPhotos.length === 0} onClick={handleBuild}>
            <Icon name="sparkles" size={14} />
            Auto Build
          </button>
        </>
      }
    >
      <div className="auto-build-stats">
        <div className="auto-build-stats__card">
          <div className="auto-build-stats__number">{effectiveCount}</div>
          <div className="auto-build-stats__label">Spread{effectiveCount === 1 ? '' : 's'} ({effectiveCount * 2} pages)</div>
        </div>
        <div className="auto-build-stats__card">
          <div className="auto-build-stats__number">
            {minPerSpread}
            {minPerSpread !== maxPerSpread && <span className="auto-build-stats__to"> to {maxPerSpread}</span>}
          </div>
          <div className="auto-build-stats__label">Images per spread</div>
        </div>
      </div>

      <label className="field" style={{ marginTop: 14 }}>
        Number of spreads: <strong>{effectiveCount}</strong>
        <input
          type="range"
          min={1}
          max={Math.max(1, targetPhotos.length)}
          value={effectiveCount}
          onChange={(e) => {
            setTouchedSlider(true)
            setSpreadCount(Number(e.target.value))
          }}
        />
      </label>

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
                setMode('range')
                setTouchedSlider(false)
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
          <label className="field">
            Photos per spread
            <input
              type="number"
              min={1}
              max={30}
              value={rangeSize}
              onChange={(e) => setRangeSize(Math.max(1, Number(e.target.value)))}
            />
          </label>
        )}
      </div>

      <label className="field" style={{ marginTop: 10 }}>
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
