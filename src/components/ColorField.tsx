import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'

interface Props {
  value: string
  onChange: (hex: string) => void
  presets?: string[]
}

/** A tasteful, muted palette that fits the app's own warm/neutral design language — covers the
 *  common album background/border/text choices without opening the full picker every time. */
const DEFAULT_PRESETS = [
  '#ffffff',
  '#f7f3ea',
  '#e4d9c6',
  '#c9a98a',
  '#8a8a8a',
  '#3a3a3a',
  '#111111',
  '#5c4433',
  '#8a5a6b',
  '#2f4858',
]

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/** A color picker field styled as a round swatch + hex readout, replacing the raw native
 *  `<input type="color">` box (a thin, inconsistently-styled line across browsers) everywhere
 *  the app lets you pick a background/border/text color. Clicking it opens a small popover with
 *  a preset palette, a hex field for exact values, and the native picker for anything else —
 *  the native input itself is kept, just hidden, so the OS color picker is still one click away. */
// Rough popover height (presets grid + custom row + padding) used only to decide whether it
// fits below the trigger — doesn't need to be exact, just enough to flip it upward in time.
const ESTIMATED_POPOVER_HEIGHT = 160

export default function ColorField({ value, onChange, presets = DEFAULT_PRESETS }: Props) {
  const [open, setOpen] = useState(false)
  // Anchored below the trigger by default; `top` is null and `bottom` set instead when there
  // isn't room below (e.g. a color field near the bottom of a scrolled panel or modal) — same
  // flip-to-fit idea as the bin-tag popover, just computed from the trigger's own rect.
  const [anchor, setAnchor] = useState<{ left: number; top: number | null; bottom: number | null } | null>(null)
  const [hexDraft, setHexDraft] = useState(value)
  const btnRef = useRef<HTMLButtonElement>(null)
  const nativeRef = useRef<HTMLInputElement>(null)

  useEffect(() => setHexDraft(value), [value])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  function commitHex(raw: string) {
    const v = raw.trim()
    if (HEX_RE.test(v)) onChange(v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v)
  }

  return (
    <span className="color-field">
      <button
        type="button"
        ref={btnRef}
        className="color-field__trigger"
        onClick={(e) => {
          e.stopPropagation()
          const rect = e.currentTarget.getBoundingClientRect()
          const left = Math.min(rect.left, window.innerWidth - 200)
          const fitsBelow = window.innerHeight - rect.bottom >= ESTIMATED_POPOVER_HEIGHT + 6
          setAnchor(
            fitsBelow
              ? { left, top: rect.bottom + 6, bottom: null }
              : { left, top: null, bottom: window.innerHeight - rect.top + 6 }
          )
          setOpen((o) => !o)
        }}
      >
        <span className="color-field__swatch" style={{ background: value }} />
        <span className="color-field__hex">{value.toUpperCase()}</span>
        <Icon name="chevronDown" size={11} />
      </button>
      {open &&
        anchor &&
        createPortal(
          <div
            className="color-field__popover"
            style={anchor.top !== null ? { left: anchor.left, top: anchor.top } : { left: anchor.left, bottom: anchor.bottom! }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="color-field__presets">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`color-field__preset ${p.toLowerCase() === value.toLowerCase() ? 'is-active' : ''}`}
                  style={{ background: p }}
                  title={p}
                  onClick={() => {
                    onChange(p)
                    setOpen(false)
                  }}
                />
              ))}
            </div>
            <div className="color-field__custom-row">
              <button
                type="button"
                className="color-field__custom-swatch"
                style={{ background: value }}
                title="More colors…"
                onClick={() => nativeRef.current?.click()}
              >
                <Icon name="palette" size={12} />
              </button>
              <input
                className="color-field__hex-input"
                value={hexDraft}
                spellCheck={false}
                onChange={(e) => setHexDraft(e.target.value)}
                onBlur={() => commitHex(hexDraft)}
                onKeyDown={(e) => e.key === 'Enter' && commitHex(hexDraft)}
              />
            </div>
            <input
              ref={nativeRef}
              type="color"
              value={value}
              className="color-field__native"
              onChange={(e) => onChange(e.target.value)}
            />
          </div>,
          document.body
        )}
    </span>
  )
}
