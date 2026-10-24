import { useState } from 'react'
import Modal from './Modal'
import { importGapPresets, previewGapPresetImport, summarizeGapPresetImport, usePreferences } from '@/state/preferences'

type Presets = ReturnType<typeof importGapPresets>
const percentages=(values:number[])=>values.map(value=>`${value>0?'+':''}${value}%`).join(' · ')
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
const snapshots=(entries:string[])=>entries.map(entry=>importGapPresets(entry,true))
function PresetHistory({label,entries,other=entries,onlyChanges=false}:{label:string;entries:number[][];other?:number[][];onlyChanges?:boolean}){
  if(onlyChanges&&same(entries,other))return null
  const visible=entries.filter((values,index)=>!same(values,other.at(index-entries.length))).length
  return <details open={onlyChanges||undefined}><summary>{label} ({entries.length})</summary>{onlyChanges&&!visible?<p>No changed entries on this side</p>:entries.length?<ol>{[...entries].reverse().map((values,index)=><li hidden={onlyChanges&&same(values,other.at(-1-index))} value={index+1} className={!same(values,other.at(-1-index))?'preset-import-preview__changed':undefined} key={index}>{percentages(values)}</li>)}</ol>:<p>No entries</p>}</details>
}
function ImportHistory({label,entries,other,onlyChanges=false}:{label:string;entries:string[];other:string[];onlyChanges?:boolean}){
  const compared=snapshots(other)
  const values=snapshots(entries)
  if(onlyChanges&&same(values,compared))return null
  const visible=values.filter((value,index)=>!same(value,compared.at(index-values.length))).length
  return <details open={onlyChanges||undefined}><summary>{label} ({entries.length})</summary>{onlyChanges&&!visible?<p>No changed entries on this side</p>:entries.length?<ol>{values.reverse().map((snapshot,index)=>{
    const previous=compared.at(-1-index)
    return <li hidden={onlyChanges&&same(snapshot,previous)} value={index+1} className={!same(snapshot,previous)?'preset-import-preview__changed':undefined} key={index}><strong hidden={onlyChanges&&same(snapshot.gapPercentPresets,previous?.gapPercentPresets)}>{percentages(snapshot.gapPercentPresets)}</strong><PresetHistory label="Preset Undo" entries={snapshot.gapPresetPast} other={previous?.gapPresetPast??[]} onlyChanges={onlyChanges}/><PresetHistory label="Preset Redo" entries={snapshot.gapPresetFuture} other={previous?.gapPresetFuture??[]} onlyChanges={onlyChanges}/></li>
  })}</ol>:<p>No entries</p>}</details>
}
export default function GapPresetImportPreview({name,data,error,onImport,onCancel}:{name:string;data:Presets;error:string;onImport:()=>void;onCancel:()=>void}){
  const [onlyChanges,setOnlyChanges]=useState(false)
  const current=usePreferences(s=>s.values)
  const imported=previewGapPresetImport(current,data)
  const summary=summarizeGapPresetImport(current,imported)
  const unchanged=same(current.gapPercentPresets,imported.gapPercentPresets)&&same(current.gapPresetPast,imported.gapPresetPast)&&same(current.gapPresetFuture,imported.gapPresetFuture)&&same(snapshots(current.gapImportPast),snapshots(imported.gapImportPast))&&same(snapshots(current.gapImportFuture),snapshots(imported.gapImportFuture))
  return <div onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();onCancel()}}}><Modal title="Preview preset import" subtitle={name} width={900} className="preset-import-preview" onClose={onCancel} footer={<><button className="btn" type="button" autoFocus onClick={onCancel}>Cancel</button><button className="btn btn--primary" type="button" onClick={onImport}>Import</button></>}>
    <p>Highlighted values and history entries differ. History is shown next action first.</p>
    <table className="preset-import-preview__summary" aria-label="Import change summary"><caption>Changes on import</caption><thead><tr><th scope="col">Items</th><th scope="col">Added</th><th scope="col">Changed</th><th scope="col">Removed</th></tr></thead><tbody>{summary.map(row=><tr key={row.label}><th scope="row">{row.label}</th><td>{row.added}</td><td>{row.changed}</td><td>{row.removed}</td></tr>)}</tbody></table>
    <p>Counts compare preset slots and history positions, next action first. Each import-history snapshot counts once, including its saved preset histories. The new Undo import entry is included.</p>
    <label className="preset-import-preview__filter"><input type="checkbox" checked={onlyChanges} onChange={e=>setOnlyChanges(e.target.checked)}/> Show only changes</label>
    {onlyChanges&&unchanged&&<p role="status">No changes. These presets and histories match your current saved settings.</p>}
    <table hidden={onlyChanges&&unchanged} className="preset-import-preview__comparison"><thead><tr><th scope="col">Current saved presets</th><th scope="col">Imported · after confirmation</th></tr></thead>
      <tbody hidden={onlyChanges&&same(current.gapPercentPresets,imported.gapPercentPresets)} aria-label="Percentage presets"><tr><th colSpan={2}>Percentage presets <span>{same(current.gapPercentPresets,imported.gapPercentPresets)?'Unchanged':'Changed'}</span></th></tr><tr>{[current,imported].map((values,side)=><td key={side}><div className="preset-import-preview__values">{values.gapPercentPresets.map((value,index)=><span hidden={onlyChanges&&current.gapPercentPresets[index]===imported.gapPercentPresets[index]} title={`Preset ${index+1}`} className={current.gapPercentPresets[index]!==imported.gapPercentPresets[index]?'preset-import-preview__changed':undefined} key={index}>{percentages([value])}</span>)}</div></td>)}</tr></tbody>
      {(['gapPresetPast','gapPresetFuture','gapImportPast','gapImportFuture'] as const).map((key,index)=>{
        const label=['Preset Undo','Preset Redo','Import Undo','Import Redo'][index]
        const changed=key==='gapImportPast'||key==='gapImportFuture'?!same(snapshots(current[key]),snapshots(imported[key])):!same(current[key],imported[key])
        return <tbody hidden={onlyChanges&&!changed} key={key} aria-label={label}><tr><th colSpan={2}>{label} <span>{changed?'Changed':'Unchanged'}</span></th></tr><tr>{[current,imported].map((values,side)=><td key={side}>{key==='gapImportPast'||key==='gapImportFuture'?<ImportHistory label={label} entries={values[key]} other={(side?current:imported)[key]} onlyChanges={onlyChanges}/>:<PresetHistory label={label} entries={values[key]} other={(side?current:imported)[key]} onlyChanges={onlyChanges}/>}</td>)}</tr></tbody>
      })}
    </table>
    <p>The imported column includes the Undo import entry that preserves your current presets. Older files without import history retain existing import Undo entries; a changed import clears import Redo. Nothing is saved until Import. Spacing preview and spacing history stay unchanged.</p>
    {error&&<p role="alert">{error}</p>}
  </Modal></div>
}
