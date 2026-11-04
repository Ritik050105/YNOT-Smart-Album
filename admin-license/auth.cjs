const fs=require('fs'),path=require('path'),crypto=require('crypto');
class AdminAuth {
 constructor(file){this.file=file;this.lock();this.failures=0;this.retryAt=0;}
 status(){return {configured:fs.existsSync(this.file),authenticated:!!this.key};}
 lock(){this.key?.fill(0);this.key=null;this.secret=null;this.account=null;}
 setup(username,password){
  if(this.status().configured)throw new Error('An owner account already exists.');
  if(typeof username!=='string'||!username.trim()||username.length>80||typeof password!=='string'||password.length<12||password.length>256)throw new Error('Enter a username and a password of 12–256 characters.');
  const salt=crypto.randomBytes(16).toString('hex');this.key=crypto.scryptSync(password,salt,32);this.account={username:username.trim(),salt};this.secret={signingKey:null};
  fs.mkdirSync(path.dirname(this.file),{recursive:true});
  try{fs.writeFileSync(this.file,this.encode(),{flag:'wx',mode:0o600});}catch(e){this.lock();throw e;}
 }
 login(username,password){
  if(Date.now()<this.retryAt)throw new Error('Too many attempts. Wait one minute before trying again.');
  this.lock();
  try{
   if(typeof username!=='string'||typeof password!=='string'||password.length>256||fs.statSync(this.file).size>32768)throw Error();
   const a=JSON.parse(fs.readFileSync(this.file,'utf8'));if(a.version!==1||typeof a.username!=='string'||!/^[a-f0-9]{32}$/.test(a.salt)||!/^[a-f0-9]{24}$/.test(a.iv)||!/^[a-f0-9]{32}$/.test(a.tag))throw Error();
   const key=crypto.scryptSync(password,a.salt,32),d=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(a.iv,'hex'));d.setAAD(Buffer.from(a.username));d.setAuthTag(Buffer.from(a.tag,'hex'));
   const secret=JSON.parse(Buffer.concat([d.update(Buffer.from(a.data,'base64')),d.final()]).toString());
   if(username.trim()!==a.username||!(secret.signingKey===null||typeof secret.signingKey==='string')){key.fill(0);throw Error();}
   this.key=key;this.account={username:a.username,salt:a.salt};this.secret=secret;this.failures=0;
  }catch{this.failures++;if(this.failures>=5){this.retryAt=Date.now()+60000;this.failures=0;}throw new Error('Incorrect credentials or damaged owner vault.');}
 }
 encode(){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',this.key,iv);c.setAAD(Buffer.from(this.account.username));const data=Buffer.concat([c.update(JSON.stringify(this.secret)),c.final()]);return JSON.stringify({version:1,...this.account,iv:iv.toString('hex'),tag:c.getAuthTag().toString('hex'),data:data.toString('base64')});}
 storeKey(key){if(!this.key)throw Error('Sign in first.');const old=this.secret.signingKey;this.secret.signingKey=key;const tmp=this.file+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(tmp,this.encode(),{flag:'wx',mode:0o600});fs.renameSync(tmp,this.file);}catch(e){this.secret.signingKey=old;throw e;}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}}
 getKey(){if(!this.key||!this.secret?.signingKey)throw Error('Sign in and choose the studio signing key first.');return this.secret.signingKey;}
}
module.exports={AdminAuth};
