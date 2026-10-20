import { useRef } from 'react'
import { useProjectStore } from '@/state/projectStore'

/** The bottom Photo Dock's top-edge strip doubles as a drag-to-resize handle (dragging up/down
 *  scales its thumbnails — the same value its own zoom slider controls) and, for a plain click
 *  with no real drag, the existing collapse/expand toggle. Shared by the main editor and
 *  Designer View, which both dock the same panel the same way. */
export function useBottomDockResize() {
  const bottomPanelOpen = useProjectStore((s) => s.bottomPanelOpen)
  const toggleBottomPanel = useProjectStore((s) => s.toggleBottomPanel)
  const photoDockZoom = useProjectStore((s) => s.photoDockZoom)
  const setPhotoDockZoom = useProjectStore((s) => s.setPhotoDockZoom)
  const dragRef = useRef<{ startY: number; startZoom: number; moved: boolean } | null>(null)

  function handleMouseDown(e: React.MouseEvent) {
    if (!bottomPanelOpen) {
      toggleBottomPanel()
      return
    }
    dragRef.current = { startY: e.clientY, startZoom: photoDockZoom, moved: false }
    function onMove(ev: MouseEvent) {
      const drag = dragRef.current
      if (!drag) return
      const delta = drag.startY - ev.clientY
      if (Math.abs(delta) > 3) drag.moved = true
      setPhotoDockZoom(drag.startZoom + delta)
    }
    function onUp() {
      const drag = dragRef.current
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (!drag?.moved) toggleBottomPanel()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return { bottomPanelOpen, handleMouseDown }
}
