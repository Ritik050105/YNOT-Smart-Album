import { useProjectStore } from '@/state/projectStore'
import { useBottomDockResize } from '@/engine/useBottomDockResize'
import PanelResizer from '@/components/PanelResizer'
import MenuBar from './MenuBar'
import TopBar from './TopBar'
import AlbumInfoPanel from './AlbumInfoPanel'
import Inspector from './Inspector'
import PhotoBin from './PhotoBin'
import SpreadsPanel from './SpreadsPanel'
import MatchingTemplatesPanel from './MatchingTemplatesPanel'
import KeyboardShortcuts from './KeyboardShortcuts'
import GlobalDropZone from './GlobalDropZone'
import MissingColorProfileDialog from './MissingColorProfileDialog'
import MissingImagesDialog from './MissingImagesDialog'
import CoverSetup from './CoverSetup'
import Icon from './Icon'

/** The album editor: menus, the spread overview, the photo dock and the side panels.
 *
 *  Split out of App so it can be loaded on demand. It pulls in nearly everything heavy the app
 *  has — the canvas, the template library, the PSD reader — none of which the home screen needs,
 *  and all of which was being parsed before the first screen could paint. */
export default function EditorScreen() {
  const rightPanelOpen = useProjectStore((s) => s.rightPanelOpen)
  const toggleRightPanel = useProjectStore((s) => s.toggleRightPanel)
  const matchingTemplatesOpen = useProjectStore((s) => s.matchingTemplatesOpen)
  const selectedPlaceholderId = useProjectStore((s) => s.selectedPlaceholderId)
  const selectedTextBoxId = useProjectStore((s) => s.selectedTextBoxId)
  const { bottomPanelOpen, handleMouseDown: handleBottomHandleMouseDown } = useBottomDockResize()

  return (
    <div className="app-shell album-editor">
      <KeyboardShortcuts />
      <GlobalDropZone />
      <CoverSetup />
      <MissingColorProfileDialog />
      <MissingImagesDialog />
      <MenuBar />
      <TopBar />
      <div className="editor-workspace">
      <div className="editor-workspace__content">
      <MatchingTemplatesPanel />
      <div className="app-body">
        <main className="app-main">
          <SpreadsPanel />
        </main>
        <button
          className="panel-toggle panel-toggle--right"
          onClick={toggleRightPanel}
          title={rightPanelOpen ? 'Collapse right panel' : 'Expand right panel'}
        >
          <Icon name={rightPanelOpen ? 'chevronRight' : 'chevronLeft'} size={12} />
        </button>
      </div>
      <div className="bottom-panel" hidden={matchingTemplatesOpen}>
        <button
          className="panel-toggle panel-toggle--bottom"
          onMouseDown={handleBottomHandleMouseDown}
          title={bottomPanelOpen ? 'Drag to resize, click to collapse the photo dock' : 'Expand photo dock'}
        >
          <Icon name={bottomPanelOpen ? 'chevronDown' : 'chevronUp'} size={12} />
        </button>
        {bottomPanelOpen && <PhotoBin />}
      </div>
      </div>
      {rightPanelOpen && <PanelResizer axis="x" variable="--inspector-width" label="Resize right panel" initial={320} min={240} max={0.45}/>}
      {rightPanelOpen && <aside className="app-sidebar app-sidebar--right" aria-label="Album sidebar">{selectedPlaceholderId || selectedTextBoxId ? <Inspector /> : <AlbumInfoPanel />}</aside>}
      </div>
    </div>
  )
}
