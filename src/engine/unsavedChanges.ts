export function confirmDiscardUnsaved(isDirty: boolean, confirm = (message: string) => window.confirm(message)) {
  return !isDirty || confirm('Discard unsaved album changes? Save the album first to keep your edits.')
}
