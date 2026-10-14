import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConnectController, ConnectOperationError, type ConnectControllerOptions } from '../src/main/cc-connect-controller.ts'
import { ConnectApplicationStore } from '../src/main/cc-connect-applications.ts'
import { credentialsPath } from '../src/main/cc-connect-credentials.ts'
import { connectApplicationsPath } from '../src/main/cc-connect-config.ts'
import { atomicWriteFile } from '../src/main/config-file.ts'

async function fixture(platform: NodeJS.Platform = process.platform) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-connect-controller-'))
  const store = new ConnectApplicationStore(home, { platform, storage: { isEncryptionAvailable: () => false, encryptString: () => Buffer.alloc(0), decryptString: () => '' } })
  const environment = { safeMode: false, harnessReady: true }
  let stopFailure = false
  let startFailure = false
  let living = 0
  let maxLiving = 0
  let blockStart = false
  let releaseStart: ((ready: boolean) => void) | undefined
  let notifyStarted: () => void = () => {}
  const whenStarted = new Promise<void>(resolve => { notifyStarted = resolve })
  const events: Parameters<ConnectControllerOptions['createProcess']>[2][] = []
  const actions: string[] = []
  const controller = new ConnectController({ store, environment: () => environment, validWorkspace: async path => path === home,
    createProcess: async (application, secret, callbacks) => {
      assert.equal(secret, `fake-${application.appId}`)
      events.push(callbacks)
      let live = false
      return {
        start: async () => {
          actions.push(`start:${application.id}`)
          if (startFailure) throw new Error('fake-private-start-error')
          live = true; living++; maxLiving = Math.max(maxLiving, living)
          notifyStarted()
          if (blockStart) return new Promise<boolean>(resolve => { releaseStart = resolve })
          callbacks.onState({ phase: 'ready', restartAttempts: 0 })
          return true
        },
        stop: async () => {
          actions.push(`stop:${application.id}`)
          if (stopFailure) throw new Error('fake-private-stop-error')
          if (live) { living--; live = false }
          releaseStart?.(false)
          callbacks.onState({ phase: 'stopped' })
        },
      }
    },
  })
  return { home, store, environment, controller, events, actions,
    get living() { return living }, get maxLiving() { return maxLiving },
    set stopFailure(value: boolean) { stopFailure = value }, set startFailure(value: boolean) { startFailure = value },
    set blockStart(value: boolean) { blockStart = value }, whenStarted,
    add: (appId: string) => controller.saveApplication({ name: appId, appId, workspace: home, appSecret: `fake-${appId}` }),
    close: async () => { stopFailure = false; releaseStart?.(false); await controller.pause(); await rm(home, { recursive: true, force: true }) },
  }
}

test('terminal shutdown preempts a pending start, deduplicates stops, and retains connection intent', async () => {
  const f = await fixture()
  try {
    const app = await f.add('one')
    await f.store.setIntent({ enabled: true, autoConnect: true })
    f.blockStart = true
    const started = f.controller.start('startup', app.id)
    await f.whenStarted
    await f.controller.shutdown()
    assert.equal(await started, false)
    assert.equal(f.living, 0)
    assert.equal(f.actions.filter(action => action.startsWith('stop:')).length, 1)
    assert.equal(await f.controller.start('manual', app.id), false)
    assert.equal(f.actions.filter(action => action.startsWith('start:')).length, 1)
    assert.equal((await f.store.read()).enabled, true)
    assert.equal((await f.store.read()).autoConnect, true)
  } finally { await f.close() }
})

test('a process factory that finishes after shutdown is stopped without starting', async () => {
  const f = await fixture()
  let releaseFactory: () => void = () => {}
  let notifyFactory: () => void = () => {}
  const pending = new Promise<void>(resolve => { releaseFactory = resolve })
  const entered = new Promise<void>(resolve => { notifyFactory = resolve })
  let starts = 0; let stops = 0
  const controller = new ConnectController({ store: f.store, environment: () => f.environment,
    validWorkspace: async () => true, createProcess: async () => {
      notifyFactory(); await pending
      return { start: async () => { starts++; return true }, stop: async () => { stops++ } }
    } })
  try {
    const app = await f.add('one')
    const started = controller.start('manual', app.id)
    await entered
    const stopped = controller.shutdown()
    releaseFactory()
    await stopped
    assert.equal(await started, false)
    assert.equal(starts, 0); assert.equal(stops, 1)
    assert.equal(controller.hasProcess, false)
  } finally { releaseFactory(); await controller.shutdown().catch(() => {}); await f.close() }
})

