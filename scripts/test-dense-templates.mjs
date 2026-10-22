import assert from 'node:assert/strict'
import { build } from 'esbuild'
const bundle = await build({stdin:{contents:`export * from './src/engine/templates';export * from './src/engine/templateLayout';export * from './src/engine/templateMatching';export * from './src/engine/layoutMath';export * from './src/engine/cropFit';export * from './src/engine/autoLayout';export {PreviewCell} from './src/components/TemplatePreview'`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false})
const {BUILT_IN_TEMPLATES,resolveTemplateFrames,computePlaceholderBoxes,computeCoverCrop,rankTemplates,buildSpreadsFromGroups,PreviewCell} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
let checked = 0, worstBestCrop = 0
for (let count=20;count<=30;count++) {
  const candidates = BUILT_IN_TEMPLATES.filter(t=>t.photoCount===count)
  const photos = Array.from({length:count},(_,i)=>({id:String(i),width:[900,600,700,1600,400,1200][i%6],height:[600,900,700,400,1200,800][i%6]}))
  for (const aspect of [0.75,1.5,3]) for (const marginPx of [0,24,60]) for (const gapPx of [8,20,40]) {
    for (const template of candidates) {
      const spread = {templateId:template.id,marginPx,gapPx,flipped:false}
      const normalized = resolveTemplateFrames(template.placeholders,aspect,marginPx,gapPx)
      const boxes = computePlaceholderBoxes(spread,900,900/aspect)
      const exportBoxes = computePlaceholderBoxes(spread,3600,3600/aspect)
      const flipped = computePlaceholderBoxes({...spread,flipped:true},900,900/aspect)
      boxes.forEach((box,i)=>{
        assert.ok(box.width>0&&box.height>0,`${template.id}: gap consumes frame`)
        assert.ok(box.width>=template.placeholders[i].width*(900-marginPx*2)/2-1e-8)
        assert.ok(box.height>=template.placeholders[i].height*(900/aspect-marginPx*2)/2-1e-8)
        for (const key of ['x','y','width','height']) assert.ok(Math.abs(exportBoxes[i][key]-box[key]*4)<1e-8,`Export scaling: ${template.id}`)
        assert.ok(Math.abs(normalized[i].width*900-box.width)<1e-8)
        assert.ok(Math.abs(normalized[i].height*900/aspect-box.height)<1e-8)
        assert.ok(Math.abs(flipped[i].x-(900-box.x-box.width))<1e-8)
        const photo=photos[i]
        for (const [focalX,focalY,zoom] of [[0.5,0.5,1],[0,1,2],[1,0,4]]) {
          const crop=computeCoverCrop(photo.width,photo.height,box.width,box.height,focalX,focalY,zoom)
          assert.ok(Object.values(crop).every(Number.isFinite))
          assert.ok(crop.cropWidth>0&&crop.cropHeight>0&&crop.cropX>=0&&crop.cropY>=0)
          assert.ok(crop.cropX+crop.cropWidth<=photo.width+1e-8&&crop.cropY+crop.cropHeight<=photo.height+1e-8)
          assert.ok(Math.abs(crop.cropWidth/crop.cropHeight-box.width/box.height)<1e-8,`Distorted crop: ${template.id}`)
        }
      })
      checked++
    }
  }
  for (const aspect of [0.75,1.5,3]) for (const keepOrder of [true,false]) {
    const ranked = rankTemplates(photos,candidates,aspect,keepOrder,24,8)
    assert.ok(ranked[0].score<0.6,`No useful crop for ${count} mixed photos at ${aspect}`)
    worstBestCrop=Math.max(worstBestCrop,ranked[0].score)
    const spread=buildSpreadsFromGroups([photos],{backgroundColor:'#fff',marginPx:24,gapPx:8,borderWidth:0,borderColor:'#fff'},null,{start:'spread',end:'spread',aspect,includeFullSpreadTemplates:true},keepOrder)[0]
    assert.equal(new Set(spread.placements.map(p=>p.photoId)).size,count)
    if (keepOrder) assert.deepEqual(spread.placements.map(p=>p.photoId),photos.map(p=>p.id))
    const frames=resolveTemplateFrames(ranked[0].template.placeholders,aspect,24,8)
    frames.forEach((ph,i)=>{
      const photo=ranked[0].photos[i],placement={focalX:i%3/2,focalY:1-i%3/2,zoom:i%2+1,flipHorizontal:i%2===0}
      const crop=computeCoverCrop(photo.width,photo.height,ph.width*aspect,ph.height,placement.focalX,placement.focalY,placement.zoom)
      const style=PreviewCell({ph,photo,placement,aspect}).props.style
      const [sizeX,sizeY]=style.backgroundSize.split(' ').map(parseFloat)
      const [posX,posY]=style.backgroundPosition.split(' ').map(parseFloat)
      assert.ok(Math.abs(sizeX-100*photo.width/crop.cropWidth)<1e-8)
      assert.ok(Math.abs(sizeY-100*photo.height/crop.cropHeight)<1e-8)
      assert.ok(Math.abs((photo.width-crop.cropWidth)*posX/100-crop.cropX)<1e-8)
      assert.ok(Math.abs((photo.height-crop.cropHeight)*posY/100-crop.cropY)<1e-8)
      assert.equal(style.transform,`scale(${placement.flipHorizontal?-1:1}, 1)`)
    })
  }
}
console.log(`Dense template checks passed: ${checked} template/appearance combinations, 20–30 mixed photos, crop bounds/focal points/zoom, mirrored and 4× export geometry. Worst best-match average crop loss: ${(worstBestCrop*100).toFixed(1)}%.`)
