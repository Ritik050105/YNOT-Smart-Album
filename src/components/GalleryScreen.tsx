import { IMAGE_FILE_ACCEPT } from '@/engine/imageSource'
import { useRef, useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import { importAndDedupe } from '@/engine/importWorkflow'
import Icon from './Icon'

/** The Gallery project kind's own screen — a flat proofing grid instead of the album editor's
 *  spreads/templates. A client-facing workflow this app can genuinely deliver without the
 *  reference app's own proofing-site backend: import a shoot, mark favorites, then hand the
 *  photographer a one-click export of just the favorited files. */
export default function GalleryScreen() {
  const project = useProjectStore((s) => s.project)
  const addPhotos = useProjectStore((s) => s.addPhotos)
  const setPhotoFavorite = useProjectStore((s) => s.setPhotoFavorite)
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'favorites'>('all')
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

  function exportFavorites() {
    const favorites = project.photos.filter((p) => p.favorite)
    for (const photo of favorites) {
      const a = document.createElement('a')
      a.href = photo.src
      a.download = photo.fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
  }

  const favoriteCount = project.photos.filter((p) => p.favorite).length
  const visible = filter === 'favorites' ? project.photos.filter((p) => p.favorite) : project.photos

  return (
    <div className="gallery-screen">
      <header className="gallery-screen__topbar">
        <button className="btn btn--icon" title="Back to the album overview" onClick={goHome}>
          <Icon name="chevronLeft" size={16} />
        </button>
        <h2>{project.name}</h2>
        {project.clientName && <span className="muted">{project.clientName}</span>}
        <div className="gallery-screen__spacer" />
        <div className="gallery-screen__tabs">
          <button className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>
            All ({project.photos.length})
          </button>
          <button className={filter === 'favorites' ? 'is-active' : ''} onClick={() => setFilter('favorites')}>
            <Icon name="heart" size={12} /> Favorites ({favoriteCount})
          </button>
        </div>
        <button className="btn" disabled={favoriteCount === 0} onClick={exportFavorites} title="Download every favorited photo">
          <Icon name="download" size={14} />
          Export Favorites
        </button>
        <button className="btn btn--primary" disabled={importing} onClick={() => inputRef.current?.click()}>
          <Icon name="upload" size={14} />
          {importing ? 'Importing…' : 'Import Photos'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_FILE_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </header>

      <div
        className={`gallery-screen__body ${isDragging ? 'is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          void handleFiles(e.dataTransfer.files)
        }}
      >
        {visible.length === 0 ? (
          <div className="empty-state">
            <Icon name="image" size={28} />
            <p>{filter === 'favorites' ? 'No favorites marked yet.' : 'Drop photos here, or click Import Photos.'}</p>
          </div>
        ) : (
          <div className="gallery-screen__grid">
            {visible.map((photo) => (
              <div key={photo.id} className="gallery-screen__item">
                <img src={photo.src} alt={photo.fileName} />
                <button
                  className={`photo-dock__fav-btn ${photo.favorite ? 'is-favorite' : ''}`}
                  title={photo.favorite ? 'Remove from favorites' : 'Mark as favorite'}
                  onClick={() => setPhotoFavorite(photo.id, !photo.favorite)}
                >
                  <Icon name="heart" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
