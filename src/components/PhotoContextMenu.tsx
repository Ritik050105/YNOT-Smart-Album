import { useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { computePlaceholderBoxes } from '@/engine/layoutMath'
import { importAndDedupe } from '@/engine/importWorkflow'
import { IMAGE_FILE_ACCEPT } from '@/engine/imageSource'
import ContextMenu, { ContextMenuItem } from './ContextMenu'
import Modal from './Modal'

export default function PhotoContextMenu({ x, y, spreadId, frameId }: { x: number; y: number; spreadId: string; frameId?: string }) {
  const state = useProjectStore()
  const [open, setOpen] = useState(true)
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const spread = state.project.spreads.find(s => s.id === spreadId)
  if (!spread) return null
  const placement = spread.placements.find(p => p.placeholderId === frameId)
  const photo = state.project.photos.find(p => p.id === placement?.photoId)
  const background = !frameId ? spread.backgroundPattern : undefined
  const src = photo?.src ?? background?.src
  const name = photo?.fileName ?? background?.name ?? ''
  const size = spread.size ?? state.project.size
  const height = 900 * size.heightIn / size.widthIn
  const box = computePlaceholderBoxes(spread, 900, height).find(b => b.placeholderId === frameId)
  const horizontal = !!box && box.width >= box.height
  const run = (action: () => Promise<unknown>) => { void action().catch(e => setError(e instanceof Error ? e.message : String(e))) }
  const items: ContextMenuItem[] = [
    { label: 'Cut', shortcut: 'Ctrl+X', disabled: !photo, onClick: () => state.cutPlacement(spreadId, frameId!) },
    { label: 'Copy', shortcut: 'Ctrl+C', disabled: !photo, onClick: () => state.copyPlacement(spreadId, frameId!) },
    { label: 'Copy Tone Adjustments', shortcut: 'Ctrl+Shift+C', disabled: !photo, onClick: () => state.copyToneAdjustments(spreadId, frameId!) },
    { label: 'Copy Filename(s)', disabled: !src, onClick: () => run(() => navigator.clipboard.writeText(name)) },
    { label: 'Paste', shortcut: 'Ctrl+V', disabled: !frameId || !state.photoClipboard, onClick: () => state.pastePlacement(spreadId, [frameId!]) },
    { label: 'Paste Tone Adjustments', shortcut: 'Ctrl+Shift+V', disabled: !placement || !state.toneClipboard, onClick: () => state.pasteToneAdjustments(spreadId, [frameId!]) },
    { label: 'Delete', shortcut: 'Del', disabled: !src && !placement, onClick: () => frameId ? state.removeImageFrame(spreadId, frameId) : state.updateSpread(spreadId, { backgroundPattern: undefined }) },
    { label: `Convert to ${horizontal ? 'Vertical' : 'Horizontal'} Frame`, separator: true, disabled: !box, onClick: () => {
      if (!box || !frameId) return
      const width = Math.min(box.height, 900), h = Math.min(box.width, height)
      state.updateImageFrame(spreadId, frameId, { x: Math.max(0, Math.min(900-width, box.x+(box.width-width)/2))/900, y: Math.max(0, Math.min(height-h, box.y+(box.height-h)/2))/height, width: width/900, height: h/height })
    } },
    { label: 'Flip Image Horizontally', disabled: !photo, onClick: () => state.updatePlacement(spreadId, frameId!, { flipHorizontal: !placement!.flipHorizontal }) },
    { label: 'Flip Image Vertically', disabled: !photo, onClick: () => state.updatePlacement(spreadId, frameId!, { flipVertical: !placement!.flipVertical }) },
    { label: background ? 'Remove Spread Background Image' : 'Make Spread Background Image', disabled: !background && !photo, onClick: () => background ? state.updateSpread(spreadId, { backgroundPattern: undefined }) : state.makePhotoBackground(spreadId, frameId!) },
    { label: 'Quick Preview', shortcut: 'Space', separator: true, disabled: !src, onClick: () => setPreview(true) },
    { label: 'Open in Photo Viewer', disabled: !photo?.sourcePath || !window.albumStudio?.showImageFile, onClick: () => run(() => window.albumStudio!.showImageFile(photo!.sourcePath!, false)) },
    { label: 'Show in Explorer', disabled: !photo?.sourcePath || !window.albumStudio?.showImageFile, onClick: () => run(() => window.albumStudio!.showImageFile(photo!.sourcePath!, true)) },
    { label: 'Reveal in Image Browser', disabled: !photo, onClick: () => { state.setSelectedPhotoIds([photo!.id], photo!.id); useProjectStore.setState({ bottomPanelOpen: true }) } },
    { label: 'Reload from Original', shortcut: 'Ctrl+R', separator: true, disabled: !photo, onClick: () => state.resetPlacementToOriginal(spreadId, frameId!) },
    { label: 'Replace Image', shortcut: 'Ctrl+Shift+R', disabled: !placement && !background, onClick: () => input.current?.click() },
    // Projects embed their photos, so there is no missing linked file to relink.
    { label: 'Relink Missing File…', separator: true, disabled: true, onClick: () => {} },
  ]
  return <>
    {open && <ContextMenu x={x} y={y} items={items} onClose={() => setOpen(false)} />}
    <input ref={input} type="file" accept={IMAGE_FILE_ACCEPT} hidden onChange={e => {
      const file = e.target.files?.[0]; e.target.value = ''; if (!file) return
      run(async () => {
        const result = await importAndDedupe([file], useProjectStore.getState().project.photos)
        state.addPhotos(result.newAssets)
        const replacement = result.matchedAssets[0]
        if (!replacement) throw new Error('Could not import the replacement image.')
        if (frameId) state.setPlacementPhoto(spreadId, frameId, replacement.id)
        else state.updateSpread(spreadId, { backgroundPattern: { name: replacement.fileName, src: replacement.src, tileSizePx: 900, mode: 'cover', width: replacement.width, height: replacement.height } })
      })
    }} />
    {preview && src && <Modal title={name} onClose={() => setPreview(false)} width={900}><img src={src} alt={name} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} /></Modal>}
    {error && <Modal title="Image action" onClose={() => setError('')}><p>{error}</p></Modal>}
  </>
}
