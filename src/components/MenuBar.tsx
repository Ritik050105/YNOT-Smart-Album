import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { importPhotoFiles } from '@/engine/importPhotos'
import { TemplateFrameFilter } from '@/engine/templates'
import { Theme, applyTheme, getStoredTheme } from '@/engine/theme'
import Icon from './Icon'

interface MenuItem {
  label: string
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
}

interface MenuSpec {
  label: string
  items: MenuItem[]
}

const FRAME_FILTERS: { value: TemplateFrameFilter; label: string }[] = [
  { value: 'all', label: 'All Templates' },
  { value: 'no-square', label: 'Templates without square frames' },
  { value: 'only-3x2', label: 'Templates only with 3:2 frame ratios' },
]

/** Classic desktop-app menu bar (File/Edit/Frame/Cover/Spread/Templates/Tools/View/Help) sitting
 *  above the toolbar — the structural piece of the reference app's chrome that the client already
 *  knows from SmartAlbums, so switching to this app needs less re-learning. Every item reuses an
 *  action the toolbar/panels already expose (via direct store calls or the same window events
 *  TopBar/Inspector/ImportPanel/DesignerCanvas listen for) rather than duplicating logic.
 *
 *  A few reference items aren't here because they need infrastructure this app doesn't have
 *  (OS-level "Show in Explorer"/"Open in Photo Viewer", license/account management) — skipped
 *  rather than faked. */
