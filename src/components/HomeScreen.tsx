import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { openProjectFromFile, openProjectFromPath } from '@/engine/projectFile'
import { loadRecentProjects, recordRecentProject, removeRecentProject, RecentProjectEntry } from '@/engine/recentProjects'
import { finishNewProjectSetup } from '@/engine/newProjectFlow'
import NewProjectWizard from './NewProjectWizard'
import Modal from './Modal'
import Icon from './Icon'
import ynotMark from '@/assets/ynot-mark-white.png'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

type HomeTab = 'albums' | 'galleries' | 'slideshows'
const HOME_TABS: { id: HomeTab; label: string }[] = [
  { id: 'albums', label: 'Albums' },
  { id: 'galleries', label: 'Galleries' },
  { id: 'slideshows', label: 'Slideshows' },
]

const KIND_FOR_TAB: Record<HomeTab, 'album' | 'gallery' | 'slideshow'> = {
  albums: 'album',
  galleries: 'gallery',
  slideshows: 'slideshow',
}

/** The app's landing screen — shown first on launch (and reachable any time via the brand mark),
 *  matching the reference app's own "pick an album or start a new one" dashboard: the
 *  Albums/Galleries/Slideshows tab row and the "+ New Project" split menu. Galleries and
 *  Slideshows are lighter-weight project kinds (no spread/template machinery) that open their
 *  own dedicated screen — GalleryScreen's flat favorite-marking grid, or SlideshowScreen's
 *  ordered play-through — instead of the album editor. */
