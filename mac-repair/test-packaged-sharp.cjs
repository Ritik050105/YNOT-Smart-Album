const assert = require('assert/strict'),path=require('path');
(async()=>{
 const root=path.resolve(process.argv[2]);
 assert.equal(process.arch,process.argv[3],'Packaged Electron architecture mismatch');
 const sharp=require(path.join(root,'node_modules/sharp'));
 const png=await sharp({create:{width:3,height:2,channels:4,background:'#3355cc'}}).png().toBuffer();
 const image=await sharp(png).metadata();
 assert.equal(image.width,3);assert.equal(image.height,2);assert.equal(image.format,'png');
 console.log('PASS: packaged Sharp loads, encodes and decodes images on '+process.arch);
})().catch(e=>{console.error(e);process.exit(1)});
