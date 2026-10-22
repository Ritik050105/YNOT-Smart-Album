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
  writeFileAtomic(target, Buffer.from(JSON.stringify(snapshot)))
}

export function readRecovery(target: string) {
  if (!fs.existsSync(target)) return null
  const snapshot: unknown = JSON.parse(fs.readFileSync(target, 'utf8'))
  validate(snapshot)
  return snapshot
}

export function clearRecovery(target: string) {
  fs.rmSync(target, { force: true })
}
