import ynotMark from '@/assets/ynot-mark-white.png'

interface Props {
  title?: string
  subtitle?: string
}

/** Brief full-screen loading transition — used both between finishing the New Project wizard and
 *  landing in the editor ("Preparing template libraries…", matching the reference app's own
 *  loading screen) and while restoring the last session's project on launch. */
export default function NewProjectLoadingOverlay({
  title = 'Preparing template libraries...',
  subtitle = 'This may take several minutes.',
}: Props) {
  return (
    <div className="new-project-loading" role="status" aria-label={`${title} ${subtitle}`}>
      <div className="new-project-loading__mark"><img src={ynotMark} alt="YNOT Photography" /></div>
    </div>
  )
}
