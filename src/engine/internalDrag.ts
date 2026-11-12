// A photo dragged out of the app's own gallery or timeline carries, besides its own type, a file copy
// the browser makes of the <img>. Dropped back on the window or the gallery, that copy looked like a
// file from the computer and was imported again as a clone. A drag that began inside the app is not an
// import, so every file-drop handler asks this first.
let inside = false
if (typeof window !== 'undefined') {
  window.addEventListener('dragstart', () => { inside = true }, true)
  const clear = () => { inside = false }
  window.addEventListener('dragend', clear, true)
  window.addEventListener('drop', () => setTimeout(clear, 0), true)
}
export const isInternalDrag = () => inside
/** Files from the computer, not a drag that started in this window. */
export const hasOutsideFiles = (data: DataTransfer | null | undefined) => !!data && Array.from(data.types).includes('Files') && !inside