export default function HomeScreen() {
  const loadProjectFile = useProjectStore((s) => s.loadProjectFile)
  const setPreparingProject = useProjectStore((s) => s.setPreparingProject)
  const createSimpleProject = useProjectStore((s) => s.createSimpleProject)
  const [tab, setTab] = useState<HomeTab>('albums')
  const [recent, setRecent] = useState<RecentProjectEntry[]>(() => loadRecentProjects())
  const [search, setSearch] = useState('')
  const [newProjectMenuOpen, setNewProjectMenuOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [simpleCreate, setSimpleCreate] = useState<{ kind: 'gallery' | 'slideshow'; name: string; clientName: string } | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)
  const newProjectMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!newProjectMenuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (newProjectMenuRef.current && !newProjectMenuRef.current.contains(e.target as Node)) setNewProjectMenuOpen(false)
    }
    window.addEventListener('mousedown', onClickOutside)
    return () => window.removeEventListener('mousedown', onClickOutside)
  }, [newProjectMenuOpen])

  function enterEditor() {
    window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))
  }

  async function handleAlbumCreated() {
    setPreparingProject(true)
    const { project, userTemplates } = useProjectStore.getState()
    await finishNewProjectSetup(project, userTemplates)
    setPreparingProject(false)
    enterEditor()
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
        kind: opened.file.project.kind,
      })
      enterEditor()
    }
  }

  function handleCreateSimple(kind: 'gallery' | 'slideshow') {
    setNewProjectMenuOpen(false)
    setSimpleCreate({ kind, name: kind === 'gallery' ? 'Untitled Gallery' : 'Untitled Slideshow', clientName: '' })
  }

  function confirmCreateSimple() {
    if (!simpleCreate || !simpleCreate.name.trim()) return
    createSimpleProject(simpleCreate.kind, simpleCreate.name.trim(), simpleCreate.clientName.trim())
    setSimpleCreate(null)
    enterEditor()
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

  const activeKind = KIND_FOR_TAB[tab]
  const forTab = recent.filter((e) => (e.kind ?? 'album') === activeKind)
  const visibleRecent = search.trim()
    ? forTab.filter(
        (e) =>
          e.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          e.clientName?.toLowerCase().includes(search.trim().toLowerCase())
      )
    : forTab

  const tabLabel = tab === 'albums' ? 'album' : tab === 'galleries' ? 'gallery' : 'slideshow'

  return (
    <div className="home-screen">
      <header className="home-screen__header">
        <span className="home-screen__mark">
          <img src={ynotMark} alt="YNOT Photography" />
        </span>
        <h1>YNOT Album Studio</h1>
      </header>

      <div className="home-tabs">
        {HOME_TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="home-screen__toolbar">
        <div className="home-screen__search">
          <Icon name="search" size={14} />
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="home-screen__toolbar-actions">
          <button className="btn btn--icon" title="Open Project…" onClick={() => void handleOpenAny()}>
            <Icon name="folder" size={14} />
          </button>
          <div className="split-button" ref={newProjectMenuRef}>
            <button className="btn btn--primary" onClick={() => setNewProjectMenuOpen((o) => !o)}>
              <Icon name="plus" size={14} />
              New Project
              <Icon name="chevronDown" size={12} />
            </button>
            {newProjectMenuOpen && (
              <div className="split-button__menu">
                <button
                  onClick={() => {
                    setNewProjectMenuOpen(false)
                    openNewProjectUI()
                  }}
                >
                  Album
                </button>
                <button onClick={() => handleCreateSimple('gallery')}>Gallery</button>
                <button onClick={() => handleCreateSimple('slideshow')}>Slideshow</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {openError && <p className="home-screen__error">{openError}</p>}

      {visibleRecent.length === 0 ? (
        <div className="home-screen__empty">
          <Icon name="bookOpen" size={32} />
          <p>There are no {tab}</p>
          <p className="muted">
            {tab === 'albums'
              ? 'Create an album and share it with your clients.'
              : tab === 'galleries'
                ? 'Create a gallery to collect client favorites.'
                : 'Create a slideshow to play through a shoot.'}
          </p>
          <button
            className="btn btn--primary"
            onClick={() => (tab === 'albums' ? openNewProjectUI() : handleCreateSimple(activeKind as 'gallery' | 'slideshow'))}
          >
            Create {tabLabel[0].toUpperCase() + tabLabel.slice(1)}
          </button>
        </div>
      ) : (
        <div className="home-screen__grid">
          {visibleRecent.map((entry) => (
            <button
              key={entry.projectId}
              className="home-card"
              disabled={opening === entry.projectId}
              onClick={() => void handleOpenRecent(entry)}
            >
              <div className="home-card__thumb">
                <Icon name={tab === 'albums' ? 'bookOpen' : tab === 'galleries' ? 'image' : 'play'} size={28} />
              </div>
              <div className="home-card__body">
                <span className="home-card__name">{entry.name}</span>
                {entry.clientName && <span className="home-card__client">{entry.clientName}</span>}
                <span className="home-card__meta">
                  {tab === 'albums'
                    ? `${entry.sizeLabel} · ${entry.spreadCount} spread${entry.spreadCount === 1 ? '' : 's'}`
                    : tab === 'galleries'
                      ? 'Gallery'
                      : 'Slideshow'}
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
        <NewProjectWizard onClose={() => setNewProjectOpen(false)} onCreated={() => void handleAlbumCreated()} />
      )}

      {simpleCreate && (
        <Modal
          title={`New ${simpleCreate.kind === 'gallery' ? 'Gallery' : 'Slideshow'}`}
          onClose={() => setSimpleCreate(null)}
          width={360}
          footer={
            <>
              <button className="btn" onClick={() => setSimpleCreate(null)}>
                Cancel
              </button>
              <div className="footer-spacer" />
              <button className="btn btn--primary" disabled={!simpleCreate.name.trim()} onClick={confirmCreateSimple}>
                Create
              </button>
            </>
          }
        >
          <label className="field">
            Name
            <input
              autoFocus
              value={simpleCreate.name}
              onChange={(e) => setSimpleCreate({ ...simpleCreate, name: e.target.value })}
            />
          </label>
          <label className="field">
            Client name (optional)
            <input
              value={simpleCreate.clientName}
              onChange={(e) => setSimpleCreate({ ...simpleCreate, clientName: e.target.value })}
            />
          </label>
        </Modal>
      )}
    </div>
  )
}
