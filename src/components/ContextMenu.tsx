import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  shortcut?: string
  separator?: boolean
}

/** A generic right-click menu, positioned at a fixed (x, y) — used on canvas photos and spread
 *  thumbnails so the common "right-click for options" convention works throughout the app,
 *  alongside the same actions already reachable from buttons/the menu bar. Closes on outside
 *  click or Escape, and clamps itself inside the viewport so it never renders off-screen. */
export default function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('contextmenu', onMouseDown)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('contextmenu', onMouseDown)
    }
  }, [onClose])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const overflowX = rect.right - window.innerWidth
    const overflowY = rect.bottom - window.innerHeight
    if (overflowX > 0) el.style.left = `${Math.max(4, x - overflowX)}px`
    if (overflowY > 0) el.style.top = `${Math.max(4, y - overflowY)}px`
  }, [x, y])

  return (
    <div ref={ref} role="menu" className="context-menu" style={{ left: x, top: y, maxHeight: 'calc(100vh - 8px)', overflowY: 'auto' }}>
      {items.map((item) => (
        <button
          key={item.label}
          role="menuitem"
          className={`context-menu__item ${item.danger ? 'is-danger' : ''}`}
          style={{ display: 'flex', justifyContent: 'space-between', gap: 28, ...(item.separator ? { borderTop: '1px solid var(--border-soft)', marginTop: 4 } : {}) }}
          disabled={item.disabled}
          onClick={() => {
            item.onClick()
            onClose()
          }}
        >
          {item.label}
          {item.shortcut && <span>{item.shortcut}</span>}
        </button>
      ))}
    </div>
  )
}
