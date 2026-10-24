import { Spread } from '@/types'

export type BackgroundPattern = NonNullable<Spread['backgroundPattern']>

export function isBackgroundPattern(value: unknown): value is BackgroundPattern {
  if (!value || typeof value !== 'object') return false
  const pattern = value as Partial<BackgroundPattern>
  return typeof pattern.name === 'string' && typeof pattern.src === 'string' && /^data:image\/(png|jpeg);base64,/.test(pattern.src) && typeof pattern.tileSizePx === 'number' && Number.isFinite(pattern.tileSizePx) && pattern.tileSizePx >= 8 && pattern.tileSizePx <= 512
}

export function builtInPatterns(): BackgroundPattern[] {
  const originals = ['Fine dots', 'Diagonal lines', 'Grid', 'Chevron'].map((name, index) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 16
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Pattern preview unavailable.')
    ctx.fillStyle = ctx.strokeStyle = '#9c6b49'
    ctx.globalAlpha = 0.25
    ctx.beginPath()
    if (index === 0) { ctx.arc(8, 8, 1, 0, Math.PI * 2); ctx.fill() }
    if (index === 1) { ctx.moveTo(0, 16); ctx.lineTo(16, 0); ctx.stroke() }
    if (index === 2) { ctx.moveTo(0, 16); ctx.lineTo(0, 0); ctx.lineTo(16, 0); ctx.stroke() }
    if (index === 3) { ctx.moveTo(-8, 4); ctx.lineTo(0, 12); ctx.lineTo(8, 4); ctx.lineTo(16, 12); ctx.lineTo(24, 4); ctx.stroke() }
    return { name, tileSizePx: 32, src: canvas.toDataURL('image/png') }
  })
  const names = ['Solid black', 'Anchors', 'Bold diagonal stripes', 'Scattered dots', 'Staggered polka dots', 'Tiny crosses', 'Ornamental lattice', 'Vertical stripes', 'Waves', 'Bold chevron', 'Polka dot grid', 'Fine herringbone', 'Leaf fans', 'Floral sprigs', 'Four-point stars', 'Interlocking chevrons', 'Woven geometry', 'Cube lattice', 'Diamond plaid', 'Greek key maze', 'Petal lattice', 'Angular diamonds', 'Damask', 'Dark herringbone', 'Nested triangles', 'Horizontal stripes']
  const additions = names.map((name, index) => {
    // Draw at 4x tile resolution so thin motifs stay crisp in print.
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256
    const c = canvas.getContext('2d')!
    c.scale(4,4); c.fillStyle='#fff'; c.fillRect(0,0,64,64); c.fillStyle=c.strokeStyle='#000'; c.lineWidth=1
    const line=(points:number[][])=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke()}
    const dot=(x:number,y:number,r:number)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill()}
    const leaf=(x:number,y:number,angle:number)=>{c.save();c.translate(x,y);c.rotate(angle);c.beginPath();c.ellipse(0,-5,2.5,7,0,0,Math.PI*2);c.fill();c.restore()}
    switch(index){
      case 0: c.fillRect(0,0,64,64);break
      case 1:
        for(const [x,y] of [[16,16],[48,48]]){c.lineWidth=1.5;line([[x,y-8],[x,y+9]]);line([[x-4,y-4],[x+4,y-4]]);c.beginPath();c.arc(x,y-10,2,0,Math.PI*2);c.stroke();c.beginPath();c.arc(x,y+1,8,0,Math.PI);c.stroke();line([[x-8,y+1],[x-5,y+4]]);line([[x+8,y+1],[x+5,y+4]])}dot(48,16,1);dot(16,48,1);break
      case 2:c.lineWidth=10;for(let x=-64;x<128;x+=16)line([[x,64],[x+64,0]]);break
      case 3:for(let i=0;i<28;i++)dot((i*23+7)%64,(i*37+11)%64,i%3===0?1.8:.8);break
      case 4:case 10:for(let y=8;y<64;y+=16)for(let x=8;x<80;x+=16)dot(x-(index===4&&y%32===24?8:0),y,6);break
      case 5:for(let y=8;y<64;y+=16)for(let x=8;x<64;x+=16){line([[x-2,y],[x+2,y]]);line([[x,y-2],[x,y+2]])}break
      case 6:for(let y=0;y<=64;y+=32)for(let x=0;x<=64;x+=32){line([[x,y-14],[x+14,y],[x,y+14],[x-14,y],[x,y-14]]);dot(x,y,3);for(const [dx,dy]of [[0,-14],[14,0],[0,14],[-14,0]])dot(x+dx,y+dy,2)}break
      case 7:case 25:for(let x=0;x<64;x+=16)index===7?c.fillRect(x,0,8,64):c.fillRect(0,x,64,8);break
      case 8:for(let y=-8;y<80;y+=8){c.lineWidth=2;c.beginPath();for(let x=0;x<=64;x++)x?c.lineTo(x,y+3*Math.sin(x*Math.PI/16)):c.moveTo(x,y);c.stroke()}break
      case 9:case 15:c.lineWidth=index===9?3:5;for(let y=-32;y<96;y+=16){const points=[];for(let x=-16;x<=80;x+=8)points.push([x,y+(x%16===0?0:8)+(index===15?x/2:0)]);line(points)}break
      case 11:case 23:if(index===23){c.fillRect(0,0,64,64);c.strokeStyle='#fff'}for(let x=-16;x<80;x+=16){line([[x,0],[x,64]]);for(let y=-8;y<72;y+=8)line([[x,y],[x+8,y+4],[x+16,y]])}break
      case 14:for(let y=0;y<64;y+=16)for(let x=0;x<64;x+=16){c.beginPath();c.moveTo(x+8,y);c.quadraticCurveTo(x+8,y+8,x+16,y+8);c.quadraticCurveTo(x+8,y+8,x+8,y+16);c.quadraticCurveTo(x+8,y+8,x,y+8);c.quadraticCurveTo(x+8,y+8,x+8,y);c.fill()}break
      case 22:for(let y=0;y<=64;y+=32)for(let x=0;x<=64;x+=32){for(let i=0;i<8;i++){c.save();c.translate(x,y);c.rotate(i*Math.PI/4);c.beginPath();c.ellipse(0,-8,3,7,0,0,Math.PI*2);c.stroke();c.restore()}dot(x,y,3);line([[x-4,y+16],[x,y+12],[x+4,y+16]])}break
      case 12:for(let y=0;y<=64;y+=32)for(let x=0;x<=64;x+=32){for(let i=0;i<8;i++)leaf(x,y,i*Math.PI/4);if(index!==12){for(let i=0;i<8;i++)leaf(x+8*Math.sin(i*Math.PI/4),y+8*Math.cos(i*Math.PI/4),i*Math.PI/4);dot(x,y,3)}}break
      case 13:for(const [x,y]of [[16,16],[48,48]]){line([[x-8,y+14],[x+8,y-14]]);for(let i=-2;i<=2;i++){leaf(x+i*3,y-i*5,.8);leaf(x+i*3,y-i*5,-1.5)}for(let i=0;i<6;i++)dot(x+9+3*Math.cos(i*Math.PI/3),y-15+3*Math.sin(i*Math.PI/3),2)}break
      case 16:case 19:for(let y=-16;y<80;y+=16)for(let x=-16;x<80;x+=16){c.save();c.translate(x,y);c.rotate(Math.PI/4);line([[-8,-8],[8,-8],[8,8],[-4,8],[-4,-2],[2,-2],[2,3]]);if(index===16)line([[-6,-6],[5,-6],[5,6]]);c.restore()}break
      case 17:for(let y=-16;y<80;y+=24)for(let x=0;x<=64;x+=16){const yy=y+(x%32?12:0);line([[x,yy-8],[x+8,yy-4],[x+8,yy+4],[x,yy+8],[x-8,yy+4],[x-8,yy-4],[x,yy-8],[x,yy],[x+8,yy-4]]);line([[x,yy],[x,yy+8]]);line([[x,yy],[x-8,yy-4]])}break
      case 18:case 21:for(let x=-64;x<128;x+=16){line([[x,0],[x+64,64]]);line([[x,64],[x+64,0]]);if(index===18){line([[x+3,0],[x+67,64]]);dot((x+64)%64,32,2)}}break
      case 20:for(let y=0;y<=64;y+=16)for(let x=0;x<=64;x+=16)for(let i=0;i<4;i++){c.save();c.translate(x,y);c.rotate(i*Math.PI/4);c.beginPath();c.ellipse(0,0,12,3,0,0,Math.PI*2);c.stroke();c.restore()}break
      case 24:for(let y=0;y<64;y+=32)for(let x=0;x<64;x+=32)for(let n=0;n<5;n++){const d=n*3;line([[x+16,y+d],[x+32-d,y+32-d/2],[x+d,y+32-d/2],[x+16,y+d]])}break
    }
    return {name,src:canvas.toDataURL('image/png'),tileSizePx:64}
  })
  return [...originals, ...additions]

}

export function readDraggedPattern(transfer: Pick<DataTransfer, 'getData'>): BackgroundPattern | null {
  try {
    const pattern = JSON.parse(transfer.getData('application/x-album-pattern'))
    return isBackgroundPattern(pattern) ? pattern : null
  } catch { return null }
}
