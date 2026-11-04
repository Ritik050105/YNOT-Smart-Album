import { PlaceholderRect } from '@/types'

/** Split a flattened layout at its background gutters; review ambiguous artwork before saving. */
export function detectTemplateFrames(data: Uint8ClampedArray, width: number, height: number): PlaceholderRect[] {
  const colors = new Map<string, number>()
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x > 1 && y > 1 && x < width - 2 && y < height - 2) continue
    const i = (y * width + x) * 4, key = [data[i], data[i+1], data[i+2]].map(v => Math.round(v / 16)).join(',')
    colors.set(key, (colors.get(key) ?? 0) + 1)
  }
  const bg = [...colors].sort((a,b) => b[1]-a[1])[0]?.[0].split(',').map(v => Number(v)*16) ?? [255,255,255]
  const mask = new Uint8Array(width*height)
  for (let i=0; i<mask.length; i++) mask[i] = data[i*4+3] > 32 && bg.some((v,c) => Math.abs(data[i*4+c]-v)>35) ? 1 : 0
  const frames: PlaceholderRect[] = []
  function split(x:number,y:number,w:number,h:number,depth:number) {
    if (depth>20 || frames.length>=100 || w<5 || h<5) return
    const rows = new Uint32Array(h), cols = new Uint32Array(w)
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(mask[(y+yy)*width+x+xx]){rows[yy]++;cols[xx]++}
    const left=cols.findIndex(v=>v>0),top=rows.findIndex(v=>v>0)
    if(left<0||top<0)return
    let right=w-1,bottom=h-1;while(!cols[right])right--;while(!rows[bottom])bottom--
    if(left||top||right<w-1||bottom<h-1){split(x+left,y+top,right-left+1,bottom-top+1,depth+1);return}
    for(const axis of ['x','y'] as const){const counts=axis==='x'?cols:rows
      for(let start=1;start<counts.length-1;start++)if(counts[start]===0){let end=start;while(end<counts.length&&counts[end]===0)end++
        if(end-start>=2 && end<counts.length){if(axis==='x'){split(x,y,start,h,depth+1);split(x+end,y,w-end,h,depth+1)}else{split(x,y,w,start,depth+1);split(x,y+end,w,h-end,depth+1)}return}start=end
      }
    }
    if(w*h<width*height*.002)return
    frames.push({id:crypto.randomUUID(),x:x/width,y:y/height,width:w/width,height:h/height,preferredOrientation:'any'})
  }
  split(0,0,width,height,0)
  return frames.sort((a,b)=>a.y-b.y||a.x-b.x)
}
