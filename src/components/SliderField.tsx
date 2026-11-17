import { useRef } from 'react'

/** Exact numeric entry with either a slider or compact adjustment buttons.
 *
 *  `onPreview`, when given, is called for every movement of the slider and `onChange` once when it is let go (pointer up, key up or leaving
 *  it): a drag is then one edit with one undo step, and the caller can draw the movement cheaply in between. Without it every movement
 *  goes to `onChange`, as before. */
export default function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  buttons = false,
  resetValue,
  onChange,
  onPreview,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  buttons?: boolean
  resetValue?: number
  onChange: (value: number) => void
  onPreview?: (value: number) => void
}) {
  const moving = useRef<number | null>(null)
  function release() { if (moving.current !== null) { const v = moving.current; moving.current = null; onChange(v) } }
  function clamp(v: number) {
    if (Number.isNaN(v)) return min
    return Math.min(max, Math.max(min, v))
  }
  const directions = label === 'Focal X' ? ['←', '→'] : label === 'Focal Y' ? ['↑', '↓'] : label === 'Angle' ? ['↶', '↷'] : ['−', '+']
  const actions = label === 'Focal X' ? ['Move crop left', 'Move crop right'] : label === 'Focal Y' ? ['Move crop up', 'Move crop down'] : label === 'Angle' ? ['Rotate counterclockwise', 'Rotate clockwise'] : [`Decrease ${label.toLowerCase()}`, `Increase ${label.toLowerCase()}`]
  function nudge(direction: number) { onChange(clamp(Number((value + direction * step).toFixed(6)))) }

  return (
    <div className={`slider-field ${buttons ? 'slider-field--buttons' : 'slider-field--range'}`}>
      <span className="row">
        <span>{label}</span>
        <span className="slider-field__input-wrap">
          {buttons && <button type="button" className="numeric-step" title={actions[0]} aria-label={actions[0]} disabled={value <= min} onClick={() => nudge(-1)}>{directions[0]}</button>}
          <input
            aria-label={label}
            type="number"
            className="slider-field__input"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
          />
          {suffix && <span className="slider-field__suffix">{suffix}</span>}
          {buttons && <button type="button" className="numeric-step" title={actions[1]} aria-label={actions[1]} disabled={value >= max} onClick={() => nudge(1)}>{directions[1]}</button>}
        </span>
      </span>
      {!buttons && <input
        aria-label={`${label} slider`}
        type="range"
        title="Double-click to reset"
        onDoubleClick={() => onChange(clamp(resetValue ?? ({Scale:100,Opacity:1,'Fill opacity':1,'Text opacity':1,'Line spacing':1.2,'Stroke width':2,'Focal X':.5,'Focal Y':.5}[label] ?? 0)))}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => { const v = Number(e.target.value); if (onPreview) { moving.current = v; onPreview(v) } else onChange(v) }}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyUp={release}
        onBlur={release}
      />}
    </div>
  )
}
