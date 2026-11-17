// A photo dragged out of the app's own gallery or timeline carries, besides its own type, a file copy
// the browser makes of the <img>. Dropped back on the window or the gallery, that copy looked like a
// file from the computer and was imported again as a clone. A drag that began inside the app is not an
// import, so every file-drop handler asks this first.
let inside = false
/** The photographs a drag that began in the app is carrying. Dragover cannot read a drag's data, only its types, so a drop target that wants to
 *  preview what is about to land (the designer's outline of the frame) has to be told here. Read once the drag's own handler has set it. */
let carried: string[] = []
if (typeof window !== 'undefined') {
  window.addEventListener('dragstart', () => { inside = true }, true)
  window.addEventListener('dragstart', e => {
    try {
      const many = e.dataTransfer?.getData('application/x-photo-ids'), one = e.dataTransfer?.getData('application/x-photo-id')
      const ids = many ? JSON.parse(many) : one ? [one] : []
      carried = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
    } catch { carried = [] }
  }, false)
  const clear = () => { inside = false; carried = [] }
  window.addEventListener('dragend', clear, true)
  window.addEventListener('drop', () => setTimeout(clear, 0), true)
}
export const isInternalDrag = () => inside
export const draggedPhotos = () => carried
/** Files from the computer, not a drag that started in this window. */
export const hasOutsideFiles = (data: DataTransfer | null | undefined) => !!data && Array.from(data.types).includes('Files') && !inside
