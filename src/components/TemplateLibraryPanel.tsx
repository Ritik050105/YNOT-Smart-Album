import { MAX_PHOTOS_PER_SPREAD } from '@/engine/spreadLimits'
import TemplateTransfer from './TemplateTransfer'
import { useState } from 'react'
import { useProjectStore } from '@/state/projectStore'
import TemplateThumb from './TemplatePreview'
import Icon from './Icon'

export default function TemplateLibraryPanel() {
  const [countFilter,setCountFilter]=useState(0)
  const userTemplates = useProjectStore((s) => s.userTemplates)
  const deleteUserTemplate = useProjectStore((s) => s.deleteUserTemplate)
  const spreadAspect = useProjectStore((s) => s.project.size.widthIn / s.project.size.heightIn)

  return (
    <div className="panel template-library"><TemplateTransfer/><label>Images per creative template<select value={countFilter} onChange={e=>setCountFilter(Number(e.target.value))}><option value={0}>All counts</option>{Array.from({length:MAX_PHOTOS_PER_SPREAD},(_,i)=><option key={i} value={i+1}>{i+1} images</option>)}</select></label>
      <h3>
        <Icon name="bookOpen" size={14} />
        Template Library
      </h3>

      {userTemplates.length === 0 ? (
        <div className="empty-state">
          <Icon name="layers" size={24} />
          <p>No saved templates yet. Use "Save" on a spread's layout, or import one from a photo above.</p>
        </div>
      ) : (
        <div className="template-library__grid">
          {userTemplates.filter(t=>!countFilter||t.photoCount===countFilter).map((t) => (
            <div key={t.id} className="template-library__item">
              <TemplateThumb template={t} aspect={spreadAspect} className="template-library__swatch" />
              <span className="template-library__name">{t.name}</span>
              <button className="btn btn--tiny btn--danger" onClick={() => deleteUserTemplate(t.id)}>
                <Icon name="trash" size={10} />
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
