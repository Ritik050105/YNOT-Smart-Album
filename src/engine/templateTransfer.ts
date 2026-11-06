import {TemplateDefinition} from '@/types'
export function parseTemplateTransfer(contents:string):TemplateDefinition[]{
 if(contents.length>8*1024*1024)throw new Error('Template file is too large.')
 const data=JSON.parse(contents)
 if(!data||data.format!=='ynot-templates'||data.version!==1||!Array.isArray(data.templates)||data.templates.length>500)throw new Error('Choose a YNOT template export.')
 const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)
 return data.templates.map((t:TemplateDefinition)=>{
  if(!t||typeof t.name!=='string'||t.name.length>200||!['spread','left','right','single'].includes(t.pageSide)||!Array.isArray(t.placeholders)||t.placeholders.length<1||t.placeholders.length>100||t.photoCount!==t.placeholders.length)throw new Error('Invalid template details.')
  for(const name of [t.category,t.subcategory])if(name!==undefined&&(typeof name!=='string'||!name.trim()||name.length>100||['__proto__','constructor','prototype'].includes(name)))throw new Error('Invalid template classification.')
  if(t.kind!==undefined&&!['image','mixed'].includes(t.kind))throw new Error('Invalid template type.')
  if(t.placeholders.some(p=>!p||typeof p.id!=='string'||![p.x,p.y,p.width,p.height].every(finite)||p.x<0||p.y<0||p.width<=0||p.height<=0||p.x+p.width>1.001||p.y+p.height>1.001||(p.cornerRadiusPx!==undefined&&(!finite(p.cornerRadiusPx)||p.cornerRadiusPx<0||p.cornerRadiusPx>450))||(p.cornerRadiiPx!==undefined&&(!Array.isArray(p.cornerRadiiPx)||p.cornerRadiiPx.length!==4||p.cornerRadiiPx.some(r=>!finite(r)||r<0||r>450)))))throw new Error('Invalid frame geometry.')
  if(t.backgroundColor!==undefined&&(typeof t.backgroundColor!=='string'||!/^#[0-9a-f]{6}$/i.test(t.backgroundColor)))throw new Error('Invalid template background colour.')
  if(new Set(t.placeholders.map(p=>p.id)).size!==t.placeholders.length)throw new Error('Duplicate frame identifiers.')
  if(t.textBoxes&&(!Array.isArray(t.textBoxes)||t.textBoxes.length>200||t.textBoxes.some(b=>!b||typeof b.text!=='string'||b.text.length>20000||typeof b.fontFamily!=='string'||typeof b.color!=='string'||![b.x,b.y,b.width,b.height,b.fontSize,b.rotationDeg??0].every(finite)||b.width<=0||b.height<=0||b.fontSize<1||b.fontSize>1000||!['left','center','right'].includes(b.align))))throw new Error('Invalid text template.')
  for(const b of t.textBoxes??[]){if(b.shape!==undefined&&!['rectangle','circle','triangle','line'].includes(b.shape))throw new Error('Invalid shape');if(b.shapeStrokeStyle!==undefined&&!['solid','dashed','short-dashed','dotted'].includes(b.shapeStrokeStyle))throw new Error('Invalid stroke style');if(b.sourceArtwork){const a=b.sourceArtwork;if(!finite(a.fontRatio)||a.fontRatio<=0||typeof a.src!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(a.src)||a.src.length>4*1024*1024||typeof a.text!=='string'||typeof a.fontFamily!=='string'||typeof a.color!=='string'||typeof a.bold!=='boolean'||typeof a.italic!=='boolean')throw new Error('Invalid quote artwork.');}for(const [field,min,max] of [['letterSpacing',-5,30],['lineHeight',.5,3],['opacity',0,1],['fillOpacity',0,1],['shapeStrokeWidth',0,40]] as const){const value=b[field];if(value!==undefined&&(!finite(value)||value<min||value>max))throw new Error('Invalid text appearance value.')}if(b.width>2||b.height>2||Math.abs(b.x)>2||Math.abs(b.y)>2)throw new Error('Text geometry exceeds the spread.');for(const e of Object.values(b.effects??{})){if(!e||typeof e.enabled!=='boolean'||typeof e.color!=='string'||e.color.length>100||![e.size,e.opacity,e.angle,e.distance].every(finite)||e.size<0||e.size>100||e.distance<0||e.distance>100||e.opacity<0||e.opacity>1)throw new Error('Invalid text effect.')
   for(const [field,min,max] of [['soften',0,30],['depth',0,1000],['altitude',0,90],['spread',0,100],['noise',0,100],['jitter',0,100],['range',1,100],['scale',1,400],['offsetX',-100,100],['offsetY',-100,100],['highlightOpacity',0,1],['shadowOpacity',0,1]] as const){
    const value=e[field]
    if(value!==undefined&&(!finite(value)||value<min||value>max))throw new Error('Invalid text effect value.')
   }
  }}
  return {...t,id:crypto.randomUUID(),isBuiltIn:false,createdAt:new Date().toISOString(),thumbnailImage:undefined,thumbnailColor:'#3157c8'}
 })
}
// Two families, and only two: what ships with the app is a Smart design, and what a designer saves
// or imports is a Creative design. There used to be a third, "Random generation", for the grid
// permutations — but a generated grid is simply one of the layouts the app offers, and splitting
// them out left a category that named a mechanism rather than anything a designer would look for.
export function templateCategory(t:TemplateDefinition):'reference'|'creative'{return t.isBuiltIn?'reference':'creative'}
