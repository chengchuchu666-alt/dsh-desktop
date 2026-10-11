import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { ChildProcess, spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { ConnectSupervisor, type ConnectState } from '../src/main/cc-connect-supervisor.ts'
import type { ConnectHealth } from '../src/main/cc-connect-types.ts'

const SECRET = 'fake-sidecar-secret'

async function fixture(script: string, extra: Record<string, unknown> = {}): Promise<{
  supervisor: ConnectSupervisor
  states: ConnectState[]
  logDir: string
}> {
  const root = await mkdtemp(join(tmpdir(), 'cc-connect-supervisor-'))
  const states: ConnectState[] = []
  const supervisor = new ConnectSupervisor(
    { onState: state => states.push(state) },
    {
      command: process.execPath,
      args: ['-e', script],
      logDir: join(root, 'logs'),
      env: { DSH_CC_CONNECT_FEISHU_SECRET: SECRET, ...extra },
      readyTimeoutMs: 500,
      restartBaseDelayMs: 15,
      restartMaxDelayMs: 30,
      restartWindowMs: 2_000,
      maxRestarts: 2,
    },
  )
  return { supervisor, states, logDir: join(root, 'logs') }
}

test('disabled sidecar does not spawn and reports disabled', async () => {
  const { supervisor, states } = await fixture('throw new Error("must not spawn")', { CONNECT_ENABLED: '0' })
  supervisor.setEnabled(false)
  assert.equal(await supervisor.start(), false)
  assert.deepEqual(states, [{ phase: 'disabled' }])
  await supervisor.stop()
})

test('sidecar resolves readiness from stderr and records redacted output', async () => {
  const { supervisor, states, logDir } = await fixture("console.error('boot secret='+process.env.DSH_CC_CONNECT_FEISHU_SECRET); console.error('time=now level=INFO msg=\\\"cc-connect ready\\\" projects=1'); setInterval(()=>{},1000)")
  try {
    assert.equal(await supervisor.start(), true)
    const ready = states.at(-1)
    assert.equal(ready?.phase, 'ready')
    if (ready?.phase === 'ready') assert.equal(ready.restartAttempts, 0)
  } finally {
    await supervisor.stop()
  }
  const log = await readFile(join(logDir, 'cc-connect.log'), 'utf8')
  assert.doesNotMatch(log, new RegExp(SECRET))
  assert.match(log, /cc-connect ready/)
  await rm(logDir, { recursive: true, force: true })
})

test('sidecar retries a crash with bounded backoff and eventually becomes ready', async () => {
  const marker = join(await mkdtemp(join(tmpdir(), 'cc-connect-retry-')), 'started')
  const script = "const fs=require('node:fs'); if (!fs.existsSync(process.env.CONNECT_MARKER)) { fs.writeFileSync(process.env.CONNECT_MARKER, '1'); process.exit(2) } console.error('cc-connect ready projects=1'); setInterval(()=>{},1000)"
  const { supervisor, states } = await fixture(script, { CONNECT_MARKER: marker })
  try {
    assert.equal(await supervisor.start(), true)
    assert.ok(states.some(state => state.phase === 'starting' && state.stage === 'retrying'))
    assert.equal(states.at(-1)?.phase, 'ready')
  } finally {
    await supervisor.stop()
    await rm(marker, { force: true })
    await rm(join(marker, '..'), { recursive: true, force: true })
  }
})

test('sidecar reports crashed after the restart budget is exhausted', async () => {
  const { supervisor, states } = await fixture('process.exit(3)')
  await assert.rejects(supervisor.start(), /cc-connect restart budget exhausted/)
  const crashed = states.at(-1)
  assert.equal(crashed?.phase, 'crashed')
  if (crashed?.phase === 'crashed') assert.equal(crashed.restartAttempts, 3)
  await supervisor.stop()
})

test('stop is idempotent and concurrent start/stop share one operation', async () => {
  const { supervisor } = await fixture('setInterval(()=>{},1000)')
  const first = supervisor.start()
  const second = supervisor.start()
  assert.strictEqual(first, second)
  const stopping = supervisor.stop()
  await assert.rejects(first, /cc-connect stopped before ready/)
  await Promise.all([stopping, supervisor.stop()])
  assert.equal(await supervisor.stop(), undefined)
})

async function waitFor(check: () => boolean): Promise<void> {
  const deadline = Date.now() + 4000
  while (!check()) {
    assert.ok(Date.now() < deadline, 'supervisor transition did not finish')
    await delay(10)
  }
}

test('repeated crashes after ready still exhaust the budget and each successful retry reports ready', async () => {
  const { supervisor, states, logDir } = await fixture("console.error('cc-connect ready projects=1'); setTimeout(()=>process.exit(3),40)")
  try {
    assert.equal(await supervisor.start(), true)
    await waitFor(() => states.at(-1)?.phase === 'crashed')
    const ready = states.filter(state => state.phase === 'ready')
    assert.deepEqual(ready.map(state => state.phase === 'ready' ? state.restartAttempts : -1), [0, 1, 2])
    const crashed = states.at(-1)
    assert.equal(crashed?.phase, 'crashed')
    if (crashed?.phase === 'crashed') assert.equal(crashed.restartAttempts, 3)
  } finally { await supervisor.stop(); await rm(join(logDir, '..'), { recursive: true, force: true }) }
})

test('ready does not infer channel/model availability and only structured health events update them', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cc-connect-health-'))
  const health: ConnectHealth[] = []
  const line = (event: unknown) => 'level=INFO msg="cc-connect health" event=' + JSON.stringify(JSON.stringify(event))
  const script = [
    `console.error('connected to wss://arbitrary-log'); console.error('cc-connect ready projects=1');`,
    `setTimeout(()=>console.error(${JSON.stringify(line({ version: 1, component: 'channel', state: 'online' }))}),80);`,
    `setTimeout(()=>console.error(${JSON.stringify(line({ version: 1, component: 'agent', state: 'unavailable', errorCode: 'model-key-missing' }))}),120);`,
    'setInterval(()=>{},1000);',
  ].join('')
  const supervisor = new ConnectSupervisor({ onState: () => {}, onHealth: state => health.push(state) }, {
    command: process.execPath, args: ['-e', script], logDir: root, readyTimeoutMs: 2000,
  })
  try {
    assert.equal(await supervisor.start(), true)
    assert.deepEqual(health.at(-1), { channel: 'unknown', dsh: 'unknown' })
    await waitFor(() => health.at(-1)?.errorCode === 'model-key-missing')
    assert.deepEqual(health.at(-1), { channel: 'online', dsh: 'unavailable', errorCode: 'model-key-missing' })
    assert.equal(supervisor.currentState().phase, 'ready')
    assert.equal(health.at(-1)?.verifiedAt, undefined)
  } finally { await supervisor.stop(); await rm(root, { recursive: true, force: true }) }
})

