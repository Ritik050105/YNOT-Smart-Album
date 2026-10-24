/** Exact numeric entry with either a slider or compact adjustment buttons. */
export default function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  buttons = false,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  buttons?: boolean
  onChange: (value: number) => void
}) {
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
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />}
    </div>
  )
}
