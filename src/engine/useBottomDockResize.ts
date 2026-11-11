import { useEffect, useRef } from 'react'
import { useProjectStore } from '@/state/projectStore'

/** The bottom Photo Dock's top-edge strip doubles as a drag-to-resize handle (dragging up/down
 *  changes the panel height independently of its thumbnail zoom) and, for a plain click
 *  with no real drag, the existing collapse/expand toggle. Shared by the main editor and
 *  Designer View, which both dock the same panel the same way. */
export function useBottomDockResize() {
  const bottomPanelOpen = useProjectStore((s) => s.bottomPanelOpen)
  const toggleBottomPanel = useProjectStore((s) => s.toggleBottomPanel)
  const clamp = (value:number) => Math.max(140, Math.min(innerHeight * .65, value))
  const setDockHeight = (value:number) => {const height=clamp(value);document.documentElement.style.setProperty('--dock-height',height+'px');try{localStorage.setItem('ynot.dockHeight',String(height))}catch{}}
  // The dock's height was read from storage once, on mount, and never looked at again — so a
  // window made shorter afterwards kept a dock sized for the taller one and it hung off the
  // bottom of the screen. The stored height is the height the user dragged it to and stays
  // whatever they chose; what is applied is that height or as much of it as the window has room
  // for, recomputed whenever the window changes size.
  useEffect(()=>{
    const apply=()=>{
      let preferred=innerHeight*.35
      try{preferred=Number(localStorage.getItem('ynot.dockHeight'))||preferred}catch{}
      document.documentElement.style.setProperty('--dock-height',clamp(preferred)+'px')
    }
    apply()
    window.addEventListener('resize',apply)
    return ()=>window.removeEventListener('resize',apply)
  },[])
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
