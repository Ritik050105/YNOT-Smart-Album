import assert from 'node:assert/strict'
import { build } from 'esbuild'
const result=await build({entryPoints:['electron/windowSizing.ts'],bundle:true,platform:'node',format:'esm',write:false})
const {fitWindowSize}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
for(const scale of [1,1.25,1.5,1.75,2,2.5,3]) {
  const workArea={width:Math.floor(3840/scale),height:Math.floor(2160/scale)-48}
  for(const [preferred,minimum] of [[{width:1440,height:900},{width:720,height:480}],[{width:640,height:760},{width:560,height:480}]]) {
    const size=fitWindowSize(workArea,preferred,minimum)
    assert.ok(size.width<=workArea.width&&size.height<=workArea.height)
    assert.ok(size.minWidth<=size.width&&size.minHeight<=size.height)
    assert.ok(size.minWidth*scale<=3840&&size.minHeight*scale<=2160)
  }
}
assert.deepEqual(fitWindowSize({width:720,height:480},{width:1440,height:900},{width:720,height:480}),{width:720,height:480,minWidth:720,minHeight:480})
assert.deepEqual(fitWindowSize({width:640,height:400},{width:1440,height:900},{width:720,height:480}),{width:640,height:400,minWidth:640,minHeight:400})
console.log('Window sizing checks passed: 720x480, smaller work areas, and 4K work-area calculations at 100-300% scaling. Physical 4K rendering is not tested.')
