import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { exportSingleSpreadToPdf } from '@/engine/exportAlbum'

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

/** Classic desktop-app menu bar (File/Edit/Spread/Templates/View/Help) sitting above the toolbar
 *  — the structural piece of the reference app's chrome that the client already knows from
 *  SmartAlbums, so switching to this app needs less re-learning. Every item reuses an action the
 *  toolbar/panels already expose (via direct store calls or the same window events TopBar and
 *  Inspector listen for) rather than duplicating logic. */
export default function MenuBar() {
  const project = useProjectStore((s) => s.project)
  const selectedSpreadId = useProjectStore((s) => s.selectedSpreadId)
  const undo = useProjectStore((s) => s.undo)
  const redo = useProjectStore((s) => s.redo)
  const history = useProjectStore((s) => s.history)
  const future = useProjectStore((s) => s.future)
  const flipSpread = useProjectStore((s) => s.flipSpread)
  const splitSpread = useProjectStore((s) => s.splitSpread)
  const mergeWithNext = useProjectStore((s) => s.mergeWithNext)
  const addBlankSpread = useProjectStore((s) => s.addBlankSpread)
  const addCoverSpread = useProjectStore((s) => s.addCoverSpread)
  const duplicateSpread = useProjectStore((s) => s.duplicateSpread)
  const deleteSpread = useProjectStore((s) => s.deleteSpread)
  const applyTemplateToAllSpreads = useProjectStore((s) => s.applyTemplateToAllSpreads)
  const showGrid = useProjectStore((s) => s.showGrid)
  const toggleGrid = useProjectStore((s) => s.toggleGrid)
  const showPrintGuides = useProjectStore((s) => s.showPrintGuides)
  const togglePrintGuides = useProjectStore((s) => s.togglePrintGuides)

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openMenu) return
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    window.addEventListener('mousedown', onClickOutside)
    return () => window.removeEventListener('mousedown', onClickOutside)
  }, [openMenu])

  const interior = project.spreads.filter((s) => !s.isCover).sort((a, b) => a.order - b.order)
  const hasCover = project.spreads.some((s) => s.isCover)
  const spread = project.spreads.find((s) => s.id === selectedSpreadId)
  const interiorIndex = spread ? interior.findIndex((s) => s.id === spread.id) : -1
  const hasSpread = !!spread
  const hasInteriorSpread = !!spread && !spread.isCover

  function run(fn: () => void) {
    fn()
    setOpenMenu(null)
  }

  const menus: MenuSpec[] = [
    {
      label: 'File',
      items: [
        { label: 'New Album', onClick: () => window.dispatchEvent(new CustomEvent('album-studio:new-project')) },
        { label: 'Open Project…', onClick: () => window.dispatchEvent(new CustomEvent('album-studio:open-project')) },
        { label: 'Save Project', shortcut: 'Ctrl+S', onClick: () => window.dispatchEvent(new CustomEvent('album-studio:save-project')) },
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
      ],
    },
    {
      label: 'Spread',
      items: [
        { label: 'Add Blank Spread', onClick: addBlankSpread },
        { label: 'Add Cover', disabled: hasCover, onClick: addCoverSpread },
        { label: 'Flip Spread Horizontally', disabled: !hasSpread, onClick: () => spread && flipSpread(spread.id) },
        {
          label: 'Split Spread',
          disabled: !hasInteriorSpread || spread?.pageSide !== 'spread',
          onClick: () => spread && splitSpread(spread.id),
        },
        {
          label: 'Merge With Next',
          disabled: !hasInteriorSpread || interiorIndex === interior.length - 1,
          onClick: () => spread && mergeWithNext(spread.id),
        },
        { label: 'Duplicate Spread', disabled: !hasInteriorSpread, onClick: () => spread && duplicateSpread(spread.id) },
        {
          label: 'Export This Spread…',
          disabled: !hasSpread,
          onClick: () => spread && void exportSingleSpreadToPdf(project, spread),
        },
        {
          label: hasCover && spread?.isCover ? 'Delete Cover' : 'Delete Spread',
          disabled: !hasSpread,
          danger: true,
          onClick: () => spread && deleteSpread(spread.id),
        },
      ],
    },
    {
      label: 'Templates',
      items: [
        {
          label: 'Browse Template Gallery…',
          disabled: !hasSpread,
          onClick: () => window.dispatchEvent(new CustomEvent('album-studio:open-template-gallery')),
        },
        {
          label: 'Apply Template to All Spreads',
          disabled: !hasSpread,
          onClick: () => spread && applyTemplateToAllSpreads(spread.templateId),
        },
      ],
    },
    {
      label: 'View',
      items: [
        { label: `${showGrid ? '✓ ' : ''}Rule-of-Thirds Grid`, onClick: toggleGrid },
        { label: `${showPrintGuides ? '✓ ' : ''}Print Guides (Bleed / Safety)`, onClick: togglePrintGuides },
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
    </div>
  )
}
