import Modal from './Modal'
import { importGapPresets, previewGapPresetImport, usePreferences } from '@/state/preferences'

type Presets = ReturnType<typeof importGapPresets>
const percentages=(values:number[])=>values.map(value=>`${value>0?'+':''}${value}%`).join(' · ')
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
const snapshots=(entries:string[])=>entries.map(entry=>importGapPresets(entry,true))
function PresetHistory({label,entries,other=entries}:{label:string;entries:number[][];other?:number[][]}){
  return <details><summary>{label} ({entries.length})</summary>{entries.length?<ol>{[...entries].reverse().map((values,index)=><li className={!same(values,other.at(-1-index))?'preset-import-preview__changed':undefined} key={index}>{percentages(values)}</li>)}</ol>:<p>No entries</p>}</details>
}
function ImportHistory({label,entries,other}:{label:string;entries:string[];other:string[]}){
  const compared=snapshots(other)
  return <details><summary>{label} ({entries.length})</summary>{entries.length?<ol>{snapshots(entries).reverse().map((snapshot,index)=>{
    const previous=compared.at(-1-index)
    return <li className={!same(snapshot,previous)?'preset-import-preview__changed':undefined} key={index}><strong>{percentages(snapshot.gapPercentPresets)}</strong><PresetHistory label="Preset Undo" entries={snapshot.gapPresetPast} other={previous?.gapPresetPast??[]}/><PresetHistory label="Preset Redo" entries={snapshot.gapPresetFuture} other={previous?.gapPresetFuture??[]}/></li>
  })}</ol>:<p>No entries</p>}</details>
}
export default function GapPresetImportPreview({name,data,error,onImport,onCancel}:{name:string;data:Presets;error:string;onImport:()=>void;onCancel:()=>void}){
  const current=usePreferences(s=>s.values)
  const imported=previewGapPresetImport(current,data)
  return <div onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();onCancel()}}}><Modal title="Preview preset import" subtitle={name} width={900} className="preset-import-preview" onClose={onCancel} footer={<><button className="btn" type="button" autoFocus onClick={onCancel}>Cancel</button><button className="btn btn--primary" type="button" onClick={onImport}>Import</button></>}>
    <p>Highlighted values and history entries differ. History is shown next action first.</p>
    <table className="preset-import-preview__comparison"><thead><tr><th scope="col">Current saved presets</th><th scope="col">Imported · after confirmation</th></tr></thead>
      <tbody aria-label="Percentage presets"><tr><th colSpan={2}>Percentage presets <span>{same(current.gapPercentPresets,imported.gapPercentPresets)?'Unchanged':'Changed'}</span></th></tr><tr>{[current,imported].map((values,side)=><td key={side}><div className="preset-import-preview__values">{values.gapPercentPresets.map((value,index)=><span className={current.gapPercentPresets[index]!==imported.gapPercentPresets[index]?'preset-import-preview__changed':undefined} key={index}>{percentages([value])}</span>)}</div></td>)}</tr></tbody>
      {(['gapPresetPast','gapPresetFuture','gapImportPast','gapImportFuture'] as const).map((key,index)=>{
        const label=['Preset Undo','Preset Redo','Import Undo','Import Redo'][index]
        const changed=key==='gapImportPast'||key==='gapImportFuture'?!same(snapshots(current[key]),snapshots(imported[key])):!same(current[key],imported[key])
        return <tbody key={key} aria-label={label}><tr><th colSpan={2}>{label} <span>{changed?'Changed':'Unchanged'}</span></th></tr><tr>{[current,imported].map((values,side)=><td key={side}>{key==='gapImportPast'||key==='gapImportFuture'?<ImportHistory label={label} entries={values[key]} other={(side?current:imported)[key]}/>:<PresetHistory label={label} entries={values[key]} other={(side?current:imported)[key]}/>}</td>)}</tr></tbody>
      })}
    </table>
    <p>The imported column includes the Undo import entry that preserves your current presets. Older files without import history retain existing import Undo entries; a changed import clears import Redo. Nothing is saved until Import. Spacing preview and spacing history stay unchanged.</p>
    {error&&<p role="alert">{error}</p>}
  </Modal></div>
}