test('macOS legacy credentials block startup without spawning or retrying, and explicit re-entry restores the connection', async () => {
  const f = await fixture('darwin')
  try {
    const app = await f.add('legacy')
    const manifest = JSON.parse(await readFile(connectApplicationsPath(f.home), 'utf8'))
    const path = credentialsPath(f.home, manifest.credentials[app.id])
    const legacy = JSON.stringify({ version: 1, protection: 'safeStorage', value: 'ZmFrZS1sZWdhY3k=' }) + '\n'
    await atomicWriteFile(path, legacy, 0o600)
    await f.store.setIntent({ enabled: true, autoConnect: true })
    for (const reason of ['startup', 'manual', 'restart', 'resume'] as const) assert.equal(await f.controller.start(reason), false)
    const state = await f.controller.state()
    assert.equal(state.connection.needsSecretReentry, true)
    assert.equal(state.connection.secretConfigured, false)
    assert.equal(state.health.errorCode, 'credentials')
    assert.equal(f.living, 0)
    assert.equal(f.actions.length, 0)
    assert.equal(await readFile(path, 'utf8'), legacy)
    await f.controller.saveApplication({ id: app.id, name: app.name, appId: app.appId, workspace: f.home, appSecret: 'fake-legacy' })
    assert.equal(await f.controller.start('startup'), true)
    assert.equal((await f.controller.state()).connection.needsSecretReentry, undefined)
  } finally { await f.close() }
})

test('persistent close survives startup and Safe Mode exit; pause and autoConnect have independent semantics', async () => {
  const f = await fixture()
  try {
    const app = await f.add('one')
    assert.equal(await f.controller.start('startup'), false)
    assert.equal(await f.controller.start('manual', app.id), true)
    await f.controller.setAutoConnect(false)
    await f.controller.pause()
    assert.equal((await f.store.read()).enabled, true)
    assert.equal(await f.controller.start('startup'), false)
    f.environment.safeMode = true
    assert.equal(await f.controller.start('resume'), false)
    f.environment.safeMode = false
    assert.equal(await f.controller.start('resume'), true, 'startup preference does not block Safe Mode resume')
    await f.controller.close()
    assert.equal((await f.store.read()).enabled, false)
    assert.equal((await f.controller.state()).connection.phase, 'disabled')
    assert.equal(await f.controller.start('startup'), false)
    assert.equal(await f.controller.start('resume'), false)
    assert.equal(await f.controller.start('restart'), false)
    assert.equal(f.living, 0)
    assert.equal((await new ConnectApplicationStore(f.home).read()).enabled, false, 'intent is on disk, not just in memory')
  } finally { await f.close() }
})

test('switches and concurrent starts serialize; stop failure keeps the owner and refuses a second process', async () => {
  const f = await fixture()
  try {
    const first = await f.add('one'), second = await f.add('two')
    await f.controller.start('manual', first.id)
    f.stopFailure = true
    await assert.rejects(f.controller.close(), (error: unknown) => error instanceof ConnectOperationError && error.reason === 'stop-failed')
    assert.equal((await f.store.read()).enabled, false, 'close intent is saved even when the process refuses to stop')
    const failed = await f.controller.state()
    assert.equal(failed.connection.phase, 'degraded')
    assert.equal(failed.health.errorCode, 'stop-failed')
    assert.equal(failed.activeApplicationId, first.id)
    await assert.rejects(f.controller.start('manual', second.id), /stop-failed/)
    assert.equal((await f.store.read()).activeApplicationId, first.id)
    assert.equal(f.living, 1)
    f.stopFailure = false
    await Promise.all([f.controller.start('manual', second.id), f.controller.start('manual', first.id), f.controller.start('manual', second.id)])
    assert.equal((await f.controller.state()).activeApplicationId, second.id)
    assert.equal(f.living, 1); assert.equal(f.maxLiving, 1)
    const current = await f.controller.state()
    f.events[0]!.onState({ phase: 'crashed', restartAttempts: 9, lastError: 'stale', logTail: '' })
    f.events[0]!.onHealth({ channel: 'online', dsh: 'available' })
    assert.deepEqual(await f.controller.state(), current, 'old process cannot overwrite current health/runtime')
  } finally { await f.close() }
})

