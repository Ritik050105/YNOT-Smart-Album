import { useEffect, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { isEditableTarget, modKeyLabel } from '@/engine/keyboard'
import Modal from './Modal'

/** Global keyboard shortcuts for the whole app (undo/redo, save, export, delete, copy/paste
 *  images and tone, deselect, select-all-in-spread, nudge, and a "?" help overlay). Headless — only
 *  renders the shortcuts help modal when open; everything else is a single window keydown
 *  listener that reads/writes the project store directly so it works regardless of which panel
 *  has focus. Canvas-specific shortcuts (zoom/pan) live in DesignerCanvas instead, since they
 *  need local Konva stage state. */
export default function KeyboardShortcuts() {
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    function onToggleHelp() {
      setHelpOpen((o) => !o)
    }
    window.addEventListener('album-studio:toggle-shortcuts-help', onToggleHelp)
    return () => window.removeEventListener('album-studio:toggle-shortcuts-help', onToggleHelp)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      // Don't fight a modal's own Escape/field handling — skip entirely while one is open.
      if (document.querySelector('.modal-backdrop')) return

      const editable = isEditableTarget(e.target)
      const mod = e.ctrlKey || e.metaKey

      if (!editable && e.key === '?') {
        e.preventDefault()
        setHelpOpen((o) => !o)
        return
      }

      const s = useProjectStore.getState()
      if (s.matchingTemplatesOpen) {
        if (e.key === 'Escape') { e.preventDefault(); s.closeMatchingTemplates(); return }
        if (mod && !editable && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) { e.preventDefault(); s.closeMatchingTemplates(); if (e.key.toLowerCase() === 'y' || e.shiftKey) s.redo(); else s.undo(); return }
        if (!(mod && e.key.toLowerCase() === 's')) return
      }

      if (mod && !editable && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        s.undo()
        return
      }
      if (mod && !editable && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault()
        s.redo()
        return
      }
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (editable && document.activeElement instanceof HTMLElement) document.activeElement.blur()
        window.dispatchEvent(new CustomEvent(e.shiftKey ? 'album-studio:save-project-as' : 'album-studio:save-project'))
        return
      }
      if (mod && !editable && e.key.toLowerCase() === 'i') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('album-studio:import-images'))
        return
      }
      if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        if (editable && document.activeElement instanceof HTMLElement) document.activeElement.blur()
        window.dispatchEvent(new CustomEvent('album-studio:open-export'))
        return
      }
      if (mod && !editable && e.key.toLowerCase() === 'a') {
        if (!s.selectedSpreadId) return
        const spread = s.project.spreads.find((sp) => sp.id === s.selectedSpreadId)
        const ids = spread?.placements.filter((p) => p.photoId).map((p) => p.placeholderId) ?? []
        if (ids.length > 0) {
          e.preventDefault()
          useProjectStore.setState({
            multiSelectedPlaceholderIds: ids,
            selectedPlaceholderId: null,
            selectedTextBoxId: null,
          })
        }
        return
      }
      if (mod && !editable && e.key.toLowerCase() === 'c') {
        if (s.selectedSpreadId && s.selectedPlaceholderId) {
          e.preventDefault()
          if (e.shiftKey) s.copyToneAdjustments(s.selectedSpreadId, s.selectedPlaceholderId)
          else s.copyPlacement(s.selectedSpreadId, s.selectedPlaceholderId)
        }
        return
      }
      if (mod && !editable && e.key.toLowerCase() === 'v') {
        if (!s.selectedSpreadId) return
        const targets = s.multiSelectedPlaceholderIds.length > 0
          ? s.multiSelectedPlaceholderIds
          : s.selectedPlaceholderId
            ? [s.selectedPlaceholderId]
            : []
        if (targets.length > 0) {
          e.preventDefault()
          if (e.shiftKey) s.pasteToneAdjustments(s.selectedSpreadId, targets)
          else s.pastePlacement(s.selectedSpreadId, targets)
        }
        return
      }
      if (mod && !editable && !e.shiftKey && e.key.toLowerCase() === 'x') {
        if (s.selectedSpreadId && s.selectedPlaceholderId) {
          e.preventDefault()
          s.cutPlacement(s.selectedSpreadId, s.selectedPlaceholderId)
        }
        return
      }
      if (mod && !editable && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        s.selectPlaceholder(null)
        s.selectTextBox(null)
        s.clearMultiSelect()
        s.setSelectedPhotoIds([], null)
        return
      }
      if (!editable && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (s.selectedSpreadId && s.selectedTextBoxId) {
          e.preventDefault()
          s.removeTextBox(s.selectedSpreadId, s.selectedTextBoxId)
          return
        }
        if (s.selectedSpreadId && s.multiSelectedPlaceholderIds.length > 0) {
          e.preventDefault()
          const spreadId = s.selectedSpreadId
          s.updateMultiplePlacements(spreadId, s.multiSelectedPlaceholderIds, { photoId: null })
          return
        }
        if (s.selectedSpreadId && s.selectedPlaceholderId) {
          e.preventDefault()
          s.setPlacementPhoto(s.selectedSpreadId, s.selectedPlaceholderId, null)
          return
        }
        return
      }
      if (!editable && !mod && e.key.toLowerCase() === 'v') {
        s.setCanvasTool('select')
        return
      }
      if (!editable && !mod && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 't')) {
        s.setCanvasTool(e.key.toLowerCase() === 'f' ? 'frame' : 'text')
        return
      }
      if (!editable && !mod && e.key.toLowerCase() === 'h') {
        s.setCanvasTool('pan')
        return
      }
      if (!editable && !mod && e.key.toLowerCase() === 'z') {
        s.setCanvasTool('zoom')
        return
      }
      if (!editable && e.key === 'Escape') {
        // In Designer View with nothing else selected, Escape backs all the way out to the
        // all-spreads overview — the same thing its own back button does. With something still
        // selected, the first Escape just deselects (matching every other screen's Escape
        // behavior); a second press then exits, rather than the two meanings fighting each other.
        const nothingSelected =
          !s.selectedPlaceholderId && !s.selectedTextBoxId && s.multiSelectedPlaceholderIds.length === 0 && s.selectedPhotoIds.length === 0
        if (s.designerViewSpreadId && nothingSelected) {
          s.exitDesignerView()
          return
        }
        s.selectPlaceholder(null)
        s.selectTextBox(null)
        s.clearMultiSelect()
        s.setSelectedPhotoIds([], null)
        return
      }
      if (!editable && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        if (!mod && !e.altKey && !e.shiftKey && !s.designerViewSpreadId && !s.selectedPlaceholderId && !s.selectedTextBoxId && s.multiSelectedPlaceholderIds.length === 0 && s.selectedSpreadId && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault()
          s.cycleSpreadTemplate(s.selectedSpreadId, e.key === 'ArrowUp' ? -1 : 1)
          return
        }
        if (!mod && !e.altKey && !e.shiftKey && !s.designerViewSpreadId && !s.selectedPlaceholderId && !s.selectedTextBoxId && s.multiSelectedPlaceholderIds.length === 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          const spreads = [...s.project.spreads].sort((a, b) => Number(!!b.isCover) - Number(!!a.isCover) || a.order - b.order)
          const index = spreads.findIndex((spread) => spread.id === s.selectedSpreadId)
          const next = index < 0 ? 0 : Math.max(0, Math.min(spreads.length - 1, index + (e.key === 'ArrowLeft' ? -1 : 1)))
          if (spreads[next]) { e.preventDefault(); s.selectSpread(spreads[next].id) }
          return
        }
        if (s.selectedSpreadId && s.selectedTextBoxId) {
          const spread = s.project.spreads.find((sp) => sp.id === s.selectedSpreadId)
          const box = spread?.textBoxes.find((t) => t.id === s.selectedTextBoxId)
          if (box) {
            e.preventDefault()
            const step = e.shiftKey ? 0.02 : 0.004
            const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
            const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
            s.updateTextBox(s.selectedSpreadId, box.id, {
              x: Math.min(1, Math.max(0, box.x + dx)),
              y: Math.min(1, Math.max(0, box.y + dy)),
            })
          }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return helpOpen ? <ShortcutsHelpModal onClose={() => setHelpOpen(false)} /> : null
}

function Row({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="shortcut-row">
      <kbd>{keys}</kbd>
      <span>{label}</span>
    </div>
  )
}

function ShortcutsHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="Keyboard & Mouse Shortcuts"
      onClose={onClose}
      width={560}
      footer={
        <button className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="shortcuts-grid">
        <section>
          <h4>General</h4>
          <Row keys={`${modKeyLabel}+Z`} label="Undo" />
          <Row keys={`${modKeyLabel}+Shift+Z`} label="Redo" />
          <Row keys={`${modKeyLabel}+S`} label="Save project" />
          <Row keys={`${modKeyLabel}+I`} label="Import images" />
          <Row keys={`${modKeyLabel}+E`} label="Export album" />
          <Row keys="?" label="Toggle this help" />
        </section>
        <section>
          <h4>Selection &amp; editing</h4>
          <Row keys="Delete / Backspace" label="Clear the selected photo(s), or delete the selected text box" />
          <Row keys="Escape" label="Deselect everything" />
          <Row keys={`${modKeyLabel}+A`} label="Select all photos in the current spread" />
          <Row keys="Shift / Ctrl+click" label="Multi-select photos on the canvas" />
          <Row keys={`${modKeyLabel}+X / C / V`} label="Cut / copy / paste the selected image" />
          <Row keys={`${modKeyLabel}+Shift+C / V`} label="Copy / paste tone adjustments" />
          <Row keys={`${modKeyLabel}+D`} label="Deselect all" />
          <Row keys="Arrow keys" label="Nudge the selected text box (Shift = bigger step)" />
          <Row keys="Left / Right" label="Select the previous / next spread in the overview" />
          <Row keys="Up / Down" label="Try the previous / next matching layout in the overview" />
        </section>
        <section>
          <h4>Canvas</h4>
          <Row keys={`${modKeyLabel}+Scroll`} label="Zoom in / out, centered on the cursor" />
          <Row keys="Scroll" label="Pan the canvas" />
          <Row keys="Space+Drag / Middle-click Drag" label="Pan the canvas" />
          <Row keys="V / H / Z" label="Switch to the Select / Pan / Zoom tool" />
          <Row keys={`${modKeyLabel}+0`} label="Reset zoom" />
          <Row keys="Drag a photo onto another" label="Swap their positions" />
          <Row keys="Double-click text" label="Edit text" />
          <Row keys="Double-click a dock photo" label="Quick-place into the selected frame" />
        </section>
      </div>
    </Modal>
  )
}
