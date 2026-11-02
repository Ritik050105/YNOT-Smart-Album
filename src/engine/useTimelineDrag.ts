import { getPreferences } from '@/state/preferences'
import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { draggedPhotoIds, overviewPhotoAt } from './photoDrag'

export interface TimelineSource { spreadId?: string; frameId?: string; photoIds: string[] }
export interface TimelineTarget { spreadId: string | null; beforeFrameId?: string; cover?: boolean; replace?: boolean; /** A bin pill in the photo dock. */ bin?: string }

const clearBinHighlight = () => document.querySelectorAll('[data-bin].is-drop-target').forEach(el => el.classList?.remove("is-drop-target"))

function targetAt(x: number, y: number): TimelineTarget | null {
  const element = document.elementFromPoint(x, y)
  const bin = element?.closest<HTMLElement>('[data-bin]')
  if (bin) return { spreadId: null, bin: bin.dataset.bin ?? '' }
  if (element?.closest('[data-cover-drop]')) return { spreadId: null, cover: true }
  if (element?.closest('[data-new-spread]')) return { spreadId: null }
  const timeline = element?.closest<HTMLElement>('.spreads-panel__timeline')
  const groups = timeline ? Array.from(timeline.querySelectorAll<HTMLElement>('[data-timeline-spread]')) : []
  const column = element?.closest<HTMLElement>('[data-timeline-spread]')
    ?? groups.find(group => x < group.getBoundingClientRect().right) ?? groups.at(-1)
  if (!column) return null
  const overview=element?.closest<HTMLElement>('[data-spread-drag]')
  if(overview){const spread=useProjectStore.getState().project.spreads.find(s=>s.id===column.dataset.timelineSpread);const rect=overview.getBoundingClientRect();const hit=spread&&overviewPhotoAt(spread,x-rect.left,y-rect.top,rect.width,rect.height);const placement=spread?.placements.find(p=>p.placeholderId===hit?.placeholderId);if(placement?.locked||placement?.hidden)return null;return {spreadId:column.dataset.timelineSpread!,beforeFrameId:hit?.placeholderId,replace:!!hit}}
  // Use insertion midpoints across the whole row, including the gaps between photos.
  const frames = Array.from(column.querySelectorAll<HTMLElement>('[data-timeline-frame]'))
  const beforeFrameId = frames.find(frame => {
    const rect = frame.getBoundingClientRect()
    return x < rect.left + rect.width / 2
  })?.dataset.timelineFrame
  return { spreadId: column.dataset.timelineSpread!, beforeFrameId }
}

