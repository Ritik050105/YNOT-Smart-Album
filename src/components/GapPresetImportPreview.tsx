import Modal from './Modal'
import { importGapPresets } from '@/state/preferences'

type Presets = ReturnType<typeof importGapPresets>
const percentages=(values:number[])=>values.map(value=>`${value>0?'+':''}${value}%`).join(' · ')
function PresetHistory({label,entries}:{label:string;entries:number[][]}){
  return <details><summary>{label} ({entries.length})</summary>{entries.length?<ol>{[...entries].reverse().map((values,index)=><li key={index}>{percentages(values)}</li>)}</ol>:<p>No entries</p>}</details>
}
function ImportHistory({label,entries}:{label:string;entries:string[]}){
  return <details><summary>{label} ({entries.length})</summary>{entries.length?<ol>{[...entries].reverse().map((entry,index)=>{
    const snapshot=importGapPresets(entry,true)
    return <li key={index}><strong>{percentages(snapshot.gapPercentPresets)}</strong><PresetHistory label="Preset Undo" entries={snapshot.gapPresetPast}/><PresetHistory label="Preset Redo" entries={snapshot.gapPresetFuture}/></li>
  })}</ol>:<p>No entries</p>}</details>
}
export default function GapPresetImportPreview({name,data,error,onImport,onCancel}:{name:string;data:Presets;error:string;onImport:()=>void;onCancel:()=>void}){
  return <div onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();onCancel()}}}><Modal title="Preview preset import" subtitle={name} width={640} className="preset-import-preview" onClose={onCancel} footer={<><button className="btn" type="button" autoFocus onClick={onCancel}>Cancel</button><button className="btn btn--primary" type="button" onClick={onImport}>Import</button></>}>
    <h3>Percentage presets</h3><div className="preset-import-preview__values">{data.gapPercentPresets.map(value=><span key={value}>{percentages([value])}</span>)}</div>
    <p>Review history below. Entries are shown next action first.</p>
    <div className="preset-import-preview__histories"><PresetHistory label="Preset Undo" entries={data.gapPresetPast}/><PresetHistory label="Preset Redo" entries={data.gapPresetFuture}/></div>
    {data.gapImportPast?<div className="preset-import-preview__histories"><ImportHistory label="Import Undo" entries={data.gapImportPast}/><ImportHistory label="Import Redo" entries={data.gapImportFuture??[]}/></div>:<p>This older file has no import history. Your existing import Undo entries will be retained.</p>}
    <p>Import replaces saved presets and preset history. Transferred import history is retained, and a new Undo import entry lets you reverse this import. Spacing preview and spacing history stay unchanged.</p>
    {error&&<p role="alert">{error}</p>}
  </Modal></div>
}
