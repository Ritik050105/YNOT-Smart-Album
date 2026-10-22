import { useMemo, useState, ReactNode } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { inToDisplay } from '@/engine/units'
import Icon from './Icon'
import ProjectInfoPanel from './ProjectInfoPanel'

function Collapsible({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="collapsible">
      <button className="collapsible__header" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{title}</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={12} />
      </button>
      {open && <div className="collapsible__body">{children}</div>}
    </div>
  )
}

/** Docked right-sidebar summary, matching the reference app's always-visible "Album Info / Album
 *  Preferences / Spread Grid" panel — as opposed to this app's own deeper "Project Details"
 *  modal (client/job metadata + DPI quality check), which stays reachable from here via the info
 *  button rather than being duplicated. */
export default function AlbumInfoPanel() {
  const project = useProjectStore((s) => s.project)
  const updateProjectSettings = useProjectStore((s) => s.updateProjectSettings)
  const selectedSpreadId = useProjectStore(s => s.selectedSpreadId)
  const updateSpread = useProjectStore(s => s.updateSpread)
  const selectedSpread = project.spreads.find(s => s.id === selectedSpreadId)
  const [infoOpen, setInfoOpen] = useState(false)

  const stats = useMemo(() => {
    const interiorSpreads = project.spreads.filter((s) => !s.isCover)
    const pageCount = interiorSpreads.reduce((sum, s) => sum + (s.pageSide === 'spread' ? 2 : 1), 0)
    const uniqueTemplates = new Set(project.spreads.map((s) => s.templateId)).size
    const orientationCounts = { landscape: 0, portrait: 0, square: 0 }
    for (const photo of project.photos) orientationCounts[photo.orientation]++
    const toneAdjustedCount = project.spreads.reduce(
      (sum, s) =>
        sum +
        s.placements.filter(
          (p) =>
            p.photoId &&
            (p.warmth !== 0 || p.brightness !== 0 || p.contrast !== 0 || p.saturation !== 0 || p.relightIntensity !== 0)
        ).length,
      0
    )
    return { interiorSpreads, pageCount, uniqueTemplates, orientationCounts, toneAdjustedCount }
  }, [project.spreads, project.photos])

  return (
    <div className="panel album-info-panel">
      <div className="album-info-panel__header">
        <div>
          <strong>YNOT Photography</strong>
          <span className="muted">
            {inToDisplay(project.size.widthIn, project.units, project.size.dpi)}
            {project.units} × {inToDisplay(project.size.heightIn, project.units, project.size.dpi)}
            {project.units}
          </span>
        </div>
        <button className="btn btn--icon" title="Project Details" onClick={() => setInfoOpen(true)}>
          <Icon name="info" size={14} />
        </button>
      </div>

      {selectedSpread?.backgroundPattern?.mode === 'cover' && <Collapsible title="Fixed background">
        <p>{selectedSpread.backgroundPattern.name}</p>
        <button className="btn btn--tiny" onClick={() => updateSpread(selectedSpread.id, { backgroundPattern: undefined })}>Remove background</button>
      </Collapsible>}
      <Collapsible title="Album Info" defaultOpen={false}>
        <p className="muted">
          {stats.interiorSpreads.length} spread{stats.interiorSpreads.length === 1 ? '' : 's'} ({stats.pageCount} page
          {stats.pageCount === 1 ? '' : 's'}): {stats.uniqueTemplates} unique template{stats.uniqueTemplates === 1 ? '' : 's'}
        </p>
        <p className="muted">
          {project.photos.length} image{project.photos.length === 1 ? '' : 's'}: {stats.orientationCounts.landscape} horizontal,{' '}
          {stats.orientationCounts.portrait} vertical, {stats.orientationCounts.square} square
        </p>
        <p className="muted">
          {stats.toneAdjustedCount} image{stats.toneAdjustedCount === 1 ? '' : 's'} with tone adjustments
        </p>
      </Collapsible>

      <Collapsible title="Album Preferences">
        <label className="field">
          Color Profile
          <select value={project.colorProfile} onChange={(e) => updateProjectSettings({ colorProfile: e.target.value })}>
            <option value="sRGB">sRGB</option>
            <option value="Adobe RGB">Adobe RGB</option>
            <option value="ProPhoto RGB">ProPhoto RGB</option>
          </select>
        </label>
        <label className="field">
          Project Units
          <select
            value={project.units}
            onChange={(e) => updateProjectSettings({ units: e.target.value as typeof project.units })}
          >
            <option value="in">Inches</option>
            <option value="cm">Centimeters</option>
            <option value="px">Pixels</option>
          </select>
        </label>
      </Collapsible>

      <Collapsible title="Spread Grid">
        <p className="muted">
          {stats.interiorSpreads.length} spread{stats.interiorSpreads.length === 1 ? '' : 's'} ({stats.pageCount} page
          {stats.pageCount === 1 ? '' : 's'})
          {project.spreads.some((s) => s.isCover) && ' · cover'}
        </p>
      </Collapsible>

      {infoOpen && <ProjectInfoPanel onClose={() => setInfoOpen(false)} />}
    </div>
  )
}
