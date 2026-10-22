import ynotMark from '@/assets/ynot-mark-dark.png'

interface Props {
  creating?: boolean
  title?: string
  subtitle?: string
}

/** Brief full-screen loading transition — used both between finishing the New Project wizard and
 *  landing in the editor ("Preparing template libraries…", matching the reference app's own
 *  loading screen) and while restoring the last session's project on launch. */
export default function NewProjectLoadingOverlay({
  creating = false,
  title = 'Preparing template libraries...',
  subtitle = 'This may take several minutes.',
}: Props) {
  return (
    <div className="new-project-loading" role="status" aria-label={`${title} ${subtitle}`}>
      {creating ? <div className="project-creating">
        <div className="project-creating__title">Creating project…</div>
        <p>Preparing your album and template library…</p>
        <progress aria-label="Creating project" />
      </div> : <div className="new-project-loading__mark"><img src={ynotMark} alt="YNOT Photography" /></div>}
    </div>
  )
}
