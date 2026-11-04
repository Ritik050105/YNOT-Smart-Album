import fs from 'fs'
import { randomUUID } from 'crypto'

export function writeFileAtomic(target: string, bytes: Uint8Array) {
  const temporary = `${target}.${randomUUID()}.tmp`
  try {
    const fd=fs.openSync(temporary,'w');try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
    fs.renameSync(temporary, target)
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
  }
}
