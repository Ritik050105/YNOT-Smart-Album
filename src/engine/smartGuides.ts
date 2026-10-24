export type GuideRect = {x:number;y:number;width:number;height:number;keys?:string[]}
export type SmartGuide = {axis:'x'|'y';position:number;segments?:{from:number;to:number;keys?:string[]}[]}
// Only compare neighboring elements sharing a row or column with the moving frame.
function spacingTriples(rect:GuideRect,targets:GuideRect[],axis:'x'|'y') {
  const cross=axis==='x'?'y':'x',size=axis==='x'?'width':'height',crossSize=axis==='x'?'height':'width'
  const row=[rect,...targets.filter(t=>t[cross]<rect[cross]+rect[crossSize]&&t[cross]+t[crossSize]>rect[cross])].sort((a,b)=>a[axis]-b[axis])
  return row.slice(0,-2).map((_,i)=>row.slice(i,i+3)).filter(t=>t.includes(rect)&&t[1][axis]>=t[0][axis]+t[0][size]&&t[2][axis]>=t[1][axis]+t[1][size]&&Math.max(...t.map(r=>r[cross]))<Math.min(...t.map(r=>r[cross]+r[crossSize])))
}
export function snapRect(rect:GuideRect, targets:GuideRect[], width:number, height:number, threshold:number, anchor?:string, vertical:number[]=[], horizontal:number[]=[]) {
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
  return {rect:result,guides}
}
