import { Fragment } from 'react'
import { useProjectStore } from '@/state/projectStore'
import Icon from './Icon'

const STEPS = ['Import', 'Build', 'Design', 'Export']

/** A friendly "where am I" guide mirroring the simple Import → Design → Proof workflow this app
 *  is built around, so the interface doesn't rely on the user already knowing the steps. */
export default function WorkflowStepper() {
  const photosCount = useProjectStore((s) => s.project.photos.length)
  const spreadsCount = useProjectStore((s) => s.project.spreads.filter((sp) => !sp.isCover).length)

  const done = [photosCount > 0, spreadsCount > 0, false, false]
  const currentIndex = done.findIndex((d) => !d)

  return (
    <div className="workflow-stepper">
      {STEPS.map((step, i) => (
        <Fragment key={step}>
          <div className={`workflow-step ${done[i] ? 'is-done' : ''} ${i === currentIndex ? 'is-current' : ''}`}>
            <span className="workflow-step__dot">{done[i] ? <Icon name="check" size={12} /> : i + 1}</span>
            {step}
          </div>
          {i < STEPS.length - 1 && <div className="workflow-connector" />}
        </Fragment>
      ))}
    </div>
  )
}
