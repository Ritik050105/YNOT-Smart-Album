import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { build } from 'esbuild'

const result = await build({ entryPoints: ['electron/files.ts'], bundle: true, platform: 'node', format: 'esm', write: false })
const { writeFileAtomic } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ynot-save-check-'))
try {
  const target = path.join(directory, 'album.json')
  writeFileAtomic(target, Buffer.from('first'))
  writeFileAtomic(target, Buffer.from('second'))
  assert.equal(fs.readFileSync(target, 'utf8'), 'second')
  assert.throws(() => writeFileAtomic(target, undefined))
  assert.equal(fs.readFileSync(target, 'utf8'), 'second', 'Failed saves must preserve the previous file')
  assert.deepEqual(fs.readdirSync(directory), ['album.json'])
  console.log('File checks passed: create, replace and preserve the original after a failed save.')
} finally {
  fs.rmSync(directory, { recursive: true, force: true })
}
