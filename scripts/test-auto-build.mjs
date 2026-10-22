import assert from 'node:assert/strict'
import { build } from 'esbuild'
import fs from 'node:fs'
const result=await build({stdin:{contents:`export * from './src/engine/autoLayout';export * from './src/engine/templates';export * from './src/engine/templateMatching';export {useProjectStore} from './src/state/projectStore'`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false})
const {findTemplate,useProjectStore,matchTemplatePhotos,rankTemplates,templatesForCount,matchesFrameFilter,setUserTemplateRegistry,buildSpreadsFromGroups,groupPhotosForCount,groupPhotosIntoMoments,sortPhotosByCapturedAt,autoBuildSpreads}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const photo=(id,ratio=1.5,time=0)=>({id:String(id),width:ratio*100,height:100,orientation:ratio<1?'portrait':'landscape',capturedAt:new Date(time*60000).toISOString()})
const template=(id,ratios)=>({id,photoCount:ratios.length,placeholders:ratios.map((ratio,index)=>({id:String(index),x:0,y:0,width:ratio/4,height:0.25})),pageSide:'spread',isBuiltIn:false})
const square=template('square',[1])
assert.equal(matchesFrameFilter(square,'no-square',1),false)
assert.equal(matchesFrameFilter(square,'no-square',2),true)
assert.equal(matchesFrameFilter(square,'only-3x2',1.5),true)
assert.equal(matchesFrameFilter(square,'only-3x2',1),false)
assert.deepEqual(templatesForCount(3,['full-bleed']),[],'An incompatible library must not be silently bypassed')
assert.ok(templatesForCount(2).every((template)=>template.id!=='cover-front-spine-back'),'Cover templates are not interior Auto Build candidates')
const good=template('good',[2/3,1.5]),bad=template('bad',[3,3])
const mixed=[photo(0,2/3),photo(1,1.5)]
assert.equal(rankTemplates(mixed,[bad,good])[0].template.id,'good')
assert.deepEqual(matchTemplatePhotos([...mixed].reverse(),good,1,false).photos.map((p)=>p.id),['0','1'])
assert.deepEqual(matchTemplatePhotos([...mixed].reverse(),good,1,true).photos.map((p)=>p.id),['1','0'])
function permutations(values){return values.length?values.flatMap((value,i)=>permutations(values.filter((_,j)=>j!==i)).map((rest)=>[value,...rest])):[[]]}
for(let seed=1;seed<=8;seed++) {
  const photos=Array.from({length:5},(_,i)=>photo(i,0.4+((seed*13+i*7)%19)/7))
  const candidate=template('candidate',Array.from({length:5},(_,i)=>0.3+((seed*7+i*11)%17)/6))
  const best=Math.min(...permutations(photos).map((order)=>matchTemplatePhotos(order,candidate).score))
  assert.ok(Math.abs(matchTemplatePhotos(photos,candidate,1,false).score-best)<1e-9,'Assignment must match the brute-force optimum')
}
setUserTemplateRegistry([good,bad])
const appearance={backgroundColor:'#fff',gapPx:0,marginPx:0,borderWidth:0,borderColor:'#fff'}
assert.equal(buildSpreadsFromGroups([mixed],appearance,['bad','good'])[0].templateId,'good')
assert.throws(()=>buildSpreadsFromGroups([mixed],appearance,['full-bleed']),/No enabled template/)
assert.throws(()=>buildSpreadsFromGroups([mixed],{...appearance,marginPx:500},['good']),/usable frame/)
assert.equal(buildSpreadsFromGroups([mixed],appearance,['good'],{start:'single',end:'spread',includeFullSpreadTemplates:true})[0].pageSide,'right')
assert.equal(buildSpreadsFromGroups([mixed,mixed],appearance,['good'],{start:'spread',end:'single',includeFullSpreadTemplates:true})[1].pageSide,'left')
assert.deepEqual(buildSpreadsFromGroups([mixed,mixed],appearance,['bad','good'],undefined,true,false,'medium').map((spread)=>spread.templateId),['good','good'],'Medium reuse must not sacrifice a substantially better crop')
const reversedFrames={...good,id:'right-first',placeholders:[{...good.placeholders[1],x:0.6},{...good.placeholders[0],x:0}]}
setUserTemplateRegistry([reversedFrames])
const ordered=buildSpreadsFromGroups([mixed],appearance,['right-first'])[0]
assert.deepEqual(ordered.placements.map((placement)=>placement.photoId),['0','1'])
assert.equal(ordered.placements[0].placeholderId,reversedFrames.placeholders[1].id,'Timeline order follows left-to-right frame position, not template storage order')
const rearranged=buildSpreadsFromGroups([mixed],appearance,['right-first'],undefined,false)[0]
assert.deepEqual(rearranged.placements.map(p=>p.photoId),['0','1'],'Rearranged Auto Build timeline must follow visible frame order too')
assert.deepEqual(rearranged.placements.map(p=>p.placeholderId),ordered.placements.map(p=>p.placeholderId))
const repeated=buildSpreadsFromGroups([[mixed[0],mixed[0]]],appearance,['right-first'])[0]
assert.deepEqual(repeated.placements.map(p=>p.placeholderId),ordered.placements.map(p=>p.placeholderId),'Repeated photo IDs cannot make physical frame order ambiguous')
setUserTemplateRegistry([])
const options={gapMinutes:20,maxPhotosPerSpread:6,matchTimelineOrder:true,groupBlackAndWhite:true,groupMetadata:true}
const referenceNine=Array.from({length:9},(_,i)=>({...photo(i+1,[1.5,2/3,1,3,0.4,1.5][i%6],i),cameraModel:'Camera A',isBlackAndWhite:i>=6}))
assert.deepEqual(groupPhotosForCount(referenceNine,3,options).map(g=>g.map(p=>p.id)),[['1','2','3'],['4','5','6'],['7','8','9']],'Live reference nine-photo default groups')
assert.deepEqual(groupPhotosForCount(referenceNine,4,options).map(g=>g.map(p=>p.id)),[['1','2','3'],['4','5','6'],['7','8'],['9']],'Manual spread count retains the recommended boundaries, matching the live reference')
const mixedDates=[photo('late',1.5,60),{...photo('unknown-a'),capturedAt:''},photo('early',1.5,0),{...photo('unknown-b'),capturedAt:'invalid'},photo('tied',1.5,0)]
const dateOrder=['early','tied','late','unknown-a','unknown-b']
assert.deepEqual(sortPhotosByCapturedAt(mixedDates).map(p=>p.id),dateOrder,'Unknown dates cannot prevent valid photos from sorting chronologically; ties and unknowns retain their input order')
assert.deepEqual(mixedDates.map(p=>p.id),['late','unknown-a','early','unknown-b','tied'],'Sorting does not mutate the photo pool')
assert.deepEqual(groupPhotosIntoMoments(mixedDates,options).flat().map(p=>p.id),dateOrder)
assert.deepEqual(groupPhotosForCount(mixedDates,2,options).flat().map(p=>p.id),dateOrder)
const libraryPhotos=Array.from({length:12},(_,i)=>photo(i))
const fourFrameId=templatesForCount(4)[0].id
assert.deepEqual(autoBuildSpreads(libraryPhotos,options,appearance,[fourFrameId]).map(spread=>spread.placements.length),[4,4,4],'Direct Auto Build must also find a feasible library grouping')
assert.throws(()=>autoBuildSpreads(libraryPhotos.slice(0,11),options,appearance,[fourFrameId]),/enabled templates cannot group/)
assert.deepEqual(autoBuildSpreads(libraryPhotos,options,appearance,[templatesForCount(3)[0].id,templatesForCount(5)[0].id]).map(spread=>spread.placements.length),[3,3,3,3],'Automatic count selection skips infeasible combinations of supported frame counts')
assert.deepEqual(groupPhotosForCount(libraryPhotos,3,options,1,30,size=>[2,4].includes(size)).map(group=>group.length),[4,4,4],'Grouping must use feasible enabled template counts')
assert.throws(()=>groupPhotosForCount(libraryPhotos,3,options,1,30,size=>size===2),/enabled templates cannot group/)
assert.deepEqual(groupPhotosForCount(libraryPhotos.slice(0,5),3,options,1,30,(size,index)=>size===(index===0?1:2)).map(group=>group.length),[1,2,2],'Single-page ends may use a different candidate pool')
const moments=Array.from({length:12},(_,i)=>photo(i,1.5,i<3?i:i<6?100+i:300+i))
const groups=groupPhotosForCount(moments,3,options,3,6)
assert.deepEqual(groups.map((group)=>group.length),[3,3,6],'Manual count must retain the two large time gaps')
for(let total=1;total<=80;total++) for(const [min,max] of [[1,6],[3,6],[5,6],[1,30]]) {
  const photos=Array.from({length:total},(_,i)=>photo(i,1.5,i))
  const count=Math.ceil(total/((min+max)/2))
  const grouped=groupPhotosForCount(photos,count,options,min,max)
  assert.deepEqual(grouped.flat().map((p)=>p.id),photos.map((p)=>p.id),'Every photo appears exactly once in timeline order')
  assert.ok(grouped.every((group)=>group.length>0&&group.length<=max))
  if(total>=grouped.length*min)assert.ok(grouped.every((group)=>group.length>=min))
}
assert.deepEqual(groupPhotosForCount(Array.from({length:12},(_,i)=>photo(i)),3,options).map((group)=>group.length),[3,3,6])
for (const total of [72,240,1200]) {
  const photos=Array.from({length:total},(_,i)=>({...photo(i,[2/3,1,1.5,3,0.4][i%5],i+Math.floor(i/18)*120),cameraModel:i%9<4?'A':'B',isBlackAndWhite:i%12<6}))
  const grouped=groupPhotosForCount(photos,Math.ceil(total/4),options,3,6)
  assert.deepEqual(grouped.flat().map(p=>p.id),photos.map(p=>p.id))
  assert.ok(grouped.every(group=>group.length>=3&&group.length<=6))
  if(total===72) {
    const direct=autoBuildSpreads(photos,options,appearance)
    assert.equal(direct.length,18,'Direct Auto Build and the dialog use the same 72-photo recommendation, independent of B&W/camera cut preferences')
    assert.deepEqual(direct.map(s=>s.placements.map(p=>p.photoId)),groupPhotosForCount(photos,18,options).map(g=>g.map(p=>p.id)),'Dialog and direct build agree on group boundaries at the same settings')
    for(const aspect of [0.75,1.5,2]) for(const keepOrder of [true,false]) {
      const spreads=buildSpreadsFromGroups(grouped,appearance,null,{start:'spread',end:'spread',includeFullSpreadTemplates:true,aspect},keepOrder)
      assert.equal(spreads.flatMap(s=>s.placements).filter(p=>p.photoId).length,total)
      assert.equal(new Set(spreads.flatMap(s=>s.placements).map(p=>p.photoId)).size,total)
    }
  }
}
const missingDates=Array.from({length:12},(_,i)=>({...photo(i),capturedAt:'unknown',cameraModel:i<3?'A':i<6?'B':'C'}))
assert.deepEqual(groupPhotosForCount(missingDates,3,options,3,6).map(group=>group.length),[3,3,6],'Missing timestamps must not erase camera boundaries')
const store=useProjectStore.getState()
useProjectStore.setState({project:{...store.project,photos:mixed,enabledTemplateIds:['full-bleed']},history:[],isDirty:false})
const before=useProjectStore.getState().project
assert.throws(()=>useProjectStore.getState().runAutoBuildFromGroups([[mixed[0].id,'missing-photo']]),/no longer available/,'A stale group cannot silently discard an image and build a different layout')
assert.equal(useProjectStore.getState().project,before)
assert.equal(useProjectStore.getState().history.length,0)
assert.equal(useProjectStore.getState().isDirty,false)
assert.throws(()=>useProjectStore.getState().runAutoBuildFromGroups([mixed.map((p)=>p.id)]),/No enabled template/)
assert.equal(useProjectStore.getState().project,before)
assert.equal(useProjectStore.getState().history.length,0)
assert.equal(useProjectStore.getState().isDirty,false,'A rejected build must leave the album unchanged')
console.log('Auto Build checks passed: aspect-aware strict filters, crop ranking, optimal assignment, timeline order, single-page ends, invalid-library safety and bounded smart grouping.')

if(process.argv[2]) {
 const native=JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,'' )).project
 const filtered=native.spreads.slice(6)
 assert.equal(filtered.length,3)
 assert.ok(filtered.every((spread)=>matchesFrameFilter(findTemplate(spread.templateId),'only-3x2',native.size.widthIn/native.size.heightIn)))
 console.log('Native filtered output verified: all appended templates match physical 3:2 frame ratios.')
}
