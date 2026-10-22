/** Keep the dragged selection in dock order; an unselected image drags alone. */
export function draggedPhotoIds(photoId: string, selectedIds: string[], visibleIds: string[]): string[] {
  return selectedIds.includes(photoId) ? visibleIds.filter((id) => selectedIds.includes(id)) : [photoId]
}

export function readDraggedPhotoIds(data: Pick<DataTransfer, 'getData'>, validIds: string[]): string[] {
  const single = data.getData('application/x-photo-id')
  let ids: unknown = [single]
  try {
    const multiple = data.getData('application/x-photo-ids')
    if (multiple) ids = JSON.parse(multiple)
  } catch {
    return []
  }
  return Array.isArray(ids) ? [...new Set(ids.filter((id): id is string => typeof id === 'string' && validIds.includes(id)))] : []
}
export function readTimelineFrame(transfer: Pick<DataTransfer, 'getData'>): { spreadId: string; frameId: string } | null {
  try {
    const value = JSON.parse(transfer.getData('application/x-album-frame'))
    return typeof value?.spreadId === 'string' && typeof value?.frameId === 'string' ? value : null
  } catch { return null }
}