test('stopping an unready automatic retry cancels its timer and cannot report a phantom crash later', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cc-connect-retry-stop-'))
  const states: ConnectState[] = []
  let spawns = 0
  const children: ChildProcess[] = []
  const spawnImpl = (() => {
    const child = new EventEmitter() as ChildProcess
    Object.assign(child, { stdout: new PassThrough(), stderr: new PassThrough(), exitCode: null,
      kill: () => { queueMicrotask(() => { Object.assign(child, { exitCode: 0 }); child.emit('exit', 0, null) }); return true } })
    children.push(child)
    if (++spawns === 1) queueMicrotask(() => child.stderr!.emit('data', Buffer.from('cc-connect ready projects=1\n')))
    return child
  }) as typeof spawn
  const supervisor = new ConnectSupervisor({ onState: state => states.push(state) }, {
    command: process.execPath, spawnImpl, logDir: root, readyTimeoutMs: 80, restartBaseDelayMs: 5, stopTimeoutMs: 10,
  })
  try {
    assert.equal(await supervisor.start(), true)
    Object.assign(children[0]!, { exitCode: 3 }); children[0]!.emit('exit', 3, null)
    await waitFor(() => spawns === 2)
    await supervisor.stop()
    await delay(120)
    assert.equal(states.at(-1)?.phase, 'stopped')
    assert.equal(states.filter(state => state.phase === 'crashed').length, 0)
    assert.equal(spawns, 2)
  } finally { await supervisor.stop(); await rm(root, { recursive: true, force: true }) }
})

test('a refused stop retains ownership and blocks another spawn until the same process actually exits', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cc-connect-stop-refused-'))
  const child = new EventEmitter() as ChildProcess
  Object.assign(child, { stdout: new PassThrough(), stderr: new PassThrough(), exitCode: null, kill: () => false })
  let spawns = 0
  const spawnImpl = (() => {
    spawns++
    queueMicrotask(() => child.stderr!.emit('data', Buffer.from('cc-connect ready projects=1\n')))
    return child
  }) as typeof spawn
  const supervisor = new ConnectSupervisor({ onState: () => {} }, { command: process.execPath, spawnImpl, logDir: root, stopTimeoutMs: 1 })
  try {
    assert.equal(await supervisor.start(), true)
    await assert.rejects(supervisor.stop(), /stop failed/)
    assert.equal(supervisor.currentState().phase, 'degraded')
    await assert.rejects(supervisor.start(), /already active/)
    assert.equal(spawns, 1)
    child.emit('exit', 0, null)
    await supervisor.stop()
    assert.equal(supervisor.currentState().phase, 'stopped')
  } finally {
    child.emit('exit', 0, null)
    await supervisor.stop()
    await rm(root, { recursive: true, force: true })
  }
})
