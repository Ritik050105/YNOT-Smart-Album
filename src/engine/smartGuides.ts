export type GuideRect = {x:number;y:number;width:number;height:number;keys?:string[]}
export type SmartGuide = {axis:'x'|'y';position:number;bands?:GuideRect[];matches?:GuideRect[];segments?:{from:number;to:number;keys?:string[]}[]}
/** Each shared measurement addresses the selected units together, including whole groups. */
export function selectedSpacingGuides(units:GuideRect[]):SmartGuide[] {
  if(units.length<2)return []
  const keys=[...new Set(units.flatMap(u=>u.keys??[]))]
  return (['x','y'] as const).flatMap(axis=>{
    const size=axis==='x'?'width':'height',cross=axis==='x'?'y':'x',crossSize=axis==='x'?'height':'width'
    const sorted=[...units].sort((a,b)=>a[axis]-b[axis])
    const gaps=sorted.slice(1).map((b,i)=>b[axis]-sorted[i][axis]-sorted[i][size])
    if(gaps.some(g=>g<0||Math.abs(g-gaps[0])>.01))return []
    return sorted.slice(1).map((b,i)=>{const a=sorted[i];return {axis,position:(a[cross]+a[crossSize]/2+b[cross]+b[crossSize]/2)/2,segments:[{from:a[axis]+a[size],to:b[axis],keys}]}})
  })
}
/** Adjacent stationary gaps in the same row or column provide spacing references. */
export function nearbySpacingGaps(rect:GuideRect,targets:GuideRect[],axis:'x'|'y') {
  const cross=axis==='x'?'y':'x',size=axis==='x'?'width':'height',crossSize=axis==='x'?'height':'width'
  const row=targets.filter(t=>t[cross]<rect[cross]+rect[crossSize]&&t[cross]+t[crossSize]>rect[cross]).sort((a,b)=>a[axis]-b[axis])
  return row.slice(1).flatMap((b,i)=>{
    const a=row[i],from=a[axis]+a[size],to=b[axis],low=Math.max(a[cross],b[cross],rect[cross]),high=Math.min(a[cross]+a[crossSize],b[cross]+b[crossSize],rect[cross]+rect[crossSize])
    return to>=from&&high>low?[{gap:to-from,guide:{axis,position:(low+high)/2,segments:[{from,to}]} as SmartGuide}]:[]
  })
}
// Only compare neighboring elements sharing a row or column with the moving frame.
function spacingTriples(rect:GuideRect,targets:GuideRect[],axis:'x'|'y') {
  const cross=axis==='x'?'y':'x',size=axis==='x'?'width':'height',crossSize=axis==='x'?'height':'width'
  const row=[rect,...targets.filter(t=>t[cross]<rect[cross]+rect[crossSize]&&t[cross]+t[crossSize]>rect[cross])].sort((a,b)=>a[axis]-b[axis])
  return row.slice(0,-2).map((_,i)=>row.slice(i,i+3)).filter(t=>t.includes(rect)&&t[1][axis]>=t[0][axis]+t[0][size]&&t[2][axis]>=t[1][axis]+t[1][size]&&Math.max(...t.map(r=>r[cross]))<Math.min(...t.map(r=>r[cross]+r[crossSize])))
}
export function snapRect(rect:GuideRect, targets:GuideRect[], width:number, height:number, threshold:number, anchor?:string, vertical:number[]=[], horizontal:number[]=[],initialGap=0) {
  const xs=[0,width/2,width,...vertical,...targets.flatMap(r=>[r.x,r.x+r.width/2,r.x+r.width])]
  const ys=[0,height/2,height,...horizontal,...targets.flatMap(r=>[r.y,r.y+r.height/2,r.y+r.height])]
  const result={...rect}
  const guides:SmartGuide[]=[]
  for(const axis of ['x','y'] as const){
    const size=axis==='x'?'width':'height',start=axis==='x'?'left':'top',end=axis==='x'?'right':'bottom'
    const offsets=anchor ? anchor.includes(start)?[0]:anchor.includes(end)?[rect[size]]:[] : [0,rect[size]/2,rect[size]]
    let best:{delta:number;position?:number}|undefined
    for(const offset of offsets)for(const position of axis==='x'?xs:ys){
      const delta=position-rect[axis]-offset
      if(Math.abs(delta)<=threshold&&(!best||Math.abs(delta)<Math.abs(best.delta)))best={delta,position}
    }
    if(offsets.length)for(const triple of spacingTriples(rect,targets,axis)){
      const difference=(delta:number)=>{const moved={...rect};if(!anchor)moved[axis]+=delta;else if(anchor.includes(start)){moved[axis]+=delta;moved[size]-=delta}else moved[size]+=delta
        const [a,b,c]=triple.map(t=>t===rect?moved:t);return (b[axis]-a[axis]-a[size])-(c[axis]-b[axis]-b[size])}
      const error=difference(0),slope=difference(1)-error
      if(!slope)continue
      const delta=-error/slope
      if(Math.abs(delta)<=threshold&&(!best||Math.abs(delta)<Math.abs(best.delta)))best={delta}
    }
    if(anchor && offsets.length)for(const target of targets){
      const delta=(anchor.includes(start)?-1:1)*(target[size]-rect[size])
      if(target[size]>=4&&Math.abs(delta)<=threshold&&(!best||Math.abs(delta)<Math.abs(best.delta)))best={delta}
    }
    if(!best)continue
    if(!anchor)result[axis]+=best.delta
    else if(anchor.includes(start)){result[axis]+=best.delta;result[size]-=best.delta}
    else result[size]+=best.delta
    if(result[size]<4){result[axis]=rect[axis];result[size]=rect[size];continue}
    if(best.position!==undefined)guides.push({axis,position:best.position})
  }
  for(const axis of ['x','y'] as const){
    const size=axis==='x'?'width':'height',cross=axis==='x'?'y':'x',crossSize=axis==='x'?'height':'width'
    for(const [a,b,c] of spacingTriples(result,targets,axis)){
      const gap=b[axis]-a[axis]-a[size]
      if(gap<0||Math.abs(gap-(c[axis]-b[axis]-b[size]))>.01)continue
      const position=(Math.max(a[cross],b[cross],c[cross])+Math.min(a[cross]+a[crossSize],b[cross]+b[crossSize],c[cross]+c[crossSize]))/2
      guides.push({axis,position,segments:[{from:a[axis]+a[size],to:b[axis],...(a.keys&&b.keys?{keys:[...a.keys,...b.keys]}:{})},{from:b[axis]+b[size],to:c[axis],...(b.keys&&c.keys?{keys:[...b.keys,...c.keys]}:{})}]})
    }
  }
  // Fill only unobstructed, equal positive gaps involving the manipulated frame.
  for(const axis of ['x','y'] as const){
    const size=axis==='x'?'width':'height',cross=axis==='x'?'y':'x',crossSize=axis==='x'?'height':'width'
    const units=[result,...targets],pairs:{a:GuideRect;b:GuideRect;gap:number;band:GuideRect}[]=[]
    for(const a of units)for(const b of units){
      const from=a[axis]+a[size],gap=b[axis]-from,low=Math.max(a[cross],b[cross]),high=Math.min(a[cross]+a[crossSize],b[cross]+b[crossSize])
      if(gap<=.01||high<=low||units.some(c=>c!==a&&c!==b&&c[axis]<b[axis]&&c[axis]+c[size]>from&&c[cross]<high&&c[cross]+c[crossSize]>low))continue
      pairs.push({a,b,gap,band:axis==='x'?{x:from,y:low,width:gap,height:high-low}:{x:low,y:from,width:high-low,height:gap}})
    }
    const matches=pairs.filter(p=>((p.a===result||p.b===result)&&initialGap>0&&Math.abs(p.gap-initialGap)<.01)||pairs.some(q=>q!==p&&Math.abs(q.gap-p.gap)<.01&&(q.a===result||q.b===result||p.a===result||p.b===result)))
    for(const p of matches){
      const from=p.a[axis]+p.a[size],to=p.b[axis],position=p.band[cross]+p.band[crossSize]/2
      const existing=guides.find(g=>g.axis===axis&&g.segments?.some(s=>Math.abs(s.from-from)<.01&&Math.abs(s.to-to)<.01)&&Math.abs(g.position-position)<.01)
      if(existing)(existing.bands??=[]).push(p.band)
      else guides.push({axis,position,bands:[p.band],segments:[{from,to,...(p.a.keys&&p.b.keys?{keys:[...p.a.keys,...p.b.keys]}:{})}]})
    }
  }
  if(anchor)for(const axis of ['x','y'] as const){
    const size=axis==='x'?'width':'height'
    if(!anchor.includes(axis==='x'?'left':'top')&&!anchor.includes(axis==='x'?'right':'bottom'))continue
    const matches=targets.filter(t=>Math.abs(t[size]-result[size])<.01)
    if(matches.length)guides.push({axis,position:0,matches:[result,...matches]})
  }
  return {rect:result,guides}
}
