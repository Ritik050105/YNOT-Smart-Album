import { getPreferences } from '@/state/preferences'
import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { draggedPhotoIds, overviewPhotoAt } from './photoDrag'

export interface TimelineSource { spreadId?: string; frameId?: string; photoIds: string[] }
export interface TimelineTarget { spreadId: string | null; beforeFrameId?: string; cover?: boolean; replace?: boolean }

function targetAt(x: number, y: number): TimelineTarget | null {
  const element = document.elementFromPoint(x, y)
  if (element?.closest('[data-cover-drop]')) return { spreadId: null, cover: true }
  if (element?.closest('[data-new-spread]')) return { spreadId: null }
  const column = element?.closest<HTMLElement>('[data-timeline-spread]')
  if (!column) return null
  const image = element?.closest<HTMLElement>('[data-timeline-frame]')
  let beforeFrameId = image?.dataset.timelineFrame
  if (image && x > image.getBoundingClientRect().left + image.getBoundingClientRect().width / 2) {
    const frames = Array.from(column.querySelectorAll<HTMLElement>('[data-timeline-frame]'))
    beforeFrameId = frames[frames.indexOf(image) + 1]?.dataset.timelineFrame
  }
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
    let suppressClickUntil = 0
    function updateTarget() {
      const current = gesture.current
      if (!current?.active) return
      const next = targetAt(current.x, current.y)
      setTarget((old) => old?.spreadId === next?.spreadId && old?.beforeFrameId === next?.beforeFrameId && old?.cover === next?.cover ? old : next)
    }
    function scroll() {
      const current = gesture.current
      if (!current?.active) return
      const under = document.elementFromPoint(current.x, current.y)
      const strip = under?.closest<HTMLElement>('.spreads-panel__timeline, .spreads-panel__row')
      const viewport = document.querySelector<HTMLElement>('.app-main')
      for (const pane of [strip, viewport]) {
        if (!pane) continue
        const rect = pane.getBoundingClientRect()
        if (current.y < rect.top || current.y > rect.bottom) continue
        const delta = current.x < rect.left + 32 ? -10 : current.x > rect.right - 32 ? 10 : 0
        if (delta) pane.scrollLeft += delta
      }
      updateTarget()
      scrollFrame = requestAnimationFrame(scroll)
    }
    function cancel() {
      gesture.current = null
      cancelAnimationFrame(scrollFrame)
      setDrag(null)
      setTarget(null)
    }
    function down(event: PointerEvent) {
      if (event.button !== 0 || !(event.target instanceof Element)) return
      if (event.target.closest('button, input, select, textarea, a')) return
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
      if(frameId&&spread?.placements.find(p=>p.placeholderId===frameId)?.locked)return
      if (item.hasAttribute('data-spread-drag') && spreadId && !frameId) {
        const src = item.querySelector('canvas')?.toDataURL()
        if (!src) return
        event.preventDefault()
        item.setPointerCapture(event.pointerId)
        gesture.current = { source: { spreadId, photoIds: [] }, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, active: false, src, pointerId: event.pointerId }
        return
      }
      const photoId = item.dataset.dockPhoto ?? state.project.spreads.find((s) => s.id === spreadId)?.placements.find((p) => p.placeholderId === frameId)?.photoId
      if (!photoId) return
      const visibleIds = Array.from(document.querySelectorAll<HTMLElement>('[data-dock-photo]')).map((el) => el.dataset.dockPhoto!)
      const photoIds = frameId ? [photoId] : draggedPhotoIds(photoId, state.selectedPhotoIds, visibleIds)
      const src = state.project.photos.find((p) => p.id === photoId)?.src
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
      if (!current.active) { current.active = true; scrollFrame = requestAnimationFrame(scroll) }
      setDrag({ x: current.x, y: current.y, src: current.src })
      updateTarget()
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