test('saving another application is inert; active preferences restart without dropping Secret or omitted fields', async () => {
  const f = await fixture()
  try {
    const first = await f.add('one')
    await f.controller.start('manual', first.id)
    const actions = f.actions.length
    await f.add('two')
    assert.equal(f.actions.length, actions)
    assert.equal((await f.store.read()).activeApplicationId, first.id)
    await f.controller.saveLegacy({ enabled: true, appId: 'one', workspace: f.home, detail: 'quiet', progressStyle: 'card', cardMode: 'rich', showStreamPreview: false, streamPreviewIntervalMs: 8000, appSecret: '' })
    await f.controller.saveLegacy({ enabled: true, appId: 'one', workspace: f.home })
    const state = await f.controller.state()
    assert.equal(state.connection.detail, 'quiet'); assert.equal(state.connection.streamPreviewIntervalMs, 8000)
    assert.equal(state.connection.cardMode, 'rich'); assert.equal(state.connection.progressStyle, 'card')
    assert.equal(state.connection.secretConfigured, true)
    assert.equal(await f.store.readSecret(first.id), 'fake-one')
    assert.doesNotMatch(JSON.stringify(state), /fake-one|appSecret|credentials/)
    await assert.rejects(f.controller.saveLegacy({ enabled: true, appId: 'two', workspace: f.home }), /invalid-input/)
    assert.equal(f.maxLiving, 1)
  } finally { await f.close() }
})

test('missing credentials, invalid workspace, Safe Mode and unready Harness do not spawn or infer model readiness', async () => {
  const f = await fixture()
  try {
    const noSecret = await f.controller.saveApplication({ name: 'Missing', appId: 'missing', workspace: f.home })
    assert.equal(await f.controller.start('manual', noSecret.id), false)
    assert.equal((await f.controller.state()).health.errorCode, 'credentials')
    await assert.rejects(f.controller.saveApplication({ name: 'Bad', appId: 'bad', workspace: '/invalid', appSecret: 'fake-bad' }), /invalid-workspace/)
    const app = await f.add('one')
    f.environment.harnessReady = false
    assert.equal(await f.controller.start('manual', app.id), false)
    f.environment.harnessReady = true; f.environment.safeMode = true
    assert.equal(await f.controller.start('manual'), false)
    assert.equal(f.living, 0)
    f.environment.safeMode = false
    assert.equal(await f.controller.start('resume'), true)
    assert.deepEqual((await f.controller.state()).health, { channel: 'unknown', dsh: 'unknown' })
    f.events.at(-1)!.onHealth({ channel: 'online', dsh: 'unavailable', errorCode: 'model-key-missing' })
    assert.equal((await f.controller.state()).connection.phase, 'ready')
    assert.equal((await f.controller.state()).health.errorCode, 'model-key-missing')
    assert.equal((await f.controller.state()).health.verifiedAt, undefined)
  } finally { await f.close() }
})

test('removal stops only the target and start errors are sanitized; later operations still work', async () => {
  const f = await fixture()
  try {
    const first = await f.add('one'), second = await f.add('two')
    f.startFailure = true
    assert.equal(await f.controller.start('manual', first.id), false)
    const failed = await f.controller.state()
    assert.equal(failed.connection.phase, 'crashed')
    assert.doesNotMatch(JSON.stringify(failed), /fake-private|fake-one/)
    f.startFailure = false
    assert.equal(await f.controller.start('manual', first.id), true)
    const actions = f.actions.length
    await f.controller.remove(second.id)
    assert.equal(f.actions.length, actions, 'inactive removal does not touch current process')
    await f.controller.remove(first.id)
    assert.equal(f.living, 0)
    assert.equal((await f.store.read()).enabled, false)
    assert.equal((await f.controller.state()).applications.length, 0)
  } finally { await f.close() }
})
