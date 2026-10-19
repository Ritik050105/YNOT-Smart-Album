/** Brief full-screen "Preparing template libraries…" transition shown between finishing the New
 *  Project wizard and landing in the editor — matches the reference app's own loading screen. */
export default function NewProjectLoadingOverlay() {
  return (
    <div className="new-project-loading">
      <p className="new-project-loading__title">Preparing template libraries...</p>
      <p className="muted">This may take several minutes.</p>
      <div className="new-project-loading__bar">
        <div className="new-project-loading__bar-fill" />
      </div>
    </div>
  )
}
