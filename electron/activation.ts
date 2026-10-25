import { app, clipboard, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { deviceId, validateLicense } from './license'
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
    validateLicense(raw, device, licensePublicKey)
    return raw
  }
  try { readLicense(destination); return true } catch { /* A missing or invalid license requires activation. */ }
  for (;;) {
    const { response } = await dialog.showMessageBox({ type: 'info', title: 'Activate YNOT Album Studio', message: 'Activate this client PC', detail: `Send this PC ID to your license administrator, then import the signed license they provide. No internet connection is required.\n\nPC ID: ${device}`, buttons: ['Import license', 'Copy PC ID', 'Exit'], defaultId: 0, cancelId: 2, noLink: true })
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
