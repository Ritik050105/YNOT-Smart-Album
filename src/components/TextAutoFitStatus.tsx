import { useEffect, useRef, useState } from 'react'
import { Spread } from '@/types'
import { useProjectStore } from '@/state/projectStore'

export default function TextAutoFitStatus({ spread, textIds }: { spread: Spread; textIds: string[] }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLElement>(null)
  const state = useProjectStore()
  useEffect(() => {
    if (open) return () => { window.dispatchEvent(new CustomEvent('album-studio:locate-text-box', { detail: { spreadId: spread.id, textId: null } })) }
  }, [open, spread.id])
  const locatedId = state.locatedTextBox?.spreadId === spread.id ? state.locatedTextBox.textId : null
  const selected = spread.textBoxes.filter(t => textIds.includes(t.id))
  const locked = selected.filter(t => t.locked)
  const eligible = selected.filter(t => !t.locked && !t.hidden).length
  const hidden = selected.filter(t => t.hidden && !t.locked).length
  useEffect(() => {
    if (open) list.current?.querySelector('.is-located')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [open, locatedId])
  return <div className="text-auto-fit-status" onKeyDown={event => {
    if (!open || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    if (!locked.length) return
    const current = locked.findIndex(t => t.id === locatedId)
    const next = current < 0 ? (event.key === 'ArrowDown' ? 0 : locked.length - 1) : Math.max(0, Math.min(locked.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)))
    const button = list.current?.querySelectorAll<HTMLButtonElement>('.text-auto-fit-status__locate')[next]
    button?.focus({ preventScroll: true })
    button?.click()
    button?.closest('article')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }}>
    <p className="context-menu__description" data-auto-fit-summary aria-live="polite">
      {eligible} to auto-fit · <button ref={trigger} className="text-auto-fit-status__count" type="button" aria-expanded={open} disabled={!locked.length && !open} onClick={() => setOpen(!open)}>{locked.length} locked (skipped)</button>{hidden ? ` · ${hidden} hidden (skipped)` : ''}
    </p>
    {open && <section ref={list} className="text-auto-fit-status__list" aria-label="Locked text boxes" aria-keyshortcuts="ArrowUp ArrowDown">
      <div className="designer-layers__actions">
        <button className="btn btn--tiny" disabled={!locked.length} onClick={() => { state.unlockTextBoxes(spread.id, locked.map(t => t.id)); trigger.current?.focus() }}>Unlock All</button>
        <button className="btn btn--tiny" disabled={!locked.length} onClick={() => { state.unlockTextBoxes(spread.id, locked.map(t => t.id), true); trigger.current?.focus() }}>Unlock and Auto-fit All</button>
        <button className="btn btn--tiny" disabled={!state.history.length} title="Undo (Ctrl+Z)" onClick={() => state.undo()}>Undo</button>
        <button className="btn btn--tiny" disabled={!state.future.length} title="Redo (Ctrl+Shift+Z)" onClick={() => state.redo()}>Redo</button>
        <button className="btn btn--tiny" onClick={() => { setOpen(false); trigger.current?.focus() }}>Close</button>
      </div>
      {!locked.length && <p role="status">No locked text boxes in this selection.</p>}
      {locked.map(t => <article key={t.id} className={locatedId === t.id ? 'is-located' : undefined}>
        <button className="text-auto-fit-status__locate" aria-pressed={locatedId === t.id} title={t.hidden ? 'Locate hidden text box (outline only)' : 'Locate text box on canvas'} aria-label={`Locate ${t.text.trim() || 'empty text box'}`} onClick={() => window.dispatchEvent(new CustomEvent('album-studio:locate-text-box', { detail: { spreadId: spread.id, textId: t.id } }))}>{t.text.trim() || 'Empty text box'}</button>
        <button className="btn btn--tiny" aria-label={`Unlock ${t.text.trim() || 'empty text box'}`} onClick={() => { state.unlockTextBoxes(spread.id, [t.id]); trigger.current?.focus() }}>Unlock</button>
        <button className="btn btn--tiny" aria-label={`Unlock and auto-fit ${t.text.trim() || 'empty text box'}`} onClick={() => { state.unlockTextBoxes(spread.id, [t.id], true); trigger.current?.focus() }}>Unlock and Auto-fit</button>
      </article>)}
    </section>}
  </div>
}
