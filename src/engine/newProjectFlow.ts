import { Project, TemplateDefinition } from '@/types'
import { saveProjectToFile } from './projectFile'
import { recordRecentProject } from './recentProjects'

/** Runs right after a brand-new project is created (wizard "Start"), before the editor appears —
 *  mirrors the reference app's own flow of picking a save location up front, then a brief
 *  "Preparing template libraries…" beat, then the editor. In the browser dev preview (no native
 *  Save dialog available) this just shows the "preparing" beat on its own. Cancelling the save
 *  dialog doesn't block entry — you still land in the editor, just without a file on disk yet
 *  (Save from the toolbar any time afterward). Returns the saved file's path (if the save
 *  happened and succeeded) so the caller can mark the project clean/locatable in the store —
 *  this module stays store-agnostic like the rest of engine/, so it hands the result back rather
 *  than reaching into useProjectStore itself. */
export async function finishNewProjectSetup(
  project: Project,
  userTemplates: TemplateDefinition[]
): Promise<{ filePath?: string }> {
  if (window.albumStudio?.isElectron) {
    const result = await saveProjectToFile(project, userTemplates)
    if (result.saved) {
      recordRecentProject({
        projectId: project.id,
        name: project.name,
        clientName: project.clientName,
        sizeLabel: project.size.label,
        filePath: result.filePath,
        spreadCount: project.spreads.filter((s) => !s.isCover).length,
        kind: project.kind,
      })
      await new Promise((resolve) => setTimeout(resolve, 450))
      return { filePath: result.filePath }
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 450))
  return {}
}
