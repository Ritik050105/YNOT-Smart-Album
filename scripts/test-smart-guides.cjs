const assert=require('node:assert/strict')
const {transformSync}=require('esbuild')
const fs=require('node:fs')
const mod={exports:{}}
new Function('module','exports',transformSync(fs.readFileSync('src/engine/smartGuides.ts','utf8'),{loader:'ts',format:'cjs'}).code)(mod,mod.exports)
const {snapRect}=mod.exports
const targets=[{x:100,y:200,width:200,height:100}]
let r=snapRect({x:104,y:204,width:70,height:60},targets,900,600,6)
assert.equal(r.rect.x,100);assert.equal(r.rect.y,200);assert.equal(r.guides.length,2)
r=snapRect({x:104,y:204,width:70,height:60},targets,900,600,2)
assert.equal(r.rect.x,104);assert.equal(r.guides.length,0)
r=snapRect({x:50,y:50,width:247,height:247},targets,900,600,6,'bottom-right')
assert.equal(r.rect.x,50);assert.equal(r.rect.y,50);assert.equal(r.rect.width,250);assert.equal(r.rect.height,250)
r=snapRect({x:103,y:50,width:197,height:80},targets,900,600,6,'middle-left')
assert.equal(r.rect.x,100);assert.equal(r.rect.x+r.rect.width,300)
r=snapRect({x:399,y:30,width:100,height:40},[],900,600,6)
assert.equal(r.rect.x,400);assert.ok(r.guides.some(g=>g.position===450))
r=snapRect({x:72,y:72,width:10,height:10},[],900,600,6,undefined,[75],[75])
assert.equal(r.guides.length,2)
console.log('Smart guides passed: edges, centers, zoom threshold, resize anchors, manual guides')

for(const axis of ['x','y']){
 const rct=(x,w)=>axis==='x'?{x,y:100,width:w,height:40}:{x:100,y:x,width:40,height:w};
 let result=snapRect(rct(322,40),[rct(100,40),rct(200,60)],900,900,6);
 assert.equal(result.rect[axis],320,'Match existing neighboring gap');assert.equal(result.guides.filter(g=>g.segments).length,1);assert.deepEqual(result.guides.find(g=>g.segments).segments,[{from:140,to:200},{from:260,to:320}]);
 result=snapRect(rct(201,60),[rct(100,40),rct(320,40)],900,900,6);assert.equal(result.rect[axis],200,'Center between neighbors');
 result=snapRect(rct(200,58),[rct(100,40),rct(320,40)],900,900,6,axis==='x'?'middle-right':'bottom-center');assert.equal(result.rect[axis==='x'?'width':'height'],60,'Resize to equal spacing');assert.ok(result.guides.some(g=>g.segments));
 result=snapRect(rct(330,40),[rct(100,40),rct(200,60)],900,900,2);assert.equal(result.rect[axis],330);assert.ok(!result.guides.some(g=>g.segments),'No false equal-gap markers');
}
assert.ok(!snapRect({x:322,y:300,width:40,height:40},[{x:100,y:100,width:40,height:40},{x:200,y:100,width:60,height:40}],900,900,6).guides.some(g=>g.segments),'Different rows do not attract');
console.log('Equal spacing passed: both axes, middle and end positions, resizing, zoom threshold and row isolation');

const {nearbySpacingGaps}=mod.exports;
assert.deepEqual(nearbySpacingGaps({x:300,y:100,width:40,height:40},[{x:100,y:100,width:30,height:40},{x:200,y:100,width:40,height:40},{x:250,y:300,width:20,height:20}],'x').map(c=>c.gap),[70]);
assert.deepEqual(nearbySpacingGaps({x:100,y:300,width:40,height:40},[{x:100,y:100,width:40,height:30},{x:100,y:190,width:40,height:40}],'y').map(c=>c.gap),[60]);
console.log('Nearby gap references passed: both axes and unrelated-row exclusion');