export default function MenuBar() {
  const project = useProjectStore((s) => s.project)
  const addPhotos = useProjectStore((s) => s.addPhotos)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const selectedPlaceholderId = useProjectStore((s) => s.selectedPlaceholderId)
  const selectedTextBoxId = useProjectStore((s) => s.selectedTextBoxId)
  const multiSelectedPlaceholderIds = useProjectStore((s) => s.multiSelectedPlaceholderIds)
  const toneClipboard = useProjectStore((s) => s.toneClipboard)
  const photoClipboard = useProjectStore((s) => s.photoClipboard)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const history = useProjectStore((s) => s.history)
  const future = useProjectStore((s) => s.future)
  const flipSpread = useProjectStore((s) => s.flipSpread)
  const addBlankSpread = useProjectStore((s) => s.addBlankSpread)
  const addCoverSpread = useProjectStore((s) => s.addCoverSpread)
  const deleteSpread = useProjectStore((s) => s.deleteSpread)
  const applyTemplateToAllSpreads = useProjectStore((s) => s.applyTemplateToAllSpreads)
  const updatePlacement = useProjectStore((s) => s.updatePlacement)
  const updateMultiplePlacements = useProjectStore((s) => s.updateMultiplePlacements)
  const resetPlacementToOriginal = useProjectStore((s) => s.resetPlacementToOriginal)
  const autoAlignPlacement = useProjectStore((s) => s.autoAlignPlacement)
  const autoAdjustPlacement = useProjectStore((s) => s.autoAdjustPlacement)
  const setPlacementPhoto = useProjectStore((s) => s.setPlacementPhoto)
  const copyToneAdjustments = useProjectStore((s) => s.copyToneAdjustments)
  const pasteToneAdjustments = useProjectStore((s) => s.pasteToneAdjustments)
  const copyPlacement = useProjectStore((s) => s.copyPlacement)
  const pastePlacement = useProjectStore((s) => s.pastePlacement)
  const cutPlacement = useProjectStore((s) => s.cutPlacement)
  const removeTextBox = useProjectStore((s) => s.removeTextBox)
  const selectPlaceholder = useProjectStore((s) => s.selectPlaceholder)
  const selectTextBox = useProjectStore((s) => s.selectTextBox)
  const clearMultiSelect = useProjectStore((s) => s.clearMultiSelect)
  const setSelectedPhotoIds = useProjectStore((s) => s.setSelectedPhotoIds)
  const showGrid = useProjectStore((s) => s.showGrid)
  const toggleGrid = useProjectStore((s) => s.toggleGrid)
  const showPrintGuides = useProjectStore((s) => s.showPrintGuides)
  const togglePrintGuides = useProjectStore((s) => s.togglePrintGuides)
  const showGuides = useProjectStore((s) => s.showGuides)
  const toggleGuides = useProjectStore((s) => s.toggleGuides)
  const addGuide = useProjectStore((s) => s.addGuide)
  const showTimelinePanel = useProjectStore((s) => s.showTimelinePanel)
  const toggleTimelinePanel = useProjectStore((s) => s.toggleTimelinePanel)
  const leftPanelOpen = useProjectStore((s) => s.leftPanelOpen)
  const toggleLeftPanel = useProjectStore((s) => s.toggleLeftPanel)
  const rightPanelOpen = useProjectStore((s) => s.rightPanelOpen)
  const toggleRightPanel = useProjectStore((s) => s.toggleRightPanel)
  const bottomPanelOpen = useProjectStore((s) => s.bottomPanelOpen)
  const toggleBottomPanel = useProjectStore((s) => s.toggleBottomPanel)
  const canvasTool = useProjectStore((s) => s.canvasTool)
  const setCanvasTool = useProjectStore((s) => s.setCanvasTool)
  const templateFrameFilter = useProjectStore((s) => s.templateFrameFilter)
  const setTemplateFrameFilter = useProjectStore((s) => s.setTemplateFrameFilter)
  const showPhotoFileNames = useProjectStore((s) => s.showPhotoFileNames)
  const toggleShowPhotoFileNames = useProjectStore((s) => s.toggleShowPhotoFileNames)

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(getStoredTheme)
  const [newGuideOpen, setNewGuideOpen] = useState(false)
  const [newGuideAxis, setNewGuideAxis] = useState<'horizontal' | 'vertical'>('vertical')
  const [newGuidePosition, setNewGuidePosition] = useState(50)
  const rootRef = useRef<HTMLDivElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!openMenu) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    window.addEventListener('mousedown', onClickOutside)
    return () => window.removeEventListener('mousedown', onClickOutside)
  }, [openMenu])

  const hasCover = project.spreads.some((s) => s.isCover)
  const spread = project.spreads.find((s) => s.id === selectedSpreadId)
  const hasSpread = !!spread
  const framePlaceholderIds = multiSelectedPlaceholderIds.length > 0
    ? multiSelectedPlaceholderIds
    : selectedPlaceholderId
      ? [selectedPlaceholderId]
      : []
  const hasFrameSelection = framePlaceholderIds.length > 0
  const singlePlacement = spread && framePlaceholderIds.length === 1
    ? spread.placements.find((p) => p.placeholderId === framePlaceholderIds[0])
    : undefined
  const hasPhotoInSelection = framePlaceholderIds.some(
    (id) => spread?.placements.find((p) => p.placeholderId === id)?.photoId
  )

  function run(fn: () => void) {
    fn()
    setOpenMenu(null)
  }

  function copyFilenames() {
    if (!spread) return
    const names = framePlaceholderIds
      .map((id) => spread.placements.find((p) => p.placeholderId === id)?.photoId)
      .map((photoId) => (photoId ? project.photos.find((p) => p.id === photoId)?.fileName : null))
      .filter((n): n is string => !!n)
    if (names.length > 0) void navigator.clipboard?.writeText(names.join('\n')).catch(() => undefined)
  }

  function deleteSelection() {
    if (spread && selectedTextBoxId) {
      removeTextBox(spread.id, selectedTextBoxId)
      return
    }
    if (spread && framePlaceholderIds.length > 0) {
      framePlaceholderIds.forEach((id) => setPlacementPhoto(spread.id, id, null))
    }
  }

  function deselectAll() {
    selectPlaceholder(null)
    selectTextBox(null)
    clearMultiSelect()
    setSelectedPhotoIds([], null)
  }

  async function handleReplaceImage(file: File | undefined) {
    if (!file || !spread || !singlePlacement) return
    const { assets } = await importPhotoFiles([file])
    const asset = assets[0]
    if (!asset) return
    addPhotos([asset])
    setPlacementPhoto(spread.id, singlePlacement.placeholderId, asset.id)
  }

  const menus: MenuSpec[] = [
    {
      label: 'File',
      items: [
        { label: 'New Album', onClick: () => window.dispatchEvent(new CustomEvent('album-studio:new-project')) },
        { label: 'Open Project…', onClick: () => window.dispatchEvent(new CustomEvent('album-studio:open-project')) },
        { label: 'Save Project', shortcut: 'Ctrl+S', onClick: () => window.dispatchEvent(new CustomEvent('album-studio:save-project')) },
        { label: 'Save As…', onClick: () => window.dispatchEvent(new CustomEvent('album-studio:save-project')) },
        { label: 'Import Images…', shortcut: 'Ctrl+I', onClick: () => window.dispatchEvent(new CustomEvent('album-studio:import-images')) },
        {
          label: 'Export Album…',
          shortcut: 'Ctrl+E',
          disabled: project.spreads.length === 0,
          onClick: () => window.dispatchEvent(new CustomEvent('album-studio:open-export')),
        },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', disabled: history.length === 0, onClick: undo },
        { label: 'Redo', shortcut: 'Ctrl+Shift+Z', disabled: future.length === 0, onClick: redo },
        {
          label: 'Cut',
          disabled: !spread || framePlaceholderIds.length !== 1 || !hasPhotoInSelection,
          onClick: () => spread && cutPlacement(spread.id, framePlaceholderIds[0]),
        },
        {
          label: 'Copy',
          disabled: !spread || framePlaceholderIds.length !== 1 || !hasPhotoInSelection,
          onClick: () => spread && copyPlacement(spread.id, framePlaceholderIds[0]),
        },
        {
          label: 'Copy Tone Adjustments',
          shortcut: 'Ctrl+Shift+C',
          disabled: !spread || framePlaceholderIds.length !== 1,
          onClick: () => spread && copyToneAdjustments(spread.id, framePlaceholderIds[0]),
        },
        { label: 'Copy Filename(s)', disabled: !hasPhotoInSelection, onClick: copyFilenames },
        {
          label: 'Paste',
          disabled: !spread || !photoClipboard || !hasFrameSelection,
          onClick: () => spread && pastePlacement(spread.id, framePlaceholderIds),
        },
        {
          label: 'Paste Tone Adjustments',
          shortcut: 'Ctrl+Shift+V',
          disabled: !spread || !toneClipboard || !hasFrameSelection,
          onClick: () => spread && pasteToneAdjustments(spread.id, framePlaceholderIds),
        },
        {
          label: 'Delete',
          shortcut: 'Del',
          disabled: !selectedTextBoxId && !hasPhotoInSelection,
          danger: true,
          onClick: deleteSelection,
        },
        { label: 'Deselect All', onClick: deselectAll },
      ],
    },
    {
      label: 'Frame',
      items: [
        {
          label: 'Flip Image Horizontally',
          disabled: !singlePlacement,
          onClick: () => spread && singlePlacement && updatePlacement(spread.id, singlePlacement.placeholderId, { flipHorizontal: !singlePlacement.flipHorizontal }),
        },
        {
          label: 'Flip Image Vertically',
          disabled: !singlePlacement,
          onClick: () => spread && singlePlacement && updatePlacement(spread.id, singlePlacement.placeholderId, { flipVertical: !singlePlacement.flipVertical }),
        },
        {
          label: 'Reload from Original',
          shortcut: 'Ctrl+R',
          disabled: !singlePlacement,
          onClick: () => spread && singlePlacement && resetPlacementToOriginal(spread.id, singlePlacement.placeholderId),
        },
        {
          label: 'Auto Adjust',
          disabled: !hasPhotoInSelection,
          onClick: () => spread && framePlaceholderIds.forEach((id) => void autoAdjustPlacement(spread.id, id)),
        },
        {
          label: 'Auto Align',
          disabled: !hasPhotoInSelection,
          onClick: () => spread && framePlaceholderIds.forEach((id) => autoAlignPlacement(spread.id, id)),
        },
        {
          label: 'Replace Image…',
          shortcut: 'Ctrl+Shift+R',
          disabled: !singlePlacement,
          onClick: () => replaceInputRef.current?.click(),
        },
      ],
    },
    {
      label: 'Cover',
      items: [
        { label: 'Add Cover', disabled: hasCover, onClick: addCoverSpread },
        { label: 'Delete Cover', disabled: !hasCover, danger: true, onClick: () => { const cover = project.spreads.find((s) => s.isCover); if (cover) deleteSpread(cover.id) } },
      ],
    },
    {
      label: 'Spread',
      items: [
        { label: 'Flip Spread Horizontally', disabled: !hasSpread, onClick: () => spread && flipSpread(spread.id) },
        {
          label: 'Apply Template to All Spreads',
          disabled: !hasSpread,
          onClick: () => spread && applyTemplateToAllSpreads(spread.templateId),
        },
        { label: 'Add Blank Spread', onClick: addBlankSpread },
      ],
    },
    {
      label: 'Templates',
      items: FRAME_FILTERS.map((f) => ({
        label: `${templateFrameFilter === f.value ? '✓ ' : ''}${f.label}`,
        onClick: () => setTemplateFrameFilter(f.value),
      })),
    },
    {
      label: 'Tools',
      items: [
        { label: `${canvasTool === 'select' ? '✓ ' : ''}Selection Tool`, shortcut: 'V', onClick: () => setCanvasTool('select') },
        { label: `${canvasTool === 'pan' ? '✓ ' : ''}Hand Tool`, shortcut: 'H', onClick: () => setCanvasTool('pan') },
        { label: `${canvasTool === 'zoom' ? '✓ ' : ''}Zoom Tool`, shortcut: 'Z', onClick: () => setCanvasTool('zoom') },
        {
          label: 'Reset Panel Layout',
          onClick: () => {
            if (!leftPanelOpen) toggleLeftPanel()
            if (!rightPanelOpen) toggleRightPanel()
            if (!bottomPanelOpen) toggleBottomPanel()
          },
        },
        {
          label: 'Clear Undo History',
          disabled: history.length === 0 && future.length === 0,
          danger: true,
          onClick: () => useProjectStore.setState({ history: [], future: [] }),
        },
        {
          label: 'Preferences…',
          shortcut: 'Ctrl+Shift+P',
          onClick: () => {
            setTheme(getStoredTheme())
            setPreferencesOpen(true)
          },
        },
      ],
    },
    {
      label: 'View',
      items: [
        { label: `${showGrid ? '✓ ' : ''}Rule-of-Thirds Grid`, onClick: toggleGrid },
        { label: `${showPrintGuides ? '✓ ' : ''}Print Guides (Bleed / Safety)`, onClick: togglePrintGuides },
        { label: `${showGuides ? '✓ ' : ''}Guides`, onClick: toggleGuides },
        { label: 'New Guide…', disabled: !hasSpread, onClick: () => setNewGuideOpen(true) },
        { label: 'Fit Spread View', shortcut: 'Ctrl+0', onClick: () => window.dispatchEvent(new CustomEvent('album-studio:zoom-fit')) },
        { label: 'Zoom to 100%', onClick: () => window.dispatchEvent(new CustomEvent('album-studio:zoom-100')) },
        { label: `${showPhotoFileNames ? '✓ ' : ''}Show File Names in Image Browser`, onClick: toggleShowPhotoFileNames },
        { label: `${showTimelinePanel ? '✓ ' : ''}Timeline`, onClick: toggleTimelinePanel },
        { label: `${leftPanelOpen ? '✓ ' : ''}Left Panel`, onClick: toggleLeftPanel },
        { label: `${rightPanelOpen ? '✓ ' : ''}Right Panel`, onClick: toggleRightPanel },
        { label: `${bottomPanelOpen ? '✓ ' : ''}Photo Dock (Image Browser)`, onClick: toggleBottomPanel },
      ],
    },
    {
      label: 'Help',
      items: [
        {
          label: 'Keyboard & Mouse Shortcuts',
          shortcut: '?',
          onClick: () => window.dispatchEvent(new CustomEvent('album-studio:toggle-shortcuts-help')),
        },
        { label: 'About YNOT Album Studio…', onClick: () => setAboutOpen(true) },
      ],
    },
  ]

  return (
    <div className="menubar" ref={rootRef}>
      {menus.map((menu) => (
        <div key={menu.label} className="menubar__item">
          <button
            className={`menubar__label ${openMenu === menu.label ? 'is-open' : ''}`}
            onClick={() => setOpenMenu((m) => (m === menu.label ? null : menu.label))}
          >
            {menu.label}
          </button>
          {openMenu === menu.label && (
            <div className="menubar__dropdown">
              {menu.items.map((item) => (
                <button
                  key={item.label}
                  className={`menubar__dropdown-item ${item.danger ? 'is-danger' : ''}`}
                  disabled={item.disabled}
                  onClick={() => run(item.onClick)}
                >
                  <span>{item.label}</span>
                  {item.shortcut && <kbd>{item.shortcut}</kbd>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="menubar__spacer" />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void handleReplaceImage(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {newGuideOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setNewGuideOpen(false)}>
          <div className="modal-card" style={{ width: 340 }} role="dialog" aria-modal="true" aria-label="New Guide">
            <div className="modal-card__header">
              <div>
                <h2>New Guide</h2>
              </div>
              <button className="btn btn--icon btn--ghost" onClick={() => setNewGuideOpen(false)} aria-label="Close">
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="modal-card__body">
              <div className="tab-row">
                <button className={newGuideAxis === 'horizontal' ? 'is-active' : ''} onClick={() => setNewGuideAxis('horizontal')}>
                  Horizontal
                </button>
                <button className={newGuideAxis === 'vertical' ? 'is-active' : ''} onClick={() => setNewGuideAxis('vertical')}>
                  Vertical
                </button>
              </div>
              <label className="field">
                Position (% of {newGuideAxis === 'horizontal' ? 'height' : 'width'})
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={newGuidePosition}
                  onChange={(e) => setNewGuidePosition(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="modal-card__footer">
              <button className="btn" onClick={() => setNewGuideOpen(false)}>
                Cancel
              </button>
              <div className="footer-spacer" />
              <button
                className="btn btn--primary"
                disabled={!spread}
                onClick={() => {
                  if (spread) addGuide(spread.id, newGuideAxis, newGuidePosition / 100)
                  setNewGuideOpen(false)
                }}
              >
                Add Guide
              </button>
            </div>
          </div>
        </div>
      )}
      {preferencesOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setPreferencesOpen(false)}>
          <div className="modal-card" style={{ width: 360 }} role="dialog" aria-modal="true" aria-label="Preferences">
            <div className="modal-card__header">
              <div>
                <h2>Preferences</h2>
              </div>
              <button className="btn btn--icon btn--ghost" onClick={() => setPreferencesOpen(false)} aria-label="Close">
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="modal-card__body">
              <label className="field">
                Theme
                <select value={theme} onChange={(e) => { applyTheme(e.target.value as Theme); setTheme(e.target.value as Theme) }}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
            </div>
            <div className="modal-card__footer">
              <button className="btn btn--primary" onClick={() => setPreferencesOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {aboutOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setAboutOpen(false)}>
          <div className="modal-card" style={{ width: 360 }} role="dialog" aria-modal="true" aria-label="About YNOT Album Studio">
            <div className="modal-card__header">
              <div>
                <h2>About YNOT Album Studio</h2>
              </div>
              <button className="btn btn--icon btn--ghost" onClick={() => setAboutOpen(false)} aria-label="Close">
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="modal-card__body">
              <p className="muted">
                Internal album design studio built for YNOT Photography. Not for resale or distribution outside the studio.
              </p>
            </div>
            <div className="modal-card__footer">
              <button className="btn btn--primary" onClick={() => setAboutOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
