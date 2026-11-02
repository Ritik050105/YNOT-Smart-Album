import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export type DiscoveredFont={family:string;path:string}
export class FontDiscovery {
  private controller:AbortController|null=null
  private known=new Map<string,DiscoveredFont>()
  status={running:false,visited:0,skipped:0,fonts:[] as DiscoveredFont[]}
  constructor(private cacheFile:string){}
  async load(){try{const rows=JSON.parse(await fs.readFile(this.cacheFile,'utf8'));if(Array.isArray(rows))for(const row of rows)if(typeof row.family==='string'&&typeof row.path==='string'&&path.isAbsolute(row.path)&&/\.(ttf|otf|woff2?)$/i.test(row.path))this.known.set(row.path,row)}catch{}this.status.fonts=[...this.known.values()];return this.status}
  async roots(){
    if(process.platform==='win32'){
      const drives=(await Promise.all(Array.from({length:26},(_,i)=>String.fromCharCode(65+i)+':\\').map(async p=>await fs.stat(p).then(s=>s.isDirectory()?p:null).catch(()=>null)))).filter((p):p is string=>!!p)
      // The scan pops from the end, so the installed-font folders go last to be searched first.
      const installed=[process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Microsoft','Windows','Fonts'),process.env.WINDIR&&path.join(process.env.WINDIR,'Fonts')].filter((p):p is string=>!!p)
      return [...drives,...installed]
    }
    const mounted=await fs.readdir('/Volumes').catch(()=>[] as string[])
    return [...new Set([os.homedir(),'/Users','/Library/Fonts','/System/Library/Fonts',...mounted.map(v=>path.join('/Volumes',v))])]
  }
  async start(roots?:string[]){
    if(this.status.running)return
    const controller=new AbortController();this.controller=controller
    this.status={...this.status,running:true,visited:0,skipped:0}
    try{
      const pending=roots??await this.roots(),seen=new Set<string>()
      while(pending.length&&!controller.signal.aborted){
        const dir=pending.pop()!;if(seen.has(dir))continue;seen.add(dir)
        try{
          const before=this.known.size
          const entries=await fs.readdir(dir,{withFileTypes:true});this.status.visited++
          for(const entry of entries){
            if(entry.isSymbolicLink())continue
            const file=path.join(dir,entry.name)
            if(entry.isDirectory()){pending.push(file);continue}
            if(entry.isFile()&&/\.(ttf|otf|woff2?)$/i.test(entry.name)){
              const info=await fs.stat(file);if(info.size>10*1024*1024||!info.size)continue
              this.known.set(file,{family:path.basename(file,path.extname(file)),path:file})
            }
          }
          if(this.known.size!==before)this.status.fonts=[...this.known.values()]
        }catch{this.status.skipped++}
        await new Promise(resolve=>setTimeout(resolve,1))
      }
      await fs.mkdir(path.dirname(this.cacheFile),{recursive:true})
      await fs.writeFile(this.cacheFile,JSON.stringify(this.status.fonts))
    }finally{this.status.running=false;this.controller=null}
  }
  has(file:string){return this.known.has(file)}
  cancel(){this.controller?.abort()}
  async read(file:string){
    if(typeof file!=='string'||!this.known.has(file))throw new Error('Scan for this font first.')
    const info=await fs.stat(file);if(!info.isFile()||info.size>10*1024*1024)throw new Error('Font is unavailable or too large.')
    return 'data:font/'+path.extname(file).slice(1)+';base64,'+(await fs.readFile(file)).toString('base64')
  }
}
