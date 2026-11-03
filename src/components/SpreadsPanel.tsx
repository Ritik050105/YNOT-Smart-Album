import SelectionActions from './SelectionActions'
import {cyclingTemplates,useTemplateBrowsing} from '@/state/templateBrowsing'
import FloatingTextToolbar from './FloatingTextToolbar'
import { createPortal } from 'react-dom'
import {PreviewImage} from '@/engine/previewImage'
import PanelResizer from './PanelResizer'
import { usePreferences, getPreferences } from '@/state/preferences'
import { openInEditor } from './ExternalEditor'
import { IMAGE_FILE_ACCEPT } from '@/engine/imageSource'
import { CSSProperties, Fragment, useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { useImportPhotos } from '@/engine/useImportPhotos'
import { exportSingleSpreadToPdf } from '@/engine/exportAlbum'
import { readDraggedPhotoIds, readTimelineFrame, overviewPhotoAt } from '@/engine/photoDrag'
import { isFontTemplateDrag, dropFontTemplate } from '@/engine/fontTemplateDrag'
import { readDraggedPattern } from '@/engine/patterns'
import { useTimelineDrag } from '@/engine/useTimelineDrag'
import SpreadThumbnail from './SpreadThumbnail'
import ContextMenu, { ContextMenuItem } from './ContextMenu'
import Icon from './Icon'
import QuoteTemplates from './QuoteTemplates'
import PhotoContextMenu from './PhotoContextMenu'
import { computePlaceholderBoxes } from '@/engine/layoutMath'

/** The album's main view — the reference app's own "all spreads" screen: a row of real,
 *  proportioned spread cards (not a zoomed single-spread canvas, no ruler or tool rail here),
 *  cover pinned first, a "drop images to create a new spread" card trailing. A single click
 *  selects a spread; double-click opens it in the focused Designer View to actually work on it —
 *  Escape (or its own back button) returns here. Reorder by drag. */
export default function SpreadsPanel() {
  const showCoverButton=usePreferences(s=>s.values.showCover)
  const canvasTool = useProjectStore(s=>s.canvasTool)
  const pan = useRef<{x:number;y:number;left:number;top:number}|null>(null)
  const [photoMenu, setPhotoMenu] = useState<{ x: number; y: number; spreadId: string; frameId?: string; openedAt: number } | null>(null)
  const project = useProjectStore((s) => s.project)
  const selectedPlaceholderId = useProjectStore(s => s.selectedPlaceholderId)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectSpread = useProjectStore((s) => s.selectSpread)
  const reorderSpreads = useProjectStore((s) => s.reorderSpreads)
  const splitSpread = useProjectStore((s) => s.splitSpread)
  const moveTimelinePhoto = useProjectStore((s) => s.moveTimelinePhoto)
  const insertTimelinePhotos = useProjectStore((s) => s.insertTimelinePhotos)
  const updateSpread = useProjectStore((s) => s.updateSpread)
  const mergeWithNext = useProjectStore((s) => s.mergeWithNext)
  const flipSpread = useProjectStore((s) => s.flipSpread)
  const addCoverSpread = useProjectStore((s) => s.addCoverSpread)
  const duplicateSpread = useProjectStore((s) => s.duplicateSpread)
  const deleteSpread = useProjectStore((s) => s.deleteSpread)
  const enterDesignerView = useProjectStore((s) => s.enterDesignerView)
  const spreadClipboard = useProjectStore((s) => s.spreadClipboard)
  const copySpread = useProjectStore((s) => s.copySpread)
  const cutSpread = useProjectStore((s) => s.cutSpread)
  const pasteSpreadAfter = useProjectStore((s) => s.pasteSpreadAfter)
  const convertSpreadPageType = useProjectStore((s) => s.convertSpreadPageType)
  const applyTemplateToAllSpreads = useProjectStore((s) => s.applyTemplateToAllSpreads)
  useTemplateBrowsing()
  const cycleSpreadTemplate = useProjectStore((s) => s.cycleSpreadTemplate)
  const openMatchingTemplates = useProjectStore(s => s.openMatchingTemplates)
  const templatePreview = useProjectStore(s => s.templatePreview)
  const { handleFiles } = useImportPhotos()
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; spreadId: string } | null>(null)
  const [coverDragOver, setCoverDragOver] = useState(false)
  const [newSpreadDragOver, setNewSpreadDragOver] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const newSpreadInputRef = useRef<HTMLInputElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const spreadsRef = useRef<HTMLDivElement>(null)
  useEffect(()=>{
    const track=spreadsRef.current,first=track?.querySelector<HTMLElement>('[data-overview-spread]');if(!track||!first)return
    const measure=()=>{const left=first.getBoundingClientRect().left-track.getBoundingClientRect().left+track.scrollLeft;timelineRef.current?.style.setProperty('--timeline-start',`${Math.max(24,left)}px`)}
    const observer=new ResizeObserver(measure);observer.observe(track);observer.observe(first);measure();return()=>observer.disconnect()
  },[project.spreads.length])
  useEffect(() => {
    const row = spreadsRef.current
    if (!row) return
    const measure = () => {
      const css = getComputedStyle(row)
      const available = row.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom) - 4
      const ratio = project.size.widthIn / project.size.heightIn
      const height = Math.max(32, Math.min(available, (row.clientWidth - 32) / Math.max(1, ratio)))
      row.parentElement?.style.setProperty('--overview-height', `${height}px`)
    }
    let frame = 0
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) })
    observer.observe(row)
    measure()
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [project.size.widthIn, project.size.heightIn])
  const { drag, target } = useTimelineDrag((source, destination) => {
    if (destination.bin) { if (source.photoIds.length) useProjectStore.getState().addPhotosToBin(source.photoIds, destination.bin); return }
    if(destination.replace && destination.spreadId && destination.beforeFrameId && source.photoIds[0]){if(source.spreadId===destination.spreadId&&source.frameId)useProjectStore.getState().swapPlacements(source.spreadId,source.frameId,destination.beforeFrameId);else useProjectStore.getState().setPlacementPhoto(destination.spreadId,destination.beforeFrameId,source.photoIds[0]);return}
    if (source.spreadId && !source.frameId) {
      if (destination.cover) return
      const interiors = useProjectStore.getState().project.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order)
      reorderSpreads(interiors.findIndex((s) => s.id === source.spreadId), destination.spreadId === null ? interiors.length - 1 : interiors.findIndex((s) => s.id === destination.spreadId))
    }
    else if (destination.cover) placeCoverPhotos(source.photoIds)
    else if (source.spreadId && source.frameId) moveTimelinePhoto(source.spreadId, source.frameId, destination.spreadId, destination.beforeFrameId)
    else insertTimelinePhotos(source.photoIds, destination.spreadId, destination.beforeFrameId)
  })

  const photosById = new Map(project.photos.map((p) => [p.id, p]))
  const cover = project.spreads.find((s) => s.isCover)
  const spreads = project.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order).map(s => templatePreview?.id === s.id ? templatePreview : s)
  useEffect(() => {
    const group = Array.from(timelineRef.current?.children ?? []).find((el) => (el as HTMLElement).dataset.timelineSpread === selectedSpreadId)
    group?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const card = Array.from(spreadsRef.current?.children ?? []).find((el) => (el as HTMLElement).dataset.overviewSpread === selectedSpreadId)
    card?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selectedSpreadId])

  // With no cover yet there was nothing to select, so the button looked dead: open cover setup instead.
  function goToCover() {
    if (cover) selectSpread(cover.id)
    else window.dispatchEvent(new CustomEvent('album-studio:setup-cover'))
    for (const el of [spreadsRef.current, timelineRef.current]) el?.scrollTo({ left: 0, behavior: 'smooth' })
  }

  async function exportSpread(spread: typeof project.spreads[number]) {
    setExportingId(spread.id)
    try {
      await exportSingleSpreadToPdf(project, spread)
    } finally {
      setExportingId(null)
    }
  }

  async function handleCoverDrop(files: FileList | File[]) {
    const matched = await handleFiles(files)
    placeCoverPhotos(matched.map((p) => p.id))
  }

  function placeCoverPhotos(newIds: string[]) {
    if (newIds.length === 0) return
    window.dispatchEvent(new CustomEvent('album-studio:setup-cover', { detail: { photoIds: newIds } }))
  }

  /** Drop on any "new spread" target (overview card, empty timeline bar, end of the timeline). */
  function dropOnNewSpread(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setNewSpreadDragOver(false)
    const frame = readTimelineFrame(e.dataTransfer)
    const ids = readDraggedPhotoIds(e.dataTransfer, project.photos.map((p) => p.id))
    if (frame) moveTimelinePhoto(frame.spreadId, frame.frameId, null)
    else if (ids.length) insertTimelinePhotos(ids, null)
    else void handleNewSpreadDrop(e.dataTransfer.files)
  }
  async function handleNewSpreadDrop(files: FileList | File[]) {
    const matched = await handleFiles(files)
    insertTimelinePhotos(matched.map((p) => p.id), null)
  }

  async function handleTimelineFiles(files: FileList, spreadId: string, beforeFrameId?: string) {
    const matched = await handleFiles(files)
    insertTimelinePhotos(matched.map((p) => p.id), spreadId, beforeFrameId)
  }

  function handleSpreadDrop(e: React.DragEvent, spreadId: string, beforeFrameId?: string) {
    e.preventDefault()
    e.stopPropagation()
    if (isFontTemplateDrag(e.dataTransfer)) {
      const card = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-spread-drag]') ?? (e.currentTarget as HTMLElement), r = card.getBoundingClientRect()
      dropFontTemplate(spreadId, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height)
      selectSpread(spreadId)
      return
    }
    const pattern = readDraggedPattern(e.dataTransfer)
    if (pattern) { updateSpread(spreadId, { backgroundPattern: pattern }); return }
    const frame = readTimelineFrame(e.dataTransfer)
    const photoIds = readDraggedPhotoIds(e.dataTransfer, project.photos.map((p) => p.id))
    if(e.altKey && getPreferences().altDrop==='replace' && beforeFrameId && photoIds[0])useProjectStore.getState().setPlacementPhoto(spreadId,beforeFrameId,photoIds[0])
    else if (frame) moveTimelinePhoto(frame.spreadId, frame.frameId, spreadId, beforeFrameId)
    else if (photoIds.length) insertTimelinePhotos(photoIds, spreadId, beforeFrameId)
    else if (e.dataTransfer.files.length) void handleTimelineFiles(e.dataTransfer.files, spreadId, beforeFrameId)
  }

  function openContextMenu(e: React.MouseEvent, spreadId: string) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, spreadId })
  }

  function contextMenuItems(spreadId: string): ContextMenuItem[] {
    const spread = project.spreads.find((s) => s.id === spreadId)
    if (!spread) return []
    if (spread.isCover) {
      return [
        { label: 'Edit in Designer View', onClick: () => enterDesignerView(spreadId) },
        { label: 'Flip Cover Horizontally', onClick: () => flipSpread(spreadId) },
        ...(['photoshop','canva'] as const).map(app=>({label:app==='photoshop'?'Open in Adobe Photoshop':'Open in Canva',onClick:()=>openInEditor({app,spreadId})})),
        { label: 'Export Cover…', onClick: () => void exportSpread(spread) },
        { label: 'Delete Cover', danger: true, onClick: () => deleteSpread(spreadId) },
      ]
    }
    const index = spreads.findIndex((s) => s.id === spreadId)
    return [
      { label: 'Cut', onClick: () => cutSpread(spreadId) },
      { label: 'Copy', onClick: () => copySpread(spreadId) },
      { label: 'Paste', disabled: !spreadClipboard, onClick: () => pasteSpreadAfter(spreadId) },
      { label: 'Delete Spread', danger: true, onClick: () => deleteSpread(spreadId) },
      {
        label: spread.pageSide === 'spread' ? 'Convert to Single Page/Side' : 'Convert to Full Spread',
        onClick: () => convertSpreadPageType(spreadId),
      },
      { label: 'Flip Spread Horizontally', onClick: () => flipSpread(spreadId) },
      {
        label: 'Apply Template to All Spreads',
        onClick: () => applyTemplateToAllSpreads(spread.templateId),
      },
      { label: 'Edit in Designer View', onClick: () => enterDesignerView(spreadId) },
      ...(['photoshop','canva'] as const).map(app=>({label:app==='photoshop'?'Open in Adobe Photoshop':'Open in Canva',onClick:()=>openInEditor({app,spreadId})})),
      { label: 'Export Spread…', onClick: () => void exportSpread(spread) },
      {
        label: 'Split Spread',
        disabled: spread.pageSide !== 'spread',
        onClick: () => splitSpread(spreadId),
      },
      {
        label: 'Merge With Next',
        disabled: index === -1 || index === spreads.length - 1,
        onClick: () => mergeWithNext(spreadId),
      },
      { label: 'Duplicate Spread', onClick: () => duplicateSpread(spreadId) },
    ]
  }

  return (
    <div className={`spreads-panel ${project.spreads.length === 0 ? 'spreads-panel--empty' : ''}`} style={{ '--spread-aspect': project.size.widthIn / project.size.heightIn } as CSSProperties}>
      <FloatingTextToolbar/><SelectionActions floating/>
      {showCoverButton && <button className="go-cover-button btn btn--tiny" onClick={goToCover}>Go to Cover</button>}
      <div id="overview-font-template-browser" />
      <div ref={spreadsRef} className="spreads-panel__row" style={{cursor:canvasTool==='pan'?'grab':undefined}}
        onPointerDownCapture={e=>{if(canvasTool!=='pan'||e.button!==0||(e.target as HTMLElement).closest('button'))return;e.preventDefault();e.stopPropagation();pan.current={x:e.clientX,y:e.clientY,left:e.currentTarget.scrollLeft,top:e.currentTarget.scrollTop};e.currentTarget.setPointerCapture(e.pointerId)}}
        onPointerMove={e=>{if(!pan.current)return;e.currentTarget.scrollLeft=pan.current.left+pan.current.x-e.clientX;e.currentTarget.scrollTop=pan.current.top+pan.current.y-e.clientY}}
        onPointerUp={e=>{if(pan.current){pan.current=null;e.currentTarget.releasePointerCapture(e.pointerId)}}}
        onPointerCancel={()=>{pan.current=null}}
        onClick={e=>{if(e.target===e.currentTarget)selectSpread(null)}} onClickCapture={e=>{if(canvasTool==='pan'&&!(e.target as HTMLElement).closest('button')){e.preventDefault();e.stopPropagation()}}}>
        {cover ? (
          <div
            className={`spreads-panel__card spreads-panel__card--cover ${selectedSpreadId === cover.id ? 'is-selected' : ''}`}
            data-overview-spread={cover.id}
            style={{ aspectRatio: (cover.size ?? project.size).widthIn / (cover.size ?? project.size).heightIn }}
            onClick={e => {
              const r = e.currentTarget.getBoundingClientRect()
              const box = computePlaceholderBoxes(cover, r.width, r.height).reverse().find(b => e.clientX-r.left >= b.x && e.clientX-r.left <= b.x+b.width && e.clientY-r.top >= b.y && e.clientY-r.top <= b.y+b.height)
              selectSpread(cover.id)
              if (box) useProjectStore.getState().selectPlaceholder(box.placeholderId)
            }}
            onDoubleClick={() => enterDesignerView(cover.id)}
            onContextMenu={(e) => openContextMenu(e, cover.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { const pattern = readDraggedPattern(e.dataTransfer); if (pattern) { e.preventDefault(); e.stopPropagation(); updateSpread(cover.id, { backgroundPattern: pattern }) } }}
            title="Front / Spine / Back — double-click to design, right-click for more options"
          >
            <SpreadThumbnail selectedPlaceholderId={selectedSpreadId === cover.id ? selectedPlaceholderId : null} spread={cover} photosById={photosById} size={project.size} responsive />
            {exportingId === cover.id && (
              <div className="spreads-panel__exporting">
                <Icon name="download" size={14} />
                Exporting…
              </div>
            )}
          </div>
        ) : spreads.length > 0 ? (
          <div
            className={`spreads-panel__card spreads-panel__card--cover spreads-panel__card--drop ${coverDragOver || target?.cover ? 'is-drag-over' : ''}`}
            data-cover-drop
            style={{ aspectRatio: 1 }}
            onDoubleClick={() => window.dispatchEvent(new CustomEvent('album-studio:setup-cover'))}
            onDragOver={(e) => {
              e.preventDefault()
              setCoverDragOver(true)
            }}
            onDragLeave={() => setCoverDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setCoverDragOver(false)
              const ids = readDraggedPhotoIds(e.dataTransfer, project.photos.map((p) => p.id))
              if (ids.length) placeCoverPhotos(ids)
              else void handleCoverDrop(e.dataTransfer.files)
            }}
          >
            <input
              ref={coverInputRef}
              type="file"
              accept={IMAGE_FILE_ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                void handleCoverDrop(e.target.files ?? [])
                e.target.value = ''
              }}
            />
            <p>Drop images here to create a cover</p>
          </div>
        ) : null}

        {(cover || spreads.length > 0) && <div className="spreads-panel__cover-divider" role="separator" aria-orientation="vertical" aria-label="Cover and album spreads" />}
        {spreads.map((spread, index) => (
          <div
            key={spread.id}
            className={`spreads-panel__column ${selectedSpreadId === spread.id ? 'is-selected' : ''} ${target?.spreadId === spread.id ? 'is-drop-target' : ''}`}
            data-timeline-spread={spread.id}
            data-overview-spread={spread.id}
            style={{ '--spread-aspect': (spread.size ?? project.size).widthIn / (spread.size ?? project.size).heightIn } as CSSProperties}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleSpreadDrop(e, spread.id)}
            onClick={e => selectSpread(e.target===e.currentTarget?null:spread.id)}
            onDoubleClick={() => enterDesignerView(spread.id)}
            onContextMenu={(e) => openContextMenu(e, spread.id)}
            title={`Spread ${index + 1} — double-click to design, right-click for more options`}
          >
            <div data-spread-drag className={`spreads-panel__card ${selectedSpreadId === spread.id ? 'is-selected' : ''}`} style={{ aspectRatio: (spread.size ?? project.size).widthIn / (spread.size ?? project.size).heightIn }} onClick={e => {
              e.stopPropagation()
              const r = e.currentTarget.getBoundingClientRect()
              const box = overviewPhotoAt(spread,e.clientX-r.left,e.clientY-r.top,r.width,r.height)
              selectSpread(spread.id)
              if (box) useProjectStore.getState().selectPlaceholder(box.placeholderId)
            }} onContextMenu={e => {
              const r = e.currentTarget.getBoundingClientRect()
              const box = overviewPhotoAt(spread,e.clientX-r.left,e.clientY-r.top,r.width,r.height)
              if (!box && !spread.backgroundPattern) return
              e.preventDefault(); e.stopPropagation(); selectSpread(spread.id)
              setPhotoMenu({ openedAt: Date.now(), x: e.clientX, y: e.clientY, spreadId: spread.id, frameId: box?.placeholderId })
            }}>
            <SpreadThumbnail dropPlaceholderId={target?.replace && target.spreadId === spread.id ? target.beforeFrameId : null} selectedPlaceholderId={selectedSpreadId === spread.id ? selectedPlaceholderId : null} spread={spread} photosById={photosById} size={project.size} responsive />
            <div className="spread-card-controls" onDoubleClick={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
              <div className="spread-card-controls__actions">
                <button title="Flip spread horizontally" aria-label="Flip spread horizontally" onClick={() => flipSpread(spread.id)}><Icon name="flipSpread" size={16} /></button>
                <button title="Edit in Designer View" aria-label="Edit in Designer View" onClick={() => enterDesignerView(spread.id)}><Icon name="edit" size={16} /></button>
              </div>
              <div className="spread-card-controls__center"><div className="spread-card-controls__templates">
                <button disabled={spread.templateLocked||cyclingTemplates(project,spread,useProjectStore.getState().templateFrameFilter,useProjectStore.getState().favoriteTemplateIds).length<2} title={spread.templateLocked?'Unlock the template to cycle layouts':'Previous template (Up)'} onClick={() => { selectSpread(spread.id); cycleSpreadTemplate(spread.id, -1) }}><Icon name="chevronLeft" size={12} /></button>
                <button disabled={spread.templateLocked} title={spread.templateLocked?'Unlock the template to browse layouts':'Browse matching templates'} onClick={() => openMatchingTemplates(spread.id)}><Icon name="grid" size={12} /></button>
                <button disabled={spread.templateLocked||cyclingTemplates(project,spread,useProjectStore.getState().templateFrameFilter,useProjectStore.getState().favoriteTemplateIds).length<2} title={spread.templateLocked?'Unlock the template to cycle layouts':'Next template (Down)'} onClick={() => { selectSpread(spread.id); cycleSpreadTemplate(spread.id, 1) }}><Icon name="chevronRight" size={12} /></button>
              </div>
              <div className="spread-card-controls__templates">
                <button disabled={spread.templateLocked||cyclingTemplates(project,spread,useProjectStore.getState().templateFrameFilter,useProjectStore.getState().favoriteTemplateIds,'mixed').length<2} title={spread.templateLocked?'Unlock the template to cycle layouts':'Previous mixed template'} onClick={() => { selectSpread(spread.id); useProjectStore.getState().cycleSpreadMixedTemplate(spread.id, -1) }}><Icon name="chevronLeft" size={12} /></button>
                <button disabled={spread.templateLocked} title={spread.templateLocked?'Unlock the template to browse layouts':'Browse mixed templates'} aria-label="Browse mixed templates" onClick={()=>useProjectStore.getState().openMatchingTemplates(spread.id,'mixed')}>T▦</button>
                <button disabled={spread.templateLocked||cyclingTemplates(project,spread,useProjectStore.getState().templateFrameFilter,useProjectStore.getState().favoriteTemplateIds,'mixed').length<2} title={spread.templateLocked?'Unlock the template to cycle layouts':'Next mixed template'} onClick={() => { selectSpread(spread.id); useProjectStore.getState().cycleSpreadMixedTemplate(spread.id, 1) }}><Icon name="chevronRight" size={12} /></button>
              </div>
              <QuoteTemplates spreadId={spread.id} compact /></div>
              <div className="spread-card-controls__end"><span>{index + 1}</span><button className={spread.templateLocked?'is-active':undefined} title={spread.templateLocked?'Unlock this spread’s template layout':'Lock this spread’s template layout (photos can still be swapped)'} aria-label={spread.templateLocked?'Unlock template':'Lock template'} aria-pressed={!!spread.templateLocked} onClick={()=>updateSpread(spread.id,{templateLocked:!spread.templateLocked})}>{spread.templateLocked?'🔒':'🔓'}</button><button title={`Delete spread ${index + 1}`} aria-label={`Delete spread ${index + 1}`} onClick={()=>{selectSpread(spread.id);deleteSpread(spread.id)}}><Icon name="trash" size={14}/></button></div>
            </div>
            {exportingId === spread.id && (
              <div className="spreads-panel__exporting">
                <Icon name="download" size={14} />
                Exporting…
              </div>
            )}
            </div>
          </div>
        ))}

        <div
            className={`spreads-panel__card spreads-panel__card--drop ${newSpreadDragOver || (drag && target?.spreadId === null && !target.cover) ? 'is-drag-over' : ''}`}
            data-new-spread
          style={{ aspectRatio: project.size.widthIn / project.size.heightIn }}
          onClick={() => newSpreadInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setNewSpreadDragOver(true)
          }}
          onDragLeave={() => setNewSpreadDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setNewSpreadDragOver(false)
            const frame = readTimelineFrame(e.dataTransfer)
            const ids = readDraggedPhotoIds(e.dataTransfer, project.photos.map((p) => p.id))
            if (frame) moveTimelinePhoto(frame.spreadId, frame.frameId, null)
            else if (ids.length) insertTimelinePhotos(ids, null)
            else void handleNewSpreadDrop(e.dataTransfer.files)
          }}
        >
          <input
            ref={newSpreadInputRef}
            type="file"
            accept={IMAGE_FILE_ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              void handleNewSpreadDrop(e.target.files ?? [])
              e.target.value = ''
            }}
          />
          {project.spreads.length === 0 && <Icon name="image" size={100} />}
          <p>Drop images here to create a new spread.</p>
        </div>
      </div>

      {project.spreads.length === 0 && <div className={`spreads-panel__empty-timeline ${newSpreadDragOver || (drag && target?.spreadId === null && !target.cover) ? 'is-drag-over' : ''}`} data-new-spread role="button" tabIndex={0} aria-label="Drop images here to start the album" onClick={() => newSpreadInputRef.current?.click()} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); newSpreadInputRef.current?.click() } }} onDragOver={(e) => { e.preventDefault(); setNewSpreadDragOver(true) }} onDragLeave={() => setNewSpreadDragOver(false)} onDrop={dropOnNewSpread}>Drop images here to start the timeline</div>}
      {spreads.length > 0 && <PanelResizer axis="y" variable="--timeline-height" label="Resize timeline" initial={150} min={65} max={0.35}/>}{spreads.length > 0 && <div ref={timelineRef} className="spreads-panel__timeline" aria-label="Album image timeline" onClick={e=>{if(e.target===e.currentTarget)selectSpread(null)}}>
        <span className="timeline-boundary timeline-boundary--edge" role="separator" aria-label="Start of timeline" />
        {spreads.map((spread, index) => <Fragment key={spread.id}>
          <div className={`spreads-panel__photos ${selectedSpreadId === spread.id ? 'is-selected' : ''} ${target?.spreadId === spread.id ? 'is-drop-target' : ''}`}
            data-timeline-spread={spread.id} aria-label={`Images in spread ${index + 1}`}
            onClick={e => selectSpread(e.target===e.currentTarget?null:spread.id)} onDoubleClick={() => enterDesignerView(spread.id)}
            onContextMenu={(e) => openContextMenu(e, spread.id)}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleSpreadDrop(e, spread.id)}>
            {spread.placements.map((placement, placementIndex) => {
              const photo = placement.photoId ? photosById.get(placement.photoId) : undefined
              return photo ? <Fragment key={placement.placeholderId}>
                {spread.placements.slice(0,placementIndex).some(p=>p.photoId&&photosById.has(p.photoId))&&<button className="timeline-cut" aria-label={`Split spread ${index+1} before ${photo.fileName}`} title="Click to split into two spreads here" onClick={e=>{e.stopPropagation();splitSpread(spread.id,placementIndex)}} onDoubleClick={e=>e.stopPropagation()} />}
                {target?.spreadId===spread.id&&target.beforeFrameId===placement.placeholderId&&<span className="timeline-drop-marker" aria-label="Insert photo here">●</span>}
                <PreviewImage src={photo.src} sourcePath={photo.sourcePath} alt={photo.fileName} title={`${photo.fileName} — drag to move in the timeline`} draggable={false}
                  onContextMenu={e => { e.preventDefault(); e.stopPropagation(); selectSpread(spread.id); setPhotoMenu({ openedAt: Date.now(), x: e.clientX, y: e.clientY, spreadId: spread.id, frameId: placement.placeholderId }) }}
                  data-timeline-frame={placement.placeholderId}
                  onClick={e => { e.stopPropagation(); selectSpread(spread.id); useProjectStore.getState().selectPlaceholder(placement.placeholderId) }}
                  className={`${selectedSpreadId === spread.id && selectedPlaceholderId === placement.placeholderId ? 'is-selected' : ''} ${target?.spreadId === spread.id && target.beforeFrameId === placement.placeholderId ? 'is-insert-before' : ''}`}
                  onDrop={(e) => handleSpreadDrop(e, spread.id, placement.placeholderId)} />
              </Fragment> : null
            })}
            {target?.spreadId===spread.id&&!target.beforeFrameId&&<span className="timeline-drop-marker" aria-label="Append photo here">●</span>}
          </div>
          {index < spreads.length - 1 && <button className="timeline-boundary" aria-label={`Merge spread ${index + 1} with next spread`} title={`Remove cut after spread ${index + 1} (merge with next)`} onClick={() => mergeWithNext(spread.id)} />}
        </Fragment>)}
        <span className="timeline-boundary timeline-boundary--edge" role="separator" aria-label="End of timeline" />
        <div className={`timeline-new-spread ${newSpreadDragOver || (drag && target?.spreadId === null && !target.cover) ? 'is-drag-over' : ''}`} data-new-spread onDragOver={(e) => { e.preventDefault(); setNewSpreadDragOver(true) }} onDragLeave={() => setNewSpreadDragOver(false)} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const ids = readDraggedPhotoIds(e.dataTransfer, project.photos.map((p) => p.id)); const frame=readTimelineFrame(e.dataTransfer); if(frame)moveTimelinePhoto(frame.spreadId,frame.frameId,null); else if (ids.length) insertTimelinePhotos(ids, null); else void handleNewSpreadDrop(e.dataTransfer.files) }}>Drop images to add a spread</div>
      </div>}

      {drag && createPortal(<img className="timeline-drag-preview" src={drag.src} alt="" style={{ left: drag.x, top: drag.y }} />,document.body)}
      {drag && <span className="sr-only" role="status">{target ? 'Release to place image' : 'Move over the timeline to place image'}</span>}

      {photoMenu && <PhotoContextMenu key={JSON.stringify(photoMenu)} {...photoMenu} />}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems(contextMenu.spreadId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
