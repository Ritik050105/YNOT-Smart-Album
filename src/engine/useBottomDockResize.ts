import { useEffect, useRef } from 'react'
import { useProjectStore } from '@/state/projectStore'

/** The bottom Photo Dock's top-edge strip doubles as a drag-to-resize handle (dragging up/down
 *  changes the panel height independently of its thumbnail zoom) and, for a plain click
 *  with no real drag, the existing collapse/expand toggle. Shared by the main editor and
 *  Designer View, which both dock the same panel the same way. */
export function useBottomDockResize() {
  const bottomPanelOpen = useProjectStore((s) => s.bottomPanelOpen)
  const toggleBottomPanel = useProjectStore((s) => s.toggleBottomPanel)
  const setDockHeight = (value:number) => {const height=Math.max(140,Math.min(innerHeight*.65,value));document.documentElement.style.setProperty('--dock-height',height+'px');try{localStorage.setItem('ynot.dockHeight',String(height))}catch{}}
  useEffect(()=>{try{setDockHeight(Number(localStorage.getItem('ynot.dockHeight'))||innerHeight*.35)}catch{}},[])
  const dragRef = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null)

  function handleMouseDown(e: React.MouseEvent) {
    if (!bottomPanelOpen) {
      toggleBottomPanel()
      return
    }
    dragRef.current = { startY: e.clientY, startHeight: e.currentTarget.parentElement?.getBoundingClientRect().height || 240, moved: false }
    function onMove(ev: MouseEvent) {
      const drag = dragRef.current
      if (!drag) return
      const delta = drag.startY - ev.clientY
      if (Math.abs(delta) > 3) drag.moved = true
      setDockHeight(drag.startHeight + delta)
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
