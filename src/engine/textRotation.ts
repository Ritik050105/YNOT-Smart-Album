import {TextBox} from '@/types'
// Text stores a rotated top-left origin; move that origin to keep its visual center fixed.
export function rotateTextAroundCenter(box:TextBox,rotationDeg:number,aspect:number){
 const halfX=box.width/2,halfY=box.height/(2*aspect)
 const old=(box.rotationDeg??0)*Math.PI/180,next=rotationDeg*Math.PI/180
 return {rotationDeg,x:box.x+halfX*(Math.cos(old)-Math.cos(next))-halfY*(Math.sin(old)-Math.sin(next)),y:box.y+aspect*(halfX*(Math.sin(old)-Math.sin(next))+halfY*(Math.cos(old)-Math.cos(next)))}
}
