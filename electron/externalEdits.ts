import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
const exec = promisify(execFile)
const isPhotoshop = async (file: string) => path.isAbsolute(file) && path.basename(file).toLowerCase() === 'photoshop.exe' && !!(await fs.promises.stat(file).catch(() => null))?.isFile()
export async function findPhotoshop(configured: string, roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter((s): s is string => !!s)) {
  if(process.platform==='darwin')return findMacEditor('Photoshop',configured)
  if (configured && await isPhotoshop(configured)) return configured
  for (const hive of ['HKCU', 'HKLM']) {
    try {
      const {stdout} = await exec('reg.exe', ['query', `${hive}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Photoshop.exe`, '/ve'], {windowsHide:true})
      const file = stdout.match(/REG_SZ\s+(.+)/)?.[1].trim().replace(/^"|"$/g, '')
      if (file && await isPhotoshop(file)) return file
    } catch { /* A missing registry entry is normal for some Adobe installs. */ }
  }
  for (const root of roots) {
    const adobe = path.join(root, 'Adobe')
    const folders = await fs.promises.readdir(adobe).catch(() => [])
    for (const folder of folders.filter(n => /^Adobe Photoshop/i.test(n)).sort().reverse()) {
      const file = path.join(adobe, folder, 'Photoshop.exe')
      if (await isPhotoshop(file)) return file
    }
  }
  throw new Error('Photoshop was not found. Install Adobe Photoshop or choose Photoshop.exe in Tools → Preferences → Misc.')
}

export async function findCanva(configured = '', roots = [process.env.LOCALAPPDATA, process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter((s): s is string => !!s)) {
  if(process.platform==='darwin')return findMacEditor('Canva',configured)
  const valid = async (file:string) => path.isAbsolute(file) && path.basename(file).toLowerCase()==='canva.exe' && !!(await fs.promises.stat(file).catch(()=>null))?.isFile()
  if(configured && await valid(configured))return configured
  for(const hive of ['HKCU','HKLM'])try {
    const {stdout}=await exec('reg.exe',['query',`${hive}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Canva.exe`,'/ve'],{windowsHide:true})
    const file=stdout.match(/REG_SZ\s+(.+)/)?.[1].trim().replace(/^"|"$/g,'')
    if(file && await valid(file))return file
  }catch{/* Canva does not always register App Paths. */}
  for(const root of roots)for(const relative of ['Canva/Canva.exe','Programs/Canva/Canva.exe']){const file=path.join(root,relative);if(await valid(file))return file}
  throw new Error('Canva Desktop was not found. Install Canva for Windows, or choose Canva.exe in Tools → Preferences → Misc. YNOT will not open a browser.')
}

export class ExternalEditFiles {
  private files = new Map<string, {owner:number; revision:string}>()
  async register(file: string, owner: number) {
    const stat = await fs.promises.stat(file)
    this.files.set(file, {owner, revision:`${stat.mtimeMs}:${stat.size}`})
  }
  forget(owner:number) { for (const [file,entry] of this.files) if(entry.owner===owner)this.files.delete(file) }
  async read(file: string, owner:number, revision?:string) {
    const entry = this.files.get(file)
    if (!entry || entry.owner !== owner) throw new Error('This file was not opened for editing by this window.')
    const before = await fs.promises.stat(file).catch(() => null)
    if (!before) return null
    const next = `${before.mtimeMs}:${before.size}`
    if (next === (revision ?? entry.revision) || Date.now() - before.mtimeMs < 750) return null
    if (before.size > 512 * 1024 * 1024) throw new Error('The edited file exceeds the 512 MB sync limit.')
    const data = await fs.promises.readFile(file)
    const after = await fs.promises.stat(file)
    if (after.mtimeMs !== before.mtimeMs || after.size !== before.size) return null
    return {data:new Uint8Array(data),revision:next}
  }
}

export async function findMacEditor(editor:'Photoshop'|'Canva',configured='',roots=['/Applications',path.join(os.homedir(),'Applications')]) {
  const valid=async(file:string)=>path.isAbsolute(file)&&(editor==='Canva'?/^Canva\.app$/i:/^Adobe Photoshop.*\.app$/i).test(path.basename(file))&&!!(await fs.promises.stat(path.join(file,'Contents','Info.plist')).catch(()=>null))?.isFile()
  if(configured&&await valid(configured))return configured
  for(const root of roots){
    for(const name of (await fs.promises.readdir(root).catch(()=>[])).sort().reverse()){
      const file=path.join(root,name)
      if(await valid(file))return file
      if(editor==='Photoshop'&&/^Adobe Photoshop/i.test(name)&&!name.endsWith('.app'))for(const child of await fs.promises.readdir(file).catch(()=>[])){const candidate=path.join(file,child);if(await valid(candidate))return candidate}
    }
  }
  throw new Error(`Install ${editor} for macOS or choose its .app in Tools → Preferences → Misc.`)
}
