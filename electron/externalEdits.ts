import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
const exec = promisify(execFile)
const isPhotoshop = async (file: string) => path.isAbsolute(file) && path.basename(file).toLowerCase() === 'photoshop.exe' && !!(await fs.promises.stat(file).catch(() => null))?.isFile()
export async function findPhotoshop(configured: string, roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter((s): s is string => !!s)) {
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
