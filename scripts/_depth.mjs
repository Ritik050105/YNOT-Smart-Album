import { build } from 'esbuild'
const r = await build({stdin:{contents:`export {templatesForCount} from './src/engine/templates'
export {supportsUniformGap} from './src/engine/templateLayout'
export {templateCategory} from './src/engine/templateTransfer'
export {offeredLayouts} from './src/engine/layoutOffer'`,resolveDir:process.cwd()},bundle:true,loader:{'.ttf':'dataurl'},platform:'node',format:'esm',write:false})
const m = await import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`)
const L=i=>({id:'l'+i,width:1500,height:900}),U=i=>({id:'p'+i,width:900,height:1500})
for (const [mg,gp] of [[3,6],[14,28]]) for (const aspect of [1.5,1,0.678]) { const rows=[]
  for (const count of [3,4,5,6,8,10,12,16,20,24]) {
    const offered=m.templatesForCount(count,null,'all',aspect).filter(t=>!t.textBoxes?.length).filter(t=>m.templateCategory(t)!=='reference'||m.supportsUniformGap(t.placeholders,aspect,mg,gp))
    const sizes=[]
    for(let l=0;l<=count;l++){const photos=[...Array.from({length:l},(_,i)=>L(i)),...Array.from({length:count-l},(_,i)=>U(i))];sizes.push(m.offeredLayouts(photos,offered,aspect,mg,gp).length)}
    rows.push(`${count}:${Math.min(...sizes)}/${sizes.sort((a,b)=>a-b)[sizes.length>>1]}`)
  }
  console.log(`gap ${gp} aspect ${aspect} (min/median):`,rows.join('  '))
}
