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
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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
