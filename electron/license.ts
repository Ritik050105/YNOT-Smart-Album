import { createHash, verify } from 'crypto'
import { execFileSync } from 'child_process'
import path from 'path'

export function deviceId(): string {
  if (process.platform !== 'win32') throw new Error('This client license requires Windows.')
  const script = String.raw`$ErrorActionPreference='Stop'; $u=(Get-CimInstance Win32_ComputerSystemProduct).UUID; $g=(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Cryptography').MachineGuid; Write-Output ($u+'|'+$g)`
  const raw = execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 15000 }).trim().toLowerCase()
  const ids = raw.split('|')
  if (ids.length !== 2 || ids.some(id => !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id) || /^[0f-]+$/.test(id))) throw new Error('Windows could not identify this PC. Contact your administrator.')
  return createHash('sha256').update('ynot-album-studio:device:v1:' + raw).digest('hex')
}

export function validateLicense(raw: string, device: string, publicKey: string): void {
  if (Buffer.byteLength(raw) > 16384) throw new Error('License file is too large.')
  const envelope = JSON.parse(raw)
  if (!envelope || typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string') throw new Error('Invalid license file.')
  const bytes = Buffer.from(envelope.payload, 'base64')
  if (!verify(null, bytes, publicKey, Buffer.from(envelope.signature, 'base64'))) throw new Error('License signature is invalid.')
  const license = JSON.parse(bytes.toString('utf8'))
  if (license.version !== 1 || license.product !== 'com.ynotphotography.albumstudio' || license.deviceId !== device || typeof license.client !== 'string' || !license.client.trim()) throw new Error('This license does not belong to this PC or application.')
}
