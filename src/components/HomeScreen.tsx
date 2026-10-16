import { useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { openProjectFromFile, openProjectFromPath } from '@/engine/projectFile'
import { loadRecentProjects, recordRecentProject, removeRecentProject, RecentProjectEntry } from '@/engine/recentProjects'
import NewProjectWizard from './NewProjectWizard'
import Icon from './Icon'
import ynotMark from '@/assets/ynot-mark-white.png'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** The app's landing screen — shown first on launch (and reachable any time via the brand mark),
 *  matching the reference app's own "pick an album or start a new one" dashboard instead of
 *  dropping straight into an empty, unnamed editor. Deliberately doesn't replicate the reference
 *  app's Galleries/Slideshows tabs or its trial/upgrade banner — those aren't real features or
 *  policies of this app, so a tab/banner for them would just be decoration pretending otherwise. */
export default function HomeScreen() {
  const loadProjectFile = useProjectStore((s) => s.loadProjectFile)
  const [recent, setRecent] = useState<RecentProjectEntry[]>(() => loadRecentProjects())
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)

  function enterEditor() {
    window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))
  }

  function openNewProjectUI() {
    // In Electron this opens a genuinely separate OS window (matching the reference app); the
    // in-page modal is kept only as a fallback for the browser dev preview.
    if (window.albumStudio?.isElectron) {
      void window.albumStudio.openNewProjectWindow()
    } else {
      setNewProjectOpen(true)
    }
  }

  async function handleOpenAny() {
    setOpenError(null)
    const opened = await openProjectFromFile().catch((err) => {
      setOpenError(err instanceof Error ? err.message : 'Could not open that project file.')
      return null
    })
    if (opened) {
      loadProjectFile(opened.file)
      recordRecentProject({
        projectId: opened.file.project.id,
        name: opened.file.project.name,
        clientName: opened.file.project.clientName,
        sizeLabel: opened.file.project.size.label,
        filePath: opened.filePath,
        spreadCount: opened.file.project.spreads.filter((s) => !s.isCover).length,
      })
      enterEditor()
    }
  }

  async function handleOpenRecent(entry: RecentProjectEntry) {
    if (!entry.filePath) {
      void handleOpenAny()
      return
    }
    setOpening(entry.projectId)
    setOpenError(null)
    const file = await openProjectFromPath(entry.filePath)
    setOpening(null)
    if (!file) {
      setOpenError(`Couldn't find "${entry.name}" — it may have moved. Use Open Project to locate it.`)
      return
    }
    loadProjectFile(file)
    recordRecentProject({ ...entry })
    enterEditor()
  }

  function handleRemoveRecent(e: React.MouseEvent, projectId: string) {
    e.stopPropagation()
    setRecent(removeRecentProject(projectId))
  }

  return (
    <div className="home-screen">
      <header className="home-screen__header">
        <span className="home-screen__mark">
          <img src={ynotMark} alt="YNOT Photography" />
        </span>
        <h1>YNOT Album Studio</h1>
      </header>

      <div className="home-screen__toolbar">
        <h2>Albums</h2>
        <div className="home-screen__toolbar-actions">
          <button className="btn" onClick={() => void handleOpenAny()}>
            <Icon name="folder" size={14} />
            Open Project…
          </button>
          <button className="btn btn--primary" onClick={openNewProjectUI}>
            <Icon name="plus" size={14} />
            New Project
          </button>
        </div>
      </div>

      {openError && <p className="home-screen__error">{openError}</p>}

      {recent.length === 0 ? (
        <div className="home-screen__empty">
          <Icon name="bookOpen" size={32} />
          <p>There are no albums yet.</p>
          <p className="muted">Create an album to start designing — it'll show up here next time.</p>
          <button className="btn btn--primary" onClick={openNewProjectUI}>
            <Icon name="plus" size={14} />
            Create Album
          </button>
        </div>
      ) : (
        <div className="home-screen__grid">
          {recent.map((entry) => (
            <button
              key={entry.projectId}
              className="home-card"
              disabled={opening === entry.projectId}
              onClick={() => void handleOpenRecent(entry)}
            >
              <div className="home-card__thumb">
                <Icon name="bookOpen" size={28} />
              </div>
              <div className="home-card__body">
                <span className="home-card__name">{entry.name}</span>
                {entry.clientName && <span className="home-card__client">{entry.clientName}</span>}
                <span className="home-card__meta">
                  {entry.sizeLabel} · {entry.spreadCount} spread{entry.spreadCount === 1 ? '' : 's'}
                </span>
                <span className="home-card__date">Updated {formatDate(entry.updatedAt)}</span>
              </div>
              <span className="home-card__remove" onClick={(e) => handleRemoveRecent(e, entry.projectId)} title="Remove from list">
                <Icon name="x" size={12} />
              </span>
              {opening === entry.projectId && <span className="home-card__loading">Opening…</span>}
            </button>
          ))}
        </div>
      )}

      {newProjectOpen && (
        <NewProjectWizard onClose={() => setNewProjectOpen(false)} onCreated={enterEditor} />
      )}
    </div>
  )
}
