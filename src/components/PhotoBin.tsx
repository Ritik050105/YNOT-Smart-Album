import { useProjectStore } from '@/state/projectStore'

/** Draggable strip of imported photos, sorted by capture time, for manually placing/replacing
 *  photos in a spread (drop target lives in DesignerCanvas). */
export default function PhotoBin() {
  const photos = useProjectStore((s) => s.project.photos)
  const sorted = [...photos].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())

  if (sorted.length === 0) return null

  return (
    <div className="panel photo-bin">
      <h3>Photos (timeline order)</h3>
      <div className="photo-bin__grid">
        {sorted.map((photo) => (
          <div
            key={photo.id}
            className="photo-bin__item"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-photo-id', photo.id)
              e.dataTransfer.effectAllowed = 'copy'
            }}
            title={`${photo.fileName} — ${new Date(photo.capturedAt).toLocaleString()}`}
          >
            <img src={photo.src} alt={photo.fileName} />
          </div>
        ))}
      </div>
    </div>
  )
}
