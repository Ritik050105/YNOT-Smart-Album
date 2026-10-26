const assert=require('assert/strict'),cp=require('child_process'),fs=require('fs');
if(process.platform!=='win32'){console.log('Windows-only fallback test skipped.');process.exit(0)}
const {deviceId}=require(process.argv[2] || '../dist-electron/license');
const original=cp.execFileSync;
const baseline=deviceId();
let scriptPath,calls=0;
try {
 cp.execFileSync=(file,args,options)=>{
  if(file.endsWith('powershell.exe'))throw new Error('Simulated PowerShell crash 0xc0000409');
  calls++;scriptPath=args[2];return original(file,args,options);
 };
 assert.equal(deviceId(),baseline,'Real Windows Script Host fallback must match original PC ID');
 assert.equal(calls,1);assert.equal(fs.existsSync(scriptPath),false);
 for(const value of ['','invalid|invalid','00000000-0000-0000-0000-000000000000|12345678-1234-1234-1234-123456789abc']){
  cp.execFileSync=(file,args)=>{if(file.endsWith('powershell.exe'))throw Error('Crash');scriptPath=args[2];return value};
  assert.throws(()=>deviceId(),/could not read this PC identity/);assert.equal(fs.existsSync(scriptPath),false);
 }
 cp.execFileSync=()=>{throw Error('Unavailable')};
 assert.throws(()=>deviceId(),/Windows Management Instrumentation/);
} finally {cp.execFileSync=original}
console.log('PASS: forced PowerShell failure uses real WSH with unchanged ID; invalid identities fail closed; temporary files cleaned.');
