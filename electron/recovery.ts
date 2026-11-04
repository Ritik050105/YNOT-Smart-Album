import fs from 'fs'
import { writeFileAtomic } from './files'

function validate(snapshot: unknown): asserts snapshot is { filePath: string | null; contents: string } {
  const value = snapshot as { filePath?: unknown; contents?: unknown } | null
  if (!value || (value.filePath !== null && typeof value.filePath !== 'string') || typeof value.contents !== 'string') {
    throw new Error('Invalid recovery snapshot.')
  }
  const file = JSON.parse(value.contents)
  if (file?.formatVersion !== 1 || !file.project || !Array.isArray(file.project.photos) || !Array.isArray(file.project.spreads) || !Array.isArray(file.userTemplates)) {
    throw new Error('Invalid recovery project.')
  }
}

export function writeRecovery(target: string, snapshot: unknown) {
  validate(snapshot)
  // Keep the previous valid checkpoint if a disk failure damages the newest one.
  if (fs.existsSync(target)) {
    let previous: unknown
    try { previous = JSON.parse(fs.readFileSync(target, 'utf8')); validate(previous) }
    catch { previous = undefined }
    if (previous) writeFileAtomic(`${target}.bak`, Buffer.from(JSON.stringify(previous)))
  }
  writeFileAtomic(target, Buffer.from(JSON.stringify(snapshot)))
}

export function readRecovery(target: string) {
  let failure: unknown
  for (const candidate of [target, `${target}.bak`]) {
    if (!fs.existsSync(candidate)) continue
    try {
      const snapshot: unknown = JSON.parse(fs.readFileSync(candidate, 'utf8'))
      validate(snapshot)
      return snapshot
    } catch (error) { failure = error }
  }
  if (failure) throw failure
  return null
}

export function clearRecovery(target: string) {
  fs.rmSync(`${target}.bak`, { force: true })
  fs.rmSync(target, { force: true })
}
