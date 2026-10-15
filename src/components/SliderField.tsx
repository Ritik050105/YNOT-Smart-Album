/** A range slider paired with a numeric input showing/editing the same value — every numeric
 *  attribute in the app should let you type an exact custom value, not just drag a slider. */
export default function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}) {
  function clamp(v: number) {
    if (Number.isNaN(v)) return min
    return Math.min(max, Math.max(min, v))
  }

  return (
    <label className="slider-field">
      <span className="row">
        <span>{label}</span>
        <span className="slider-field__input-wrap">
          <input
            type="number"
            className="slider-field__input"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
          />
          {suffix && <span className="slider-field__suffix">{suffix}</span>}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}
