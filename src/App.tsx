import {recordRecentProject} from '@/engine/recentProjects'
import { Suspense, lazy, useEffect, useState } from 'react'

// Everything below the home screen is loaded on demand. The editor pulls in the canvas, the
// template library and the PSD reader — about half the bundle — and none of it is needed to
// show the album list, which is the first thing anyone sees.
const EditorScreen = lazy(() => import('./components/EditorScreen'))
const DesignerViewScreen = lazy(() => import('./components/DesignerViewScreen'))
const GalleryScreen = lazy(() => import('./components/GalleryScreen'))
const SlideshowScreen = lazy(() => import('./components/SlideshowScreen'))
import MissingImagesDialog from './components/MissingImagesDialog'
import { registerProjectFonts, ensureFontLoaded } from './engine/fonts'
import HomeScreen from './components/HomeScreen'
import NewProjectLoadingOverlay from './components/NewProjectLoadingOverlay'
import { useProjectStore } from '@/state/projectStore'
import { warmTemplateLibrary } from '@/engine/templates'
import { finishNewProjectSetup } from '@/engine/newProjectFlow'
import { deserializeProjectFile, serializeProjectFile, openProjectFromPath, saveProjectToFile } from '@/engine/projectFile'
import { loadOpenSession, persistRecovery, invalidateRecovery, clearOpenSession, OpenSessionMarker } from '@/engine/sessionMarker'
import { ProjectFile } from '@/types'
import ContinueSessionPrompt from './components/ContinueSessionPrompt'
import Modal from './components/Modal'

