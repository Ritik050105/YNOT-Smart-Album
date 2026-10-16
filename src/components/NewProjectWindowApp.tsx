import NewProjectWizard from './NewProjectWizard'
import { NewProjectOptions } from '@/state/projectStore'

/** Rendered instead of <App /> when this window was opened as the dedicated "New Project" OS
 *  window (see src/main.tsx routing on the `?view=new-project` query flag). This window has its
 *  own isolated renderer process and Zustand store, so instead of creating the project directly
 *  it hands the finished options to the main process, which relays them to the main window and
 *  closes this one — matching the reference app's separate "New Project" window. */
export default function NewProjectWindowApp() {
  function handleSubmit(opts: NewProjectOptions) {
    void window.albumStudio?.submitNewProject(opts as never)
  }

  function handleClose() {
    void window.albumStudio?.closeCurrentWindow()
  }

  return (
    <div className="new-project-window">
      <NewProjectWizard bare onClose={handleClose} onSubmit={handleSubmit} />
    </div>
  )
}
