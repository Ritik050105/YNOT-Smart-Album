import { Spread } from '@/types'
import { computePlaceholderBoxes } from './layoutMath'

/** A frame as fractions of the card (0-1 each way). */
export type Rect={x:number;y:number;w:number;h:number}

/** A key for each placement: its photograph's id, numbered when the same photograph is on the spread more than once (the nth time
 *  gets `#n`). Keyed by the photograph alone, two placements of one photograph were one entry, and every repeat of a photograph was
 *  drawn on top of its first appearance for the whole of a move, so a spread of twelve with only a few pictures repeated showed
 *  those few travelling and the rest absent until the move ended. Layout changes keep the photographs in order, so the nth
 *  appearance of a photograph before is the nth after. */
export function placementKeys(spread:Spread){
  const seen=new Map<string,number>(),out=new Map<string,string>()
  for(const p of spread.placements){
    if(!p.photoId)continue
    const n=(seen.get(p.photoId)??0)+1
    seen.set(p.photoId,n)
    out.set(p.placeholderId,n===1?p.photoId:`${p.photoId}#${n}`)
  }
  return out
}

/** Where each placement's frame sits on the card, by placement key, as fractions of the card. */
export function frameRects(spread:Spread,previewHeight:number){
  const keys=placementKeys(spread),out=new Map<string,Rect>()
  for(const box of computePlaceholderBoxes(spread,100,previewHeight)){
    const key=keys.get(box.placeholderId)
    if(key&&!out.has(key))out.set(key,{x:box.x/100,y:box.y/previewHeight,w:box.width/100,h:box.height/previewHeight})
  }
  return out
}

