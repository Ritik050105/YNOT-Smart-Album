import { TemplateDefinition } from '@/types'
import { placeGridInRect } from './templateLayout'

// Reference preview compositions; coordinates remain stable when a filter dims a card.
const compositions: [string, number[][]][] = [
  ['Portrait triptych', [[.1,.22,.25,.56],[.38,.22,.25,.56],[.66,.22,.25,.56]]],
  ['Square triptych', [[.09,.3,.25,.375],[.37,.3,.25,.375],[.65,.3,.25,.375]]],
  ['Portrait with six details', [[.16,.08,.17,.25],[.16,.36,.17,.25],[.16,.64,.17,.25],[.36,.08,.28,.81],[.67,.08,.17,.25],[.67,.36,.17,.25],[.67,.64,.17,.25]]],
  ['Three details and a hero', [[.1,.1,.25,.25],[.1,.38,.25,.25],[.1,.66,.25,.25],[5/9,0,4/9,1]]],
  ['Two details and a portrait', [[.08,.35,.17,.255],[.3,.35,.17,.255],[.6,.25,.34,.51]]],
  ['Feature and square details', [[.12,.2,.6,.6],[.75,.2,.12,.18],[.75,.41,.12,.18],[.75,.62,.12,.18]]],
  ['Panoramic statement', [[0,.2,1,.6]]],
  ['Vertical story', [[.22,.1,.26,.24],[.22,.38,.26,.24],[.22,.66,.26,.24],[.51,.1,.27,.8]]],
  ['Portrait and two landscapes', [[.1,.12,.23,.76],[.42,.12,.48,.29],[.42,.59,.48,.29]]],
  ['Edge to edge', [[0,0,1,1]]],
]
function makeTemplate(id: string, name: string, boxes: number[][]): TemplateDefinition {
  return {id, name, photoCount:boxes.length, pageSide:'spread', isBuiltIn:true, createdAt:new Date(0).toISOString(), thumbnailColor:'#b99572',
    placeholders:boxes.map(([x,y,width,height],i)=>({id:`${id}-p${i}`,x,y,width,height,preferredOrientation:'any'}))}
}
export const LIBRARY_PREVIEW_TEMPLATES = compositions.map(([name,boxes],i)=>makeTemplate(`editorial-preview-${i+1}`,name,boxes))

// Original editable compositions inspired by YNOT's magazine: feature photos, quiet margins,
// supporting sequences. Existing template IDs and geometry are never replaced.
export const EDITORIAL_TEMPLATES = [...LIBRARY_PREVIEW_TEMPLATES]
for (let count=1; count<=30; count++) {
  for (const inset of [.06,.12]) {
    for (const mirrored of [false,true]) {
      const id=`editorial-story-${count}-${inset===.06?'open':'quiet'}-${mirrored?'right':'left'}`
      const boxes = count===1 ? [[inset,inset,1-2*inset,1-2*inset]] : [
        [inset,.12,.47-inset,.76],
        ...placeGridInRect(1,count-1,.54,inset,.46-inset,1-2*inset).map(p=>[p.x,p.y,p.width,p.height]),
      ]
      // A centered single image is its own mirror.
      if(count===1 && mirrored) continue
      EDITORIAL_TEMPLATES.push(makeTemplate(id,`Editorial ${inset===.06?'Feature':'Quiet'} ${mirrored?'Right':'Left'} · ${count}`,boxes.map(([x,y,w,h])=>[mirrored?1-x-w:x,y,w,h])))
    }
  }
}
