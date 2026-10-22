import fs from 'fs'
import { randomUUID } from 'crypto'

export function writeFileAtomic(target: string, bytes: Uint8Array) {
  const temporary = `${target}.${randomUUID()}.tmp`
  try {
    fs.writeFileSync(temporary, bytes)
    fs.renameSync(temporary, target)
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
  }
}
