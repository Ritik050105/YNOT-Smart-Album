import { OpenSessionMarker } from '@/engine/sessionMarker'
import Modal from './Modal'
import Icon from './Icon'

/** Shown at launch only when the last session left a project with real unsaved edits still open
 *  (see engine/sessionMarker.ts) — asks before reopening anything, rather than silently resuming,
 *  so a deliberate "I'm starting fresh today" launch never gets dropped back into old work. */
export default function ContinueSessionPrompt({
  marker,
  busy,
  onContinue,
  onStartFresh,
}: {
  marker: OpenSessionMarker
  busy: boolean
  onContinue: () => void
  onStartFresh: () => void
}) {
  return (
    <Modal
      title="Continue where you left off?"
      subtitle={marker.hasRecovery ? `Recover unsaved changes to "${marker.name}".` : `Reopen the last saved version of "${marker.name}". Unsaved edits from the older app version are unavailable.`}
      onClose={onStartFresh}
      width={420}
      footer={
        <>
          <button className="btn" disabled={busy} onClick={onStartFresh}>
            Start Fresh
          </button>
          <div className="footer-spacer" />
          <button className="btn btn--primary" disabled={busy} onClick={onContinue}>
            <Icon name="bookOpen" size={14} />
            {busy ? 'Opening…' : 'Continue Session'}
          </button>
        </>
      }
    >
      <div className="continue-session-prompt">
        <Icon name="bookOpen" size={28} />
        <p className="continue-session-prompt__name">{marker.name}</p>
        {marker.clientName && <p className="muted">{marker.clientName}</p>}
        <p className="muted">
          {marker.sizeLabel} · {marker.spreadCount} spread{marker.spreadCount === 1 ? '' : 's'}
        </p>
      </div>
    </Modal>
  )
}
