import { useEffect, useRef, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

/**
 * Standard modal dialog shell — used for anything that's multi-field, multi-step, or an
 * important/confirming action (New Project, Export, Custom Size). Per modal-dialog UX
 * convention: reserved for focused tasks that benefit from blocking the rest of the UI,
 * NOT for single quick edits (those stay inline — see the custom font/event-type fields,
 * which are one text input and would make a modal pure friction).
 */
export default function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 480,
  bare = false,
  className = '',
  headerContent,
}: {
  className?: string
  headerContent?: ReactNode
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
  /** Renders the card alone, filling its container, with no dark backdrop — for when this modal
   *  IS the entire window (a dedicated native "New Project" window, matching the reference app)
   *  rather than an overlay on top of the main editor. */
  bare?: boolean
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef(typeof document === 'undefined' ? null : document.activeElement)
  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const previous = previousFocusRef.current instanceof HTMLElement ? previousFocusRef.current : null
    const controls = () => Array.from(card.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], [tabindex], [contenteditable="true"]',
    )).filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden')
    const topmost = () => {
      const dialogs = document.querySelectorAll('[role="dialog"]')
      return dialogs[dialogs.length - 1] === card
    }
    const focusFirst = () => (controls()[0] ?? card).focus({ preventScroll: true })
    if (topmost() && !card.contains(document.activeElement)) focusFirst()
    function onTab(e: KeyboardEvent) {
      if (e.key !== 'Tab' || e.defaultPrevented || !topmost()) return
      const items = controls()
      const first = items[0], last = items[items.length - 1]
      if (!first || !card!.contains(document.activeElement) || (e.shiftKey ? document.activeElement === first : document.activeElement === last) || document.activeElement === card) {
        e.preventDefault()
        const target = (e.shiftKey ? last : first) ?? card!
        target.focus({ preventScroll: true })
      }
    }
    window.addEventListener('keydown', onTab)
    return () => {
      window.removeEventListener('keydown', onTab)
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      const dialogs = document.querySelectorAll('[role="dialog"]')
      if (dialogs[dialogs.length - 1] !== cardRef.current) return
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const card = (
    <div
      ref={cardRef}
      className={`modal-card ${bare ? 'modal-card--bare' : ''} ${className}`}
      style={bare ? undefined : { width }}
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-label={title}
    >
      <div className="modal-card__header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {!bare && (
          <button className="btn btn--icon btn--ghost" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        )}
      </div>
      {headerContent}
      <div className="modal-card__body">{children}</div>
      {footer && <div className="modal-card__footer">{footer}</div>}
    </div>
  )

  if (bare) return card

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {card}
    </div>, document.body
  )
}
