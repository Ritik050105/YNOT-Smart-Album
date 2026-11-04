import { app, clipboard, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { deviceId, validateActiveLicense, validateRevocation } from './license'
import { licensePublicKey } from './licensePublicKey'
import { writeFileAtomic } from './files'

export async function requireActivation(): Promise<boolean> {
  let device: string
  try { device = deviceId() } catch (error) {
    dialog.showErrorBox('Unable to activate this PC', String(error))
    return false
  }
  const destination = path.join(app.getPath('userData'), 'client-license.json')
  const readLicense = (file: string) => {
    if (fs.statSync(file).size > 16384) throw new Error('License file is too large.')
    const raw = fs.readFileSync(file, 'utf8')
    const revocationFile=path.join(app.getPath('userData'),'client-revocation.json')
    if(fs.existsSync(revocationFile)&&fs.statSync(revocationFile).size>16384)throw new Error('Invalid local revocation file.')
    validateActiveLicense(raw, device, licensePublicKey,fs.existsSync(revocationFile)?fs.readFileSync(revocationFile,'utf8'):undefined)
    return raw
  }
  try { readLicense(destination); return true } catch { /* A missing or invalid license requires activation. */ }
  for (;;) {
    const { response } = await dialog.showMessageBox({ type: 'info', title: 'Activate YNOT ALBUM STUDIO', message: 'Activate this client PC', detail: `Send this PC ID to your license administrator, then import the signed license they provide. No internet connection is required.\n\nPC ID: ${device}`, buttons: ['Import license', 'Copy PC ID', 'Exit'], defaultId: 0, cancelId: 2, noLink: true })
    if (response === 2) return false
    if (response === 1) { clipboard.writeText(device); continue }
    const result = await dialog.showOpenDialog({ title: 'Import signed PC license', properties: ['openFile'], filters: [{ name: 'YNOT license', extensions: ['json'] }] })
    if (result.canceled || !result.filePaths[0]) continue
    try {
      const raw = readLicense(result.filePaths[0])
      writeFileAtomic(destination, Buffer.from(raw))
      return true
    } catch (error) { dialog.showErrorBox('License not accepted', String(error)) }
  }
}

export async function importRevocation():Promise<void> {
  try {
    const choice=await dialog.showOpenDialog({title:'Import signed license revocation',properties:['openFile'],filters:[{name:'YNOT signed revocation',extensions:['json']}]})
    const file=choice.filePaths[0];if(choice.canceled||!file)return
    if(fs.statSync(file).size>16384)throw new Error('Revocation file is too large.')
    const raw=fs.readFileSync(file,'utf8'),device=deviceId(),cutoff=validateRevocation(raw,device,licensePublicKey)
    const destination=path.join(app.getPath('userData'),'client-revocation.json')
    if(fs.existsSync(destination)){
      if(fs.statSync(destination).size>16384)throw new Error('Invalid local revocation file.')
      if(validateRevocation(fs.readFileSync(destination,'utf8'),device,licensePublicKey)>cutoff)throw new Error('A newer revocation is already installed.')
    }
    const confirm=await dialog.showMessageBox({type:'warning',message:'Revoke this PC license?',detail:'This blocks licenses issued on or before '+new Date(cutoff).toLocaleString()+'. Projects are preserved. Save your work and close the app after importing; the block is enforced on the next launch.',buttons:['Cancel','Import revocation'],defaultId:0,cancelId:0})
    if(confirm.response!==1)return
    writeFileAtomic(destination,Buffer.from(raw))
    await dialog.showMessageBox({type:'info',message:'Revocation imported',detail:'Save your work and close YNOT ALBUM STUDIO. This license will be refused on the next launch.'})
  }catch(e){dialog.showErrorBox('Revocation not imported',String(e))}
}