/** Pointer capture keeps internal album drags independent of Chromium's nested native drag loop. */
export function useTimelineDrag(onDrop: (source: TimelineSource, target: TimelineTarget) => void) {
  const commit = useRef(onDrop)
  commit.current = onDrop
  const gesture = useRef<{ source: TimelineSource; x: number; y: number; startX: number; startY: number; active: boolean; src: string; pointerId: number } | null>(null)
  const [drag, setDrag] = useState<{ x: number; y: number; src: string } | null>(null)
  const [target, setTarget] = useState<TimelineTarget | null>(null)

  useEffect(() => {
    let scrollFrame = 0
    let pointerFrame = 0
    let suppressClickUntil = 0
    function updateTarget() {
      const current = gesture.current
      if (!current?.active) return
      const next = targetAt(current.x, current.y)
      clearBinHighlight()
      if (next?.bin !== undefined) document.querySelectorAll<HTMLElement>('[data-bin]').forEach(el => { if (el.dataset.bin === next.bin) el.classList.add('is-drop-target') })
      setTarget((old) => old?.spreadId === next?.spreadId && old?.beforeFrameId === next?.beforeFrameId && old?.cover === next?.cover && old?.replace === next?.replace && old?.bin === next?.bin ? old : next)
    }
    function scroll() {
      scrollFrame = 0
      const current = gesture.current
      if (!current?.active) return
      const under = document.elementFromPoint(current.x, current.y)
      const strip = under?.closest<HTMLElement>('.spreads-panel__timeline, .spreads-panel__row')
      const viewport = document.querySelector<HTMLElement>('.app-main')
      let moved = false
      for (const pane of [strip, viewport]) {
        if (!pane) continue
        const rect = pane.getBoundingClientRect()
        if (current.y < rect.top || current.y > rect.bottom) continue
        const delta = current.x < rect.left + 32 ? -10 : current.x > rect.right - 32 ? 10 : 0
        if (delta && pane.scrollWidth > pane.clientWidth) {
          const before = pane.scrollLeft
          pane.scrollLeft += delta
          moved ||= pane.scrollLeft !== before
        }
      }
      if (moved) { updateTarget(); scrollFrame = requestAnimationFrame(scroll) }
    }
    function cancel() {
      gesture.current = null
      cancelAnimationFrame(scrollFrame)
      cancelAnimationFrame(pointerFrame)
      scrollFrame = pointerFrame = 0
      setDrag(null)
      setTarget(null)
      clearBinHighlight()
    }
    function down(event: PointerEvent) {
      if (event.button !== 0 || !(event.target instanceof Element)) return
      if (event.target.closest('button, input, select, textarea, a, [data-overview-text]')) return
      const item = event.target.closest<HTMLElement>('[data-timeline-frame], [data-dock-photo], [data-spread-drag]')
      if (!item) return
      const state = useProjectStore.getState()
      const spreadId = item.closest<HTMLElement>('[data-timeline-spread]')?.dataset.timelineSpread
      let frameId = item.dataset.timelineFrame
      const spread = state.project.spreads.find(s=>s.id===spreadId)
      if(item.hasAttribute('data-spread-drag')&&spread){
        const r=item.getBoundingClientRect()
        frameId=overviewPhotoAt(spread,event.clientX-r.left,event.clientY-r.top,r.width,r.height)?.placeholderId
      }
      if(frameId&&spread?.placements.find(p=>p.placeholderId===frameId)?.locked){window.dispatchEvent(new CustomEvent('album-studio:preference-notice',{detail:'This photo is locked. Select it and press Unlock in the top bar to move it.'}));return}
      if(item.hasAttribute('data-spread-drag')&&!frameId){ // empty card area: drag the whole spread (reorder)
        const preview=item.querySelector('canvas')?.toDataURL()
        if(!spreadId||!preview)return
        event.preventDefault()
        item.setPointerCapture(event.pointerId)
        gesture.current = { source: { spreadId, photoIds: [] }, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, active: false, src: preview, pointerId: event.pointerId }
        return
      }
      const photoId = item.dataset.dockPhoto ?? state.project.spreads.find((s) => s.id === spreadId)?.placements.find((p) => p.placeholderId === frameId)?.photoId
      if (!photoId) return
      const visibleIds = Array.from(document.querySelectorAll<HTMLElement>('[data-dock-photo]')).map((el) => el.dataset.dockPhoto!)
      const photoIds = frameId ? [photoId] : draggedPhotoIds(photoId, state.selectedPhotoIds, visibleIds)
      const src = item.querySelector('img')?.currentSrc || state.project.photos.find((p) => p.id === photoId)?.src
      if (!src) return
      event.preventDefault()
      item.setPointerCapture(event.pointerId)
      gesture.current = { source: { spreadId, frameId, photoIds }, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, active: false, src, pointerId: event.pointerId }
    }
    function move(event: PointerEvent) {
      const current = gesture.current
      if (!current || current.pointerId !== event.pointerId) return
      current.x = event.clientX
      current.y = event.clientY
      if (!current.active && Math.hypot(current.x - current.startX, current.y - current.startY) < 5) return
      if (!current.active) current.active = true
      if (!scrollFrame) scrollFrame = requestAnimationFrame(scroll)
      if (!pointerFrame) pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0
        const latest = gesture.current
        if (!latest?.active) return
        setDrag({ x: latest.x, y: latest.y, src: latest.src })
        updateTarget()
      })
    }
    function up(event: PointerEvent) {
      const current = gesture.current
      if (!current || current.pointerId !== event.pointerId) return
      if (current.active) {
        suppressClickUntil = performance.now() + 250
        const destination = targetAt(event.clientX, event.clientY)
        if (destination) {
          if(event.altKey){const frame=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-timeline-frame]');destination.replace=getPreferences().altDrop==='replace';if(frame)destination.beforeFrameId=frame.dataset.timelineFrame}
          commit.current(current.source, destination)
        }
      }
      if(!current.active){
        const state=useProjectStore.getState(),source=current.source
        if(source.spreadId){state.selectSpread(source.spreadId);state.selectPlaceholder(source.frameId??null)}
        else {const id=(event.target as HTMLElement)?.closest<HTMLElement>('[data-dock-photo]')?.dataset.dockPhoto??source.photoIds[0];if(id&&(!state.selectedPhotoIds.includes(id)||event.shiftKey||event.ctrlKey||event.metaKey))state.togglePhotoSelection(id,Array.from(document.querySelectorAll<HTMLElement>('[data-dock-photo]')).map(el=>el.dataset.dockPhoto!),event.shiftKey?'range':event.ctrlKey||event.metaKey?'toggle':'single')}
        suppressClickUntil=performance.now()+250
      }
      cancel()
    }
    function click(event: MouseEvent) {
      if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation() }
    }
    function key(event: KeyboardEvent) { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); event.stopPropagation(); cancel() } }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('click', click, true)
    window.addEventListener('keydown', key, true)
    return () => {
      cancelAnimationFrame(scrollFrame)
      cancelAnimationFrame(pointerFrame)
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('click', click, true)
      window.removeEventListener('keydown', key, true)
    }
  }, [])
  return { drag, target }
}
