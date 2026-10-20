import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { importAndDedupe } from '@/engine/importWorkflow'
import Icon from './Icon'

/** The Slideshow project kind's own screen — an ordered, drag-to-reorder photo sequence with a
 *  per-show duration and a fullscreen Play preview. No video file comes out of this (that's a
 *  real encoding pipeline this app doesn't have); Play is the deliverable itself, the way you'd
 *  present a slideshow live to a client. */
export default function SlideshowScreen() {
  const project = useProjectStore((s) => s.project)
  const addPhotos = useProjectStore((s) => s.addPhotos)
  const reorderPhotos = useProjectStore((s) => s.reorderPhotos)
  const setSlideDuration = useProjectStore((s) => s.setSlideDuration)
  const [importing, setImporting] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  function goHome() {
    window.dispatchEvent(new CustomEvent('album-studio:go-home'))
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setImporting(true)
    const { newAssets } = await importAndDedupe(Array.from(fileList), project.photos)
    if (newAssets.length > 0) addPhotos(newAssets)
    setImporting(false)
  }

  useEffect(() => {
    if (!playing || project.photos.length === 0) return
    const timer = setTimeout(() => {
      setSlideIndex((i) => (i + 1) % project.photos.length)
    }, project.slideDurationMs)
    return () => clearTimeout(timer)
  }, [playing, slideIndex, project.photos.length, project.slideDurationMs])

  useEffect(() => {
    if (!playing) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPlaying(false)
      if (e.key === 'ArrowRight') setSlideIndex((i) => (i + 1) % project.photos.length)
      if (e.key === 'ArrowLeft') setSlideIndex((i) => (i - 1 + project.photos.length) % project.photos.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, project.photos.length])

  function startPlaying() {
    if (project.photos.length === 0) return
    setSlideIndex(0)
    setPlaying(true)
  }

  return (
    <div className="slideshow-screen">
      <header className="slideshow-screen__topbar">
        <button className="btn btn--icon" title="Back to the album overview" onClick={goHome}>
          <Icon name="chevronLeft" size={16} />
        </button>
        <h2>{project.name}</h2>
        {project.clientName && <span className="muted">{project.clientName}</span>}
        <div className="slideshow-screen__spacer" />
        <label className="slideshow-screen__duration">
          Duration
          <input
            type="range"
            min={1000}
            max={10000}
            step={500}
            value={project.slideDurationMs}
            onChange={(e) => setSlideDuration(Number(e.target.value))}
          />
          {(project.slideDurationMs / 1000).toFixed(1)}s
        </label>
        <button className="btn btn--primary" disabled={project.photos.length === 0} onClick={startPlaying}>
          <Icon name="play" size={14} />
          Play
        </button>
        <button className="btn" disabled={importing} onClick={() => inputRef.current?.click()}>
          <Icon name="upload" size={14} />
          {importing ? 'Importing…' : 'Import Photos'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </header>

      <div className="slideshow-screen__body">
        {project.photos.length === 0 ? (
          <div className="empty-state">
            <Icon name="play" size={28} />
            <p>Import photos to build a slideshow, then drag to reorder them.</p>
          </div>
        ) : (
          <div className="slideshow-screen__strip">
            {project.photos.map((photo, index) => (
              <div
                key={photo.id}
                className="slideshow-screen__item"
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex === null || dragIndex === index) return
                  reorderPhotos(dragIndex, index)
                  setDragIndex(null)
                }}
              >
                <span className="slideshow-screen__number">{index + 1}</span>
                <img src={photo.src} alt={photo.fileName} />
              </div>
            ))}
          </div>
        )}
      </div>

      {playing && project.photos.length > 0 && (
        <div className="slideshow-player" onClick={() => setPlaying(false)}>
          <img key={project.photos[slideIndex].id} src={project.photos[slideIndex].src} alt="" className="slideshow-player__image" />
          <div className="slideshow-player__controls" onClick={(e) => e.stopPropagation()}>
            <button
              className="btn btn--icon"
              onClick={() => setSlideIndex((i) => (i - 1 + project.photos.length) % project.photos.length)}
            >
              <Icon name="chevronLeft" size={18} />
            </button>
            <span>
              {slideIndex + 1} / {project.photos.length}
            </span>
            <button className="btn btn--icon" onClick={() => setSlideIndex((i) => (i + 1) % project.photos.length)}>
              <Icon name="chevronRight" size={18} />
            </button>
            <button className="btn btn--icon" title="Close (Esc)" onClick={() => setPlaying(false)}>
              <Icon name="x" size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
