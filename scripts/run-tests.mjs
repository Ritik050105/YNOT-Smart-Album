#!/usr/bin/env node
// Runs the whole test suite, each file under the runtime it actually needs.
//
// This exists because of a number that was wrong for a long time. The .cjs tests were all being
// launched under Electron, and Electron does not exit on its own: a test that never opens a
// window has no window-all-closed to quit on, so one that passed every assertion and printed its
// success line would then sit there until the runner's timeout killed it and recorded a failure.
// Seventeen of the fifty-five were in that state. Run under plain node they pass in about a
// second each.
//
// So: a .cjs file is given Electron only if it asks for it — app.whenReady or a BrowserWindow.
// Everything else gets node, which exits when its work is done.
//
//   node scripts/run-tests.mjs                 every test
//   node scripts/run-tests.mjs smart-guides    only those whose name contains this
//   node scripts/run-tests.mjs --electron      only the ones that drive a window
//   node scripts/run-tests.mjs --node          only the ones that do not

import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'

const ELECTRON = path.join('node_modules', 'electron', 'dist', 'electron.exe')
const WINDOW_TEST = /whenReady|new BrowserWindow/
// Some tests start under node, make a temp directory, and relaunch themselves under Electron with
// arguments. Handing one of those straight to Electron skips the half that sets it up, and it dies
// on an argument that was never passed. They say so by checking process.versions.electron.
const SELF_LAUNCHING = /process\.versions\.electron/

// A window test builds a bundle with esbuild and drives a real browser window, so it is slow and
// deserves room; a plain one that takes this long has hung.
const TIMEOUT = { electron: 240_000, node: 120_000 }

// The theme sweep checks the hover state of every button on about thirty-five screens in two
// themes, waiting out each transition, so it runs for many minutes by design. It was being killed
// at 240 seconds around screen eleven and recorded as hanging.
const SLOW = new Map([['test-theme', 1_500_000]])

/** Not suite tests: these take a packaged app's path and architecture as arguments and check a
 *  build, so there is nothing for them to do on their own. Run by hand after packaging:
 *    node scripts/test-packaged-sharp.cjs release-<sha>/win-unpacked/resources/app x64 */
const NEEDS_A_BUILD = new Set(['test-packaged-sharp'])

const args = process.argv.slice(2)
const only = args.filter((a) => !a.startsWith('--'))
const wantElectron = args.includes('--electron')
const wantNode = args.includes('--node')

const tests = readdirSync('scripts')
  .filter((f) => /^test-.*\.(mjs|cjs)$/.test(f))
  .sort()
  .map((file) => {
    const full = path.join('scripts', file)
    const runtime = file.endsWith('.mjs') ? 'node'
      : (() => { const text = readFileSync(full, 'utf8')
          return SELF_LAUNCHING.test(text) ? 'node' : WINDOW_TEST.test(text) ? 'electron' : 'node' })()
    return { name: file.replace(/\.(mjs|cjs)$/, ''), file: full, runtime }
  })
  .filter((t) => !NEEDS_A_BUILD.has(t.name))
  .filter((t) => !only.length || only.some((pattern) => t.name.includes(pattern)))
  .filter((t) => (wantElectron ? t.runtime === 'electron' : true))
  .filter((t) => (wantNode ? t.runtime === 'node' : true))

if (tests.some((t) => t.runtime === 'electron') && !existsSync(ELECTRON)) {
  console.error(`No Electron at ${ELECTRON} — run npm install, or pass --node.`)
  process.exit(1)
}

/** The first line worth printing from a failed test's output. */
function reason(output, code) {
  if (code === null) return 'timed out'
  const line = output.split(/\r?\n/).find((l) =>
    /ERR_ASSERTION\]:|Uncaught \w*Error|^Error:|^AssertionError/.test(l) && !/^\[\d+:/.test(l))
  return (line ?? `exit ${code}`).replace(/.*ERR_ASSERTION\]:\s*/, '').trim().slice(0, 90)
}

const run = (test) => new Promise((resolve) => {
  const command = test.runtime === 'electron' ? ELECTRON : process.execPath
  const child = spawn(command, [test.file], { stdio: ['ignore', 'pipe', 'pipe'] })
  let output = '', done = false
  const timer = setTimeout(() => { done = true; child.kill('SIGKILL') }, SLOW.get(test.name) ?? TIMEOUT[test.runtime])
  child.stdout.on('data', (d) => { output += d })
  child.stderr.on('data', (d) => { output += d })
  const started = Date.now()
  child.on('close', (code) => {
    clearTimeout(timer)
    resolve({ ...test, code: done ? null : code, seconds: (Date.now() - started) / 1000, output })
  })
})

const failures = []
for (const [index, test] of tests.entries()) {
  const result = await run(test)
  const ok = result.code === 0
  if (!ok) {
    failures.push(result)
    // Keep the whole output. The one line printed below is rarely the whole story, and
    // re-running a window test to read it again costs minutes.
    mkdirSync('test-failures', { recursive: true })
    writeFileSync(`test-failures/${test.name}.log`, result.output)
  }
  const label = `${String(index + 1).padStart(2)}/${tests.length}`
  const mark = ok ? 'pass' : 'FAIL'
  console.log(`${label} ${mark} ${test.name.padEnd(34)} ${result.seconds.toFixed(1).padStart(6)}s  ${test.runtime}`
    + (ok ? '' : `\n          ${reason(result.output, result.code)}`))
}

console.log(`\n${tests.length - failures.length}/${tests.length} passed`
  + (failures.length ? `\nstill failing: ${failures.map((f) => f.name).join(', ')}` : ''))
process.exit(failures.length ? 1 : 0)