export default function App() {
  const customFonts = useProjectStore(s=>s.project.customFonts)
  useEffect(()=>{ registerProjectFonts(customFonts ?? []); for(const f of customFonts ?? []) void ensureFontLoaded(f.family).catch(console.error) },[customFonts])
  const [resumePrompt, setResumePrompt] = useState<OpenSessionMarker | null>(null)
  const [recoveryFile, setRecoveryFile] = useState<ProjectFile | null>(null)
  const [recoveryChecked, setRecoveryChecked] = useState(!window.albumStudio?.isElectron)
  const [recoveryError, setRecoveryError] = useState('')
  const [recoveryRetry, setRecoveryRetry] = useState(0)
  useEffect(() => {
    if (!window.albumStudio?.isElectron) return
    let active = true
    void window.albumStudio.readRecovery().then((snapshot) => {
      if (!active) return
      const legacy = loadOpenSession()
      if (snapshot) {
        const file = deserializeProjectFile(snapshot.contents)
        setRecoveryFile(file)
        setResumePrompt({ projectId: file.project.id, filePath: snapshot.filePath,
          name: file.project.name, clientName: file.project.clientName, sizeLabel: file.project.size.label,
          spreadCount: file.project.spreads.filter((spread) => !spread.isCover).length, hasRecovery: true })
      } else if (legacy && !legacy.hasRecovery) setResumePrompt(legacy)
      setRecoveryError('')
      setRecoveryChecked(true)
    }).catch((error) => { if (active) setRecoveryError(`Could not read the recovery copy: ${String(error)}`) })
    return () => { active = false }
  }, [recoveryRetry])
  useEffect(() => {
    const onError = (event: Event) => setRecoveryError((event as CustomEvent<string>).detail)
    window.addEventListener('album-studio:recovery-error', onError)
    return () => window.removeEventListener('album-studio:recovery-error', onError)
  }, [])
  useEffect(() => { if (recoveryChecked && recoveryError) window.alert(recoveryError) }, [recoveryChecked, recoveryError])
  const [resuming, setResuming] = useState(false)
  const [showHome, setShowHome] = useState(true)
  const createProjectFromWizard = useProjectStore((s) => s.createProjectFromWizard)
  const loadProjectFile = useProjectStore((s) => s.loadProjectFile)
  const preparingProject = useProjectStore((s) => s.preparingProject)
  const designerViewSpreadId = useProjectStore((s) => s.designerViewSpreadId)
  const setPreparingProject = useProjectStore((s) => s.setPreparingProject)
  const markSaved = useProjectStore((s) => s.markSaved)
  const setCurrentFilePath = useProjectStore((s) => s.setCurrentFilePath)
  const project = useProjectStore((s) => s.project)
  const revealLeftPanel = useProjectStore((s) => s.revealLeftPanel)
  // The layouts for this album's shape are assembled in the background once the editor is open,
  // so the first template browser or Auto Build does not wait for them.
  const albumAspect = project.size.widthIn / project.size.heightIn
  useEffect(() => { if (!showHome) warmTemplateLibrary(albumAspect) }, [albumAspect, showHome])
  const projectKind = project.kind
  useEffect(() => {
    const preventUnsavedClose = (event: BeforeUnloadEvent) => {
      if (!useProjectStore.getState().isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventUnsavedClose)
    return () => window.removeEventListener('beforeunload', preventUnsavedClose)
  }, [])

  useEffect(() => {
    function onEnterEditor() {
      setShowHome(false)
    }
    async function onGoHome() {
      const { project, userTemplates, currentFilePath, isDirty } = useProjectStore.getState()
      if (isDirty) {
        try {
          const result = await saveProjectToFile(project, userTemplates, currentFilePath)
          if (!result.saved) return // user canceled the save location dialog; stay in the editor
          const current = useProjectStore.getState()
          const unchanged = current.project === project && current.userTemplates === userTemplates
          if (current.project.id === project.id && result.filePath) current.setCurrentFilePath(result.filePath)
          if (!unchanged) { window.alert('The album changed while saving. Your latest edits are still open; try again before leaving.'); return }
          current.markSaved()
        } catch (error) {
          window.alert(error instanceof Error ? error.message : 'Could not save the album. Your edits are still open.')
          return
        }
      }
      setShowHome(true)
    }
    window.addEventListener('album-studio:enter-editor', onEnterEditor)
    window.addEventListener('album-studio:go-home', onGoHome)
    return () => {
      window.removeEventListener('album-studio:enter-editor', onEnterEditor)
      window.removeEventListener('album-studio:go-home', onGoHome)
    }
  }, [])

  // The main window is the one true store — a separate "New Project" OS window hands its
  // finished options back here over IPC instead of creating the project in its own isolated store.
  useEffect(() => {
    if (!window.albumStudio) return
    return window.albumStudio.onNewProjectCreated((opts) => {
      // A pending "Continue where you left off?" prompt is drawn instead of the editor, so a new project would stay hidden behind it (blank window).
      handleStartFresh()
      createProjectFromWizard(opts as never)
      setPreparingProject(true)
      const { project: created, userTemplates } = useProjectStore.getState()
      void finishNewProjectSetup(created, userTemplates).then(({ filePath }) => {
        if (filePath) {
          markSaved()
          setCurrentFilePath(filePath)
        }
        setPreparingProject(false)
        window.dispatchEvent(new CustomEvent('album-studio:enter-editor'))
      })
    })
  }, [createProjectFromWizard, setPreparingProject, markSaved, setCurrentFilePath])

  useEffect(()=>{
    if(!window.albumStudio?.isElectron||!recoveryChecked||resumePrompt)return
    let busy = false, disposed = false
    let lastSnapshot: ReturnType<typeof useProjectStore.getState> | null = null
    let queued = false
    const save = async () => {
      const latest = useProjectStore.getState()
      if (busy || disposed || latest.project.id !== project.id) return
      if (!latest.isDirty) {
        if (lastSnapshot) { clearOpenSession(); lastSnapshot = null }
        return
      }
      if (lastSnapshot?.project === latest.project && lastSnapshot.userTemplates === latest.userTemplates && lastSnapshot.currentFilePath === latest.currentFilePath) return
      busy = true
      try {
        await persistRecovery(serializeProjectFile(latest.project, latest.userTemplates, true), {
          projectId: latest.project.id, filePath: latest.currentFilePath,
          name: latest.project.name, clientName: latest.project.clientName,
          sizeLabel: latest.project.size.label,
          spreadCount: latest.project.spreads.filter(s => !s.isCover).length,
        })
        if (!disposed) { lastSnapshot = latest; setRecoveryError('') }
      } catch (error) {
        if (!disposed) setRecoveryError(`Recovery copy could not be updated. Save your album: ${String(error)}`)
      } finally {
        busy = false
        const current = useProjectStore.getState()
        if (current.project !== latest.project || current.userTemplates !== latest.userTemplates || current.currentFilePath !== latest.currentFilePath || current.isDirty !== latest.isDirty) saveNow()
      }
    }
    const saveNow = () => {
      if (queued || disposed) return
      queued = true
      queueMicrotask(() => { queued = false; void save() })
    }
    const unsubscribe = useProjectStore.subscribe((next, previous) => {
      if (next.project !== previous.project || next.userTemplates !== previous.userTemplates || next.currentFilePath !== previous.currentFilePath || next.isDirty !== previous.isDirty) {
        if (!next.isDirty || next.project.id !== project.id) invalidateRecovery()
        saveNow()
      }
    })
    const timer = window.setInterval(saveNow, 2000)
    window.addEventListener('blur', saveNow)
    saveNow()
    return () => {
      disposed = true
      unsubscribe()
      window.clearInterval(timer)
      window.removeEventListener('blur', saveNow)
      invalidateRecovery()
    }
  },[resumePrompt,recoveryChecked,project.id])

  useEffect(()=>{
    const bridge=window.albumStudio
    if(!bridge?.isElectron||!bridge.onProjectOpen||!recoveryChecked||resumePrompt)return
    let opening=false
    const open=async()=>{
      if(opening)return
      opening=true
      try {const filePath=await bridge.takePendingProject();if(!filePath)return
        if(useProjectStore.getState().isDirty&&!window.confirm('Open this album and discard unsaved changes to the current album?'))return
        const file=await openProjectFromPath(filePath);if(!file)throw new Error('This album could not be opened.')
        loadProjectFile(file);setCurrentFilePath(filePath);setShowHome(false);revealLeftPanel();clearOpenSession();recordRecentProject({projectId:file.project.id,createdAt:file.project.createdAt,name:file.project.name,clientName:file.project.clientName,sizeLabel:file.project.size.label,filePath,spreadCount:file.project.spreads.filter(s=>!s.isCover).length,kind:file.project.kind})
      }catch(error){window.alert(String(error))}finally{opening=false}
    }
    const off=bridge.onProjectOpen(()=>void open());void open();return off
  },[recoveryChecked,resumePrompt,loadProjectFile,setCurrentFilePath,revealLeftPanel])

  async function handleContinueSession() {
    if (!resumePrompt) return
    setResuming(true)
    try {
      const file = recoveryFile ?? (resumePrompt.filePath ? await openProjectFromPath(resumePrompt.filePath) : null)
      if (!file) throw new Error('The saved album could not be found.')
      loadProjectFile(file)
      setCurrentFilePath(resumePrompt.filePath)
      if (recoveryFile) useProjectStore.setState({ isDirty: true })
      setResumePrompt(null)
      setRecoveryFile(null)
      setShowHome(false)
      revealLeftPanel()
    } catch (error) { window.alert(String(error)) }
    finally { setResuming(false) }
  }

  function handleStartFresh() {
    clearOpenSession()
    setResumePrompt(null)
    setRecoveryFile(null)
  }

  if (!recoveryChecked) return recoveryError ? (
    <Modal title="Album recovery needs attention" onClose={() => setRecoveryRetry((value) => value + 1)}
      footer={<>
        <button className="btn" onClick={() => setRecoveryRetry((value) => value + 1)}>Retry Recovery</button>
        <button className="btn" onClick={() => { clearOpenSession(); setRecoveryError(''); setRecoveryChecked(true) }}>Discard Recovery Copy</button>
      </>}>
      <p role="alert">{recoveryError}</p>
    </Modal>
  ) : <NewProjectLoadingOverlay />

  if (resumePrompt) {
    return (
      <ContinueSessionPrompt
        marker={resumePrompt}
        busy={resuming}
        onContinue={() => void handleContinueSession()}
        onStartFresh={handleStartFresh}
      />
    )
  }

  if (preparingProject) return <NewProjectLoadingOverlay creating title="Creating project" subtitle="Preparing your album and template library" />

  if (showHome) return <HomeScreen />

  // One boundary for all of them: the chunk is small and local, so this is a flash at most, but
  // without it React throws the moment a lazy screen is first reached.
  return (
    <Suspense fallback={<NewProjectLoadingOverlay creating title="Loading" subtitle="Opening the album editor" />}>
      {projectKind === 'gallery' ? <GalleryScreen />
        : projectKind === 'slideshow' ? <SlideshowScreen />
        : designerViewSpreadId ? <><MissingImagesDialog /><DesignerViewScreen /></>
        : <EditorScreen />}
    </Suspense>
  )
}

