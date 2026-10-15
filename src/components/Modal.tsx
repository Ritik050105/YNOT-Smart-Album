import { useEffect, ReactNode } from 'react'
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
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ width }} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-card__header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="btn btn--icon btn--ghost" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-card__body">{children}</div>
        {footer && <div className="modal-card__footer">{footer}</div>}
      </div>
    </div>
  )
}
