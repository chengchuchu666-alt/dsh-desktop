/** Same Windows runner, alternating order, real installs/smokes/uninstalls.
 * Only public installers and temporary profiles are used. No releases created. */
import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { median } from './nsis-timing.mjs'

if (process.platform !== 'win32') throw new Error('NSIS benchmark requires Windows')
const [baselineArg, candidateArg, outputArg] = process.argv.slice(2)
if (!baselineArg || !candidateArg || !outputArg) throw new Error('usage: benchmark-nsis.mjs baseline.exe candidate.exe output.json')
const installers = { baseline: resolve(baselineArg), candidate: resolve(candidateArg) }
const checksums = {}
for (const [label, path] of Object.entries(installers)) checksums[label] = createHash('sha256').update(await readFile(path)).digest('hex')
const samples = { baseline: [], candidate: [] }
const exec = promisify(execFile)
for (let round = 0; round < 3; round++) {
  for (const label of round % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate']) {
    console.log(`nsis-benchmark: ${label} round=${round + 1}`)
    const { stdout } = await exec(process.execPath, ['scripts/smoke-installed.mjs', 'nsis', installers[label]], { timeout: 660_000, maxBuffer: 8 * 1024 * 1024 })
    const line = stdout.split(/\r?\n/).find(line => line.startsWith('nsis-timing: '))
    if (!line) throw new Error('installed smoke did not provide timing evidence')
    const sample = JSON.parse(line.slice('nsis-timing: '.length))
    for (const key of ['installMs', 'smokeMs', 'uninstallMs']) {
      if (!Number.isSafeInteger(sample[key]) || sample[key] < 0) throw new Error('invalid installed timing evidence')
    }
    if (label === 'candidate' && ['attribute-clear', 'install-before-probe', 'runtime-probe'].some(phase => !sample.phases?.some(item => item.phase === phase))) {
      throw new Error('candidate installer timing hooks did not execute')
    }
    samples[label].push(sample)
    console.log(`nsis-benchmark-sample: ${JSON.stringify({ label, round: round + 1, ...sample })}`)
  }
}
const baselineMedianMs = median(samples.baseline.map(sample => sample.installMs))
const candidateMedianMs = median(samples.candidate.map(sample => sample.installMs))
const report = { version: 1, platform: process.platform, arch: process.arch, checksums, samples, baselineMedianMs, candidateMedianMs,
  improvementPercent: baselineMedianMs === 0 ? null : (baselineMedianMs - candidateMedianMs) / baselineMedianMs * 100 }
await writeFile(resolve(outputArg), JSON.stringify(report, null, 2) + '\n')
console.log(`nsis-benchmark-result: ${JSON.stringify(report)}`)
