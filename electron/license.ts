import { createHash, verify } from 'crypto'
import { execFileSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import os from 'os'

export function deviceId(): string {
  if (process.platform === 'darwin') return macDeviceId(execFileSync('/usr/sbin/ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], {encoding:'utf8',timeout:15000}))
  if (process.platform !== 'win32') throw new Error('Client activation supports Windows and macOS.')
  const script = String.raw`$ErrorActionPreference='Stop'; $u=(Get-CimInstance Win32_ComputerSystemProduct).UUID; $g=(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Cryptography').MachineGuid; Write-Output ($u+'|'+$g)`
  const system32 = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32')
  try {
    return windowsDeviceId(execFileSync(path.join(system32, 'WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: 15000 }))
  } catch { /* Preserve the same identity when PowerShell is unavailable or crashes. */ }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ynot-device-'))
  try {
    const file = path.join(directory, 'identity.js')
    fs.writeFileSync(file, String.raw`var rows = new Enumerator(GetObject("winmgmts:\\\\.\\root\\cimv2").ExecQuery("SELECT UUID FROM Win32_ComputerSystemProduct"));
if (rows.atEnd()) throw new Error("No computer UUID");
var guid = new ActiveXObject("WScript.Shell").RegRead("HKLM\\SOFTWARE\\Microsoft\\Cryptography\\MachineGuid");
WScript.Echo(rows.item().UUID + "|" + guid);`)
    return windowsDeviceId(execFileSync(path.join(system32, 'cscript.exe'), ['//Nologo', '//E:JScript', file], { encoding: 'utf8', windowsHide: true, timeout: 15000 }))
  } catch {
    throw new Error('Windows could not read this PC identity through PowerShell or Windows Script Host. Ask your IT administrator to check Windows Management Instrumentation and script-host access. No license or project was changed.')
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

function windowsDeviceId(output: string): string {
  const raw = output.trim().toLowerCase()
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

export function macDeviceId(output:string):string {
  const uuid=output.match(/"IOPlatformUUID"\s*=\s*"([a-f0-9-]+)"/i)?.[1].toLowerCase()
  if(!uuid||! /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(uuid)||/^[0f-]+$/.test(uuid))throw new Error('macOS could not identify this Mac. Contact your administrator.')
  return createHash('sha256').update('ynot-album-studio:device:mac:v1:'+uuid).digest('hex')
}

export function validateRevocation(raw:string,device:string,publicKey:string):number {
  if(typeof raw!=='string'||Buffer.byteLength(raw)>16384)throw new Error('Invalid revocation size.')
  const envelope=JSON.parse(raw)
  if(!envelope||typeof envelope.payload!=='string'||typeof envelope.signature!=='string')throw new Error('Invalid revocation file.')
  const bytes=Buffer.from(envelope.payload,'base64')
  if(!verify(null,bytes,publicKey,Buffer.from(envelope.signature,'base64')))throw new Error('Revocation signature is invalid.')
  const data=JSON.parse(bytes.toString('utf8'))
  if(data.version!==1||data.product!=='com.ynotphotography.albumstudio'||data.action!=='revoke'||data.deviceId!==device||typeof data.revokedThrough!=='string'||!Number.isFinite(Date.parse(data.revokedThrough)))throw new Error('This revocation does not belong to this PC.')
  return Date.parse(data.revokedThrough)
}
export function validateActiveLicense(raw:string,device:string,publicKey:string,revocation?:string):void {
  validateLicense(raw,device,publicKey)
  if(revocation){const cutoff=validateRevocation(revocation,device,publicKey);const data=JSON.parse(Buffer.from(JSON.parse(raw).payload,'base64').toString('utf8'));if(typeof data.issuedAt!=='string'||!Number.isFinite(Date.parse(data.issuedAt))||Date.parse(data.issuedAt)<=cutoff)throw new Error('This license was revoked by the studio owner. Contact your administrator.')}
}
