const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script=fs.readFileSync('scripts/build-license-admin.cjs','utf8');
for(const [platform,arch,expected] of [['win32','x64',['--win']],['darwin','arm64',['--mac','--arm64']],['darwin','x64',['--mac','--x64']]]){
 let args;const req=id=>id==='fs'?{writeFileSync(){},copyFileSync(){}}:id==='path'?require('path'):id==='child_process'?{spawnSync:(_,a)=>{args=a;return {status:0}}}:{licensePublicKey:'public-test-key'};req.resolve=()=>'/builder/cli.js';
 vm.runInNewContext(script,{require:req,process:{platform,arch,execPath:'/node',argv:['node','build'],exit:code=>assert.equal(code,0)}});
 assert.deepEqual(Array.from(args.slice(3,3+expected.length)),expected);
}
const pkg=require('../admin-license/package.json');assert.deepEqual(pkg.build.mac.target[0].arch,['arm64','x64']);assert.ok(!pkg.build.files.some(f=>f.includes('private')));
console.log('PASS: Windows, Intel Mac and Apple Silicon admin build targets; private signing key excluded.');
