import { useState } from 'react'
import { Spread } from '@/types'
import ColorField from './ColorField'

type Target = 'spread' | 'left' | 'right'

/** The paper colour, and which part of the sheet it applies to. A spread is one sheet folded in
 *  the middle, so a designer wants all three: the whole sheet, or either page on its own. Picking
 *  "Whole spread" clears the per-page colours, so the sheet goes back to one colour rather than
 *  keeping two that happen to match. */
export default function PaperColorFields({ spread, onChange }: {
  spread: Spread
  onChange: (patch: Partial<Spread>) => void
}) {
  const [target, setTarget] = useState<Target>('spread')
  const pages = spread.pageSide === 'spread'
  const applied = !pages || target === 'spread' ? spread.backgroundColor
    : (target === 'left' ? spread.backgroundColorLeft : spread.backgroundColorRight) ?? spread.backgroundColor

  const set = (hex: string) => {
    if (!pages || target === 'spread') return onChange({ backgroundColor: hex, backgroundColorLeft: undefined, backgroundColorRight: undefined })
    // Giving one page its own colour pins the other to what it is showing now, so changing one
    // never silently changes the other.
    const other = target === 'left' ? 'backgroundColorRight' : 'backgroundColorLeft'
    onChange({
      [target === 'left' ? 'backgroundColorLeft' : 'backgroundColorRight']: hex,
      [other]: spread[other] ?? spread.backgroundColor,
    })
  }

  return <>
    {pages && <label className="field">
      Apply colour to
      <select value={target} onChange={e => setTarget(e.target.value as Target)}>
        <option value="spread">Whole spread</option>
        <option value="left">Left page</option>
        <option value="right">Right page</option>
      </select>
    </label>}
    <label className="field">
      Background color
      <ColorField value={applied} onChange={set} />
    </label>
  </>
}
