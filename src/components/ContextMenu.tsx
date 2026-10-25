import { useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
  label: string
  description?: string
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
  children,
}: {
  x: number
  y: number
  children?: ReactNode
  items: ContextMenuItem[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); onClose() }
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [onClose])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const position = () => {
      const rect = el.getBoundingClientRect()
      el.style.left = `${Math.max(4, Math.min(x, window.innerWidth - rect.width - 4))}px`
      el.style.top = `${Math.max(4, Math.min(y, window.innerHeight - rect.height - 4))}px`
    }
    position()
    const observer = new ResizeObserver(position)
    observer.observe(el)
    window.addEventListener('resize', position)
    return () => { observer.disconnect(); window.removeEventListener('resize', position) }
  }, [x, y])

  return createPortal(
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
          <span>{item.label}{item.description && <small className="context-menu__description" aria-live="polite">{item.description}</small>}</span>
          {item.shortcut && <span>{item.shortcut}</span>}
        </button>
      ))}
      {children}
    </div>, document.body
  )
}
