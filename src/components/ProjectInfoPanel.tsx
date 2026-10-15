import { useMemo } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { computePlaceholderBoxes } from '@/engine/layoutMath'
import { computeCoverCrop, effectiveDpi } from '@/engine/cropFit'
import { EVENT_TYPES, WEDDING_COMMUNITIES } from '@/engine/eventCategories'
import Icon from './Icon'

const PROBE_SIZE = 900

/** Project-wide "Details & grid & info" summary: page/photo counts and a DPI compliance
 *  check across every placed photo, so quality issues surface before export instead of after. */
export default function ProjectInfoPanel() {
  const project = useProjectStore((s) => s.project)
  const updateProjectMeta = useProjectStore((s) => s.updateProjectMeta)

  const stats = useMemo(() => {
    const photosById = new Map(project.photos.map((p) => [p.id, p]))
    const stageHeight = PROBE_SIZE / (project.size.widthIn / project.size.heightIn)
    let placedCount = 0
    let emptyCount = 0
    let belowTargetCount = 0
    let worstDpi = Infinity

    for (const spread of project.spreads) {
      const boxes = computePlaceholderBoxes(spread, PROBE_SIZE, stageHeight)
      for (const box of boxes) {
        const placement = spread.placements.find((p) => p.placeholderId === box.placeholderId)
        const photo = placement?.photoId ? photosById.get(placement.photoId) : undefined
        if (!photo || !placement) {
          emptyCount++
          continue
        }
        placedCount++
        const boxWIn = (box.width / PROBE_SIZE) * project.size.widthIn
        const boxHIn = (box.height / stageHeight) * project.size.heightIn
        const crop = computeCoverCrop(photo.width, photo.height, box.width, box.height, placement.focalX, placement.focalY, placement.zoom)
        const dpi = effectiveDpi(photo.width, photo.height, crop, boxWIn, boxHIn)
        worstDpi = Math.min(worstDpi, dpi)
        if (dpi < project.size.dpi) belowTargetCount++
      }
    }

    const usedPhotoIds = new Set(
      project.spreads.flatMap((s) => s.placements.map((p) => p.photoId).filter((id): id is string => !!id))
    )
    const unusedPhotos = project.photos.filter((p) => !usedPhotoIds.has(p.id)).length

    return {
      placedCount,
      emptyCount,
      belowTargetCount,
      worstDpi: worstDpi === Infinity ? null : Math.round(worstDpi),
      unusedPhotos,
    }
  }, [project])

  const pageCount = project.spreads.reduce((sum, s) => sum + (s.pageSide === 'spread' ? 2 : 1), 0)

  const isCustomEventType = !(EVENT_TYPES as readonly string[]).includes(project.eventType)
  const isCustomCommunity = project.community !== '' && !(WEDDING_COMMUNITIES as readonly string[]).includes(project.community)

  return (
    <div className="panel project-info">
      <h3>
        <Icon name="info" size={14} />
        Project Details
      </h3>

      <div className="job-meta">
        <input
          className="job-meta__client"
          placeholder="Client / couple name"
          value={project.clientName}
          onChange={(e) => updateProjectMeta({ clientName: e.target.value })}
        />
        <div className="job-meta__row">
          <select
            value={isCustomEventType ? '__custom__' : project.eventType}
            onChange={(e) =>
              updateProjectMeta({ eventType: e.target.value === '__custom__' ? '' : e.target.value })
            }
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="__custom__">Custom…</option>
          </select>
          <select
            value={isCustomCommunity ? '__custom__' : project.community}
            onChange={(e) =>
              updateProjectMeta({ community: e.target.value === '__custom__' ? ' ' : e.target.value })
            }
          >
            <option value="">Community —</option>
            {WEDDING_COMMUNITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__custom__">Custom…</option>
          </select>
        </div>
        {isCustomEventType && (
          <input
            placeholder="Custom event type"
            value={project.eventType}
            onChange={(e) => updateProjectMeta({ eventType: e.target.value })}
          />
        )}
        {isCustomCommunity && (
          <input
            placeholder="Custom community / tradition"
            value={project.community.trim()}
            onChange={(e) => updateProjectMeta({ community: e.target.value })}
          />
        )}
      </div>

      <dl className="project-info__grid">
        <dt>Size</dt>
        <dd>
          {project.size.label} ({project.size.widthIn}&quot; × {project.size.heightIn}&quot;, {project.size.dpi} DPI target)
        </dd>
        <dt>Spreads / Pages</dt>
        <dd>
          {project.spreads.length} spread{project.spreads.length === 1 ? '' : 's'} · {pageCount} page{pageCount === 1 ? '' : 's'}
        </dd>
        <dt>Photos</dt>
        <dd>
          {project.photos.length} imported · {stats.placedCount} placed · {stats.emptyCount} empty slot
          {stats.emptyCount === 1 ? '' : 's'}
        </dd>
        {stats.unusedPhotos > 0 && (
          <>
            <dt>Unused</dt>
            <dd>{stats.unusedPhotos} imported photo{stats.unusedPhotos === 1 ? '' : 's'} not yet placed</dd>
          </>
        )}
        <dt>Print quality</dt>
        <dd className={stats.belowTargetCount > 0 ? 'project-info__warn' : 'project-info__ok'}>
          {stats.belowTargetCount === 0
            ? stats.worstDpi
              ? `All placed photos meet ${project.size.dpi} DPI`
              : 'No photos placed yet'
            : `${stats.belowTargetCount} photo${stats.belowTargetCount === 1 ? '' : 's'} below target DPI (worst: ${stats.worstDpi})`}
        </dd>
      </dl>
    </div>
  )
}
