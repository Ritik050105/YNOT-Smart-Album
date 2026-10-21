import { useEffect, useState } from 'react'
import { hideMissingColorProfileDialog } from '@/engine/colorProfile'
import Modal from './Modal'

/** Listens for the "album-studio:missing-color-profile" event useImportPhotos dispatches after
 *  an import, and shows the reference app's own warning for photos that came in without an
 *  embedded ICC profile — one shared dialog rather than duplicating it in every component that
 *  can trigger an import (ImportPanel, PhotoBin). */
export default function MissingColorProfileDialog() {
  const [fileNames, setFileNames] = useState<string[] | null>(null)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  useEffect(() => {
    function onMissing(e: Event) {
      const names = (e as CustomEvent<{ fileNames: string[] }>).detail?.fileNames
      if (names?.length) setFileNames(names)
    }
    window.addEventListener('album-studio:missing-color-profile', onMissing)
    return () => window.removeEventListener('album-studio:missing-color-profile', onMissing)
  }, [])

  if (!fileNames) return null

  function close() {
    if (dontShowAgain) hideMissingColorProfileDialog()
    setFileNames(null)
    setDontShowAgain(false)
  }

  return (
    <Modal
      title="Missing Color Profile"
      onClose={close}
      width={420}
      footer={
        <button className="btn btn--primary" onClick={close}>
          OK
        </button>
      }
    >
      <p className="muted">The following images were imported, but they did not contain color profile information:</p>
      <ul className="missing-profile-list">
        {fileNames.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <label className="checkbox-row">
        <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} />
        Do not show this message again
      </label>
    </Modal>
  )
}
