import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseNsisPhaseTimings, median } from '../scripts/nsis-timing.mjs'

test('NSIS timing parser accepts only numeric known phases, never probe paths or malformed input', () => {
  assert.deepEqual(parseNsisPhaseTimings('customInit dir=[private-path] handle=[1]\r\ndsh-timing phase=attribute-clear elapsed_ms=0\r\ndsh-timing phase=install-before-probe elapsed_ms=100120\r\ndsh-timing phase=runtime-probe elapsed_ms=3\r\ndsh-timing phase=unknown elapsed_ms=2\ndsh-timing phase=runtime-probe elapsed_ms=-1\ndsh-timing phase=runtime-probe elapsed_ms=9007199254740992\n'), [
    { phase: 'attribute-clear', elapsedMs: 0 }, { phase: 'install-before-probe', elapsedMs: 100120 }, { phase: 'runtime-probe', elapsedMs: 3 },
  ])
  assert.deepEqual(parseNsisPhaseTimings('old installer without timing hooks'), [])
})

test('benchmark median is deterministic, non-mutating, and rejects unusable samples', () => {
  const samples = [120, 90, 105]
  assert.equal(median(samples), 105); assert.deepEqual(samples, [120, 90, 105])
  assert.equal(median([100, 120]), 110)
  for (const values of [[], [NaN], [Infinity], [-1]]) assert.throws(() => median(values), /invalid timing/)
})

test('installer timing retains runtime occupancy failure and release benchmarks cannot publish a branch', async () => {
  const hooks = await readFile('build/installer.nsh', 'utf8')
  for (const phase of ['attribute-clear', 'install-before-probe', 'runtime-probe']) assert.ok(hooks.includes(phase))
  assert.match(hooks, /SetErrorLevel 5/)
  assert.match(hooks, /i 1073741824, i 0/)
  assert.match(hooks, /!ifndef BUILD_UNINSTALLER\s+Var DshInstallStartTick/)
  assert.match(hooks, /!macroend\s+!endif\s*$/)
  const workflow = await readFile('.github/workflows/release.yml', 'utf8')
  assert.match(workflow, /github\.event_name == 'workflow_dispatch'/)
  assert.match(workflow, /if: \$\{\{ github\.ref_type == 'tag' \}\}/)
  assert.match(workflow, /github\.event_name == 'workflow_dispatch' && '--allow-same-version' \|\| ''/)
  // Every build runner must be covered by a cross-version upgrade step. Linux
  // runs on two Ubuntu runners (x64 and arm64) behind one prefix guard.
  const runners = [...workflow.matchAll(/^ {10}- os: (\S+)$/gm)].map(match => match[1]!)
  assert.ok(runners.length >= 4, `expected the build matrix to list its runners, saw ${runners.join(', ')}`)
  const guards = [...workflow.matchAll(/Cross-version upgrade[^\n]+\n {8}if: (.+)$/gm)].map(match => match[1]!.trim())
  const covers = (guard: string, os: string): boolean => {
    const equality = /^matrix\.os == '([^']+)'$/.exec(guard)
    if (equality !== null) return equality[1] === os
    const prefix = /^startsWith\(matrix\.os, '([^']+)'\)$/.exec(guard)
    return prefix !== null && prefix[1] !== undefined && os.startsWith(prefix[1])
  }
  for (const os of runners) {
    assert.ok(guards.some(guard => covers(guard, os)), `no cross-version upgrade guard covers ${os}`)
  }
})
