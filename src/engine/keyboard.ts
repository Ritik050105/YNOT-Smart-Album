/** True when a keyboard event's target is a text-entry control (input/textarea/select or a
 *  contentEditable element) — global shortcuts skip firing so typing isn't hijacked. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
export const modKeyLabel = isMac ? '⌘' : 'Ctrl'
