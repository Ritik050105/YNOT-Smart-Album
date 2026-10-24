export type GuideRect = {x:number;y:number;width:number;height:number}
export function snapRect(rect:GuideRect, targets:GuideRect[], width:number, height:number, threshold:number, anchor?:string, vertical:number[]=[], horizontal:number[]=[]) {
  const xs=[0,width/2,width,...vertical,...targets.flatMap(r=>[r.x,r.x+r.width/2,r.x+r.width])]
  const ys=[0,height/2,height,...horizontal,...targets.flatMap(r=>[r.y,r.y+r.height/2,r.y+r.height])]
  const result={...rect}
  const guides:{axis:'x'|'y';position:number}[]=[]
  for(const axis of ['x','y'] as const){
    const size=axis==='x'?'width':'height',start=axis==='x'?'left':'top',end=axis==='x'?'right':'bottom'
    const offsets=anchor ? anchor.includes(start)?[0]:anchor.includes(end)?[rect[size]]:[] : [0,rect[size]/2,rect[size]]
    let best:{delta:number;position:number}|undefined
    for(const offset of offsets)for(const position of axis==='x'?xs:ys){
      const delta=position-rect[axis]-offset
      if(Math.abs(delta)<=threshold&&(!best||Math.abs(delta)<Math.abs(best.delta)))best={delta,position}
    }
    if(!best)continue
    if(!anchor)result[axis]+=best.delta
    else if(anchor.includes(start)){result[axis]+=best.delta;result[size]-=best.delta}
    else result[size]+=best.delta
    if(result[size]<4){result[axis]=rect[axis];result[size]=rect[size];continue}
    guides.push({axis,position:best.position})
  }
  return {rect:result,guides}
}
