import {useState} from 'react'
import {useProjectStore} from '@/state/projectStore'
import {TextBox} from '@/types'
import {selectedKeys,layerEditItems} from '@/engine/layerClipboard'
import {selectionGeometry} from '@/engine/spreadLayers'
import {fitTextBoxSize} from '@/engine/textBoxSize'
import FontPicker from './FontPicker'
import ContextMenu from './ContextMenu'
import {layerOrderItems} from './layerOrderItems'
import SliderField from './SliderField'

let copiedStyle:Partial<TextBox>|null=null
export default function FloatingTextToolbar(){
 const state=useProjectStore(),[more,setMore]=useState<{x:number;y:number}|null>(null),[popover,setPopover]=useState<'spacing'|'position'|null>(null),[target,setTarget]=useState<'spread'|'left-page'|'right-page'>('spread')
 const spread=state.project.spreads.find(s=>s.id===state.selectedSpreadId),keys=selectedKeys()
 const boxes=spread?selectionGeometry(spread,keys,state.project.size)?.members.flatMap(m=>m.kind==='text'&&!m.value.shape&&!m.value.hidden?[m.value]:[])??[]:[]
 if(!spread||!boxes.length)return null
 const first=boxes[0],editable=boxes.filter(b=>!b.locked),ids=new Set(editable.map(b=>b.id)),disabled=!editable.length
 const patch=(value:Partial<TextBox>)=>state.updateSpread(spread.id,{textBoxes:spread.textBoxes.map(b=>ids.has(b.id)?fitTextBoxSize({...b,...value},spread.size??state.project.size):b)})
 const group=first.groupId&&boxes.every(b=>b.groupId===first.groupId)?first.groupId:null
 const style=()=>{const {fontFamily,fontSize,color,bold,italic,underline,strikeThrough,align,letterSpacing,lineHeight,opacity,effects}=first;copiedStyle={fontFamily,fontSize,color,bold,italic,underline,strikeThrough,align,letterSpacing,lineHeight,opacity,effects:structuredClone(effects)}}
 return <div className="floating-text-tools" role="toolbar" aria-label="Text formatting" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
 <fieldset disabled={disabled}><FontPicker scanEnabled={false} value={boxes.every(b=>b.fontFamily===first.fontFamily)?first.fontFamily:''} onChange={fontFamily=>patch({fontFamily})}/>
 <input aria-label="Font size" type="number" min={1} max={1000} value={first.fontSize} onChange={e=>{const n=Number(e.target.value);if(n>=1&&n<=1000)patch({fontSize:n})}}/>
 <input aria-label="Text color" type="color" value={/^#[0-9a-f]{6}$/i.test(first.color)?first.color:'#000000'} onChange={e=>patch({color:e.target.value})}/>
 {(['bold','italic','underline','strikeThrough'] as const).map((key,i)=><button key={key} className="btn" aria-label={key} aria-pressed={!!first[key]} onClick={()=>patch({[key]:!first[key]})}>{['B','I','U','S'][i]}</button>)}
 <button className="btn" title="Change case" onClick={()=>state.updateSpread(spread.id,{textBoxes:spread.textBoxes.map(b=>ids.has(b.id)?fitTextBoxSize({...b,text:b.text===b.text.toUpperCase()?b.text.toLowerCase():b.text.toUpperCase()},spread.size??state.project.size):b)})}>aA</button>
 <select aria-label="Text alignment" value={first.align} onChange={e=>patch({align:e.target.value as TextBox['align']})}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
 <button className="btn" aria-expanded={popover==='spacing'} onClick={()=>{setMore(null);setPopover(popover==='spacing'?null:'spacing')}}>Spacing / opacity</button>
 <button className="btn" aria-expanded={popover==='position'} onClick={()=>{setMore(null);setPopover(popover==='position'?null:'position')}}>Position</button><button className="btn" onClick={()=>{setMore(null);setPopover(null);state.revealRightPanel();requestAnimationFrame(()=>document.querySelector('.text-effect-row')?.closest('details')?.setAttribute('open',''))}}>Blending effects</button>
 </fieldset><button className="btn" aria-label="More text options" onClick={e=>setMore({x:e.clientX,y:e.clientY})}>⋯</button>
 {popover==='position'&&<div className="floating-text-tools__spacing"><select aria-label="Align to page" value={target} onChange={e=>setTarget(e.target.value as typeof target)}><option value="spread">Whole spread</option><option value="left-page">Left page</option><option value="right-page">Right page</option></select>{(['left','center','right','top','middle','bottom','horizontal','vertical'] as const).map(mode=><button className="btn" key={mode} onClick={()=>{state.arrangeSelection(spread.id,keys,mode,target);setPopover(null)}}>{mode==='horizontal'?'Distribute horizontally':mode==='vertical'?'Distribute vertically':mode}</button>)}</div>}
 {popover==='spacing'&&<div className="floating-text-tools__spacing"><SliderField label="Character spacing" min={-5} max={30} step={.1} value={first.letterSpacing??0} onChange={letterSpacing=>patch({letterSpacing})}/><SliderField label="Line spacing" min={.5} max={3} step={.05} value={first.lineHeight??1.2} onChange={lineHeight=>patch({lineHeight})}/><SliderField label="Opacity" min={0} max={1} step={.01} value={first.opacity??1} onChange={opacity=>patch({opacity})}/></div>}
 {more&&<ContextMenu {...more} onClose={()=>setMore(null)} items={[...layerEditItems(spread.id,keys),{label:group?'Ungroup':'Group',disabled:boxes.length<2&&!group,onClick:()=>group?state.ungroupLayers(spread.id,group):state.groupLayers(spread.id,keys)},{label:'Copy style',onClick:style},{label:'Paste style',disabled:!copiedStyle||disabled,onClick:()=>copiedStyle&&patch(structuredClone(copiedStyle))},...layerOrderItems(spread.id,'text',first.id),{label:'Position / align to page',onClick:()=>{setPopover('position');setMore(null)}},{label:'Lock selected text',onClick:()=>patch({locked:true})}]}/>}
 </div>
}
