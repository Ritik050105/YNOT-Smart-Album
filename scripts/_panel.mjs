import { build } from 'esbuild'
const r = await build({stdin:{contents:`export {templatesForCount,importedDesignTemplates,uniqueTemplates,isFullSpreadTemplate,templateFamilyLabel} from './src/engine/templates'
export {supportsUniformGap} from './src/engine/templateLayout'
export {templateCategory} from './src/engine/templateTransfer'
export {offeredLayouts} from './src/engine/layoutOffer'
export {rankTemplates,templateShapeMismatches,templateOrderMismatches} from './src/engine/templateMatching'`,resolveDir:process.cwd()},bundle:true,loader:{'.ttf':'dataurl'},platform:'node',format:'esm',write:false})
const m = await import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`)
const L=i=>({id:'l'+i,width:1500,height:1000,src:''}),U=i=>({id:'p'+i,width:1000,height:1500,src:''})
for (const [aspect,n,photos] of [[1,5,Array.from({length:5},(_,i)=>U(i))],[1,5,[L(0),U(1),U(2),L(3),U(4)]],[1.5,6,Array.from({length:6},(_,i)=>i%2?U(i):L(i))]]) {
  const marginPx=4,gapPx=8
  const cands=m.uniqueTemplates([...m.templatesForCount(n,null,'all',aspect)]).filter(t=>!t.textBoxes?.length&&(m.templateCategory(t)!=='reference'||m.supportsUniformGap(t.placeholders,aspect,marginPx,gapPx)))
  for (const keep of [false,true]) {
    const fitting=m.offeredLayouts(photos,cands,aspect,marginPx,gapPx,keep)
    const miss=new Map(fitting.map(t=>[t.id,(keep?m.templateOrderMismatches:m.templateShapeMismatches)(photos,t,aspect,marginPx,gapPx)]))
    const rows=m.rankTemplates(photos,fitting,aspect,keep,marginPx,gapPx).sort((a,b)=>(miss.get(a.template.id)-miss.get(b.template.id))||Number(/^ref-(bleed|album|edge|signature)-/.test(b.template.id))-Number(/^ref-(bleed|album|edge|signature)-/.test(a.template.id))||Number(m.isFullSpreadTemplate(b.template))-Number(m.isFullSpreadTemplate(a.template)))
    const fam={}; rows.forEach(x=>{const f=m.templateFamilyLabel(x.template);fam[f]=(fam[f]||0)+1})
    const first=rows.slice(0,14).map(x=>m.templateFamilyLabel(x.template)[0]+(x.template.id.startsWith('mix-')?'*':'')).join('')
    console.log(`aspect ${aspect} n${n} keep=${keep}: ${rows.length} tiles; first14 ${first}`,JSON.stringify(fam))
  }
}
