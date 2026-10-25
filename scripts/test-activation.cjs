const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),Module=require('module');
const {generateKeyPairSync,sign}=require('crypto');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'ynot-activation-'));
const keys=generateKeyPairSync('ed25519'),device='a'.repeat(64);
const license=d=>{const bytes=Buffer.from(JSON.stringify({version:1,product:'com.ynotphotography.albumstudio',deviceId:d,client:'QA'}));return JSON.stringify({payload:bytes.toString('base64'),signature:sign(null,bytes,keys.privateKey).toString('base64')})};
const good=path.join(root,'good.json'),wrong=path.join(root,'wrong.json');fs.writeFileSync(good,license(device));fs.writeFileSync(wrong,license('b'.repeat(64)));
let actions=[],files=[],errors=[],copied='';
const original=Module._load;
Module._load=function(id,parent,...rest){
 if(id==='electron')return {app:{getPath:()=>root},clipboard:{writeText:s=>copied=s},dialog:{showErrorBox:(...s)=>errors.push(s),showMessageBox:async()=>{assert(actions.length);return {response:actions.shift()}},showOpenDialog:async()=>{const f=files.shift();return {canceled:!f,filePaths:f?[f]:[]}}}};
 if(parent?.filename.endsWith('activation.js')&&id==='./license')return {...original.call(this,id,parent,...rest),deviceId:()=>device};
 if(parent?.filename.endsWith('activation.js')&&id==='./licensePublicKey')return {licensePublicKey:keys.publicKey.export({type:'spki',format:'pem'})};
 return original.call(this,id,parent,...rest);
};
const {requireActivation}=require('../dist-electron/activation');
(async()=>{
 actions=[2];assert.equal(await requireActivation(),false);
 actions=[1,0,0,0];files=[null,wrong,good];assert.equal(await requireActivation(),true);assert.equal(copied,device);assert.equal(errors.length,1);
 assert.equal(fs.readFileSync(path.join(root,'client-license.json'),'utf8'),license(device));
 actions=[];assert.equal(await requireActivation(),true,'Saved license works on next launch');
 fs.writeFileSync(path.join(root,'client-license.json'),license('b'.repeat(64)));actions=[2];assert.equal(await requireActivation(),false,'Copied license blocked');
 console.log('Activation flow passed: exit, copy ID, canceled picker, wrong PC, import, persistence and copied-license rejection.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{Module._load=original;fs.rmSync(root,{recursive:true,force:true})});
