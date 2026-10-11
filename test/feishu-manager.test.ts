import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { ConnectApplicationStore } from '../src/main/cc-connect-applications.ts'
import { ConnectController } from '../src/main/cc-connect-controller.ts'
import { FeishuManager } from '../src/main/feishu-manager.ts'
import { FeishuSetupError, type FeishuSetupResult, type FeishuSetupRunOptions } from '../src/main/feishu-setup.ts'

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'dsh-feishu-manager-'))
  const store = new ConnectApplicationStore(home, { storage: { isEncryptionAvailable: () => false, encryptString: () => Buffer.alloc(0), decryptString: () => '' } })
  const environment = { safeMode: false, harnessReady: true }
  const actions: string[] = []
  const runs: { options: Pick<FeishuSetupRunOptions, 'workspace' | 'onQr' | 'onStage'>; resolve(result: FeishuSetupResult): void; reject(error: Error): void; cleanups: number }[] = []
  const controller = new ConnectController({ store, environment: () => environment, validWorkspace: async value => value === home,
    createProcess: async (app, _secret, events) => ({
      start: async () => { actions.push(`start:${app.id}`); events.onState({ phase: 'ready', restartAttempts: 0 }); return true },
      stop: async () => { actions.push(`stop:${app.id}`) },
    }) })
  const manager = new FeishuManager({ controller, environment: () => environment, validWorkspace: async value => value === home,
    createRun: options => {
      let resolve!: (result: FeishuSetupResult) => void, reject!: (error: Error) => void
      const promise = new Promise<FeishuSetupResult>((yes, no) => { resolve = yes; reject = no })
      const run = { options, resolve, reject, cleanups: 0 }; runs.push(run)
      return { start: () => promise, cancel: () => reject(new FeishuSetupError('cancelled')), cleanup: async () => { run.cleanups++ } }
    } })
  return { home, store, controller, manager, environment, actions, runs,
    close: async () => { await manager.cancelQr(); await controller.pause(); await rm(home, { recursive: true, force: true }) } }
}

async function waitFor(check: () => Promise<boolean>) {
  const deadline = Date.now() + 2000
  while (!await check()) { assert.ok(Date.now() < deadline, 'QR completion not observed'); await delay(10) }
}

test('QR saves a separate record and never switches or starts it; public state cannot expose credentials', async () => {
  const f = await fixture()
  try {
    const first = await f.controller.saveApplication({ name: 'Existing', appId: 'cli_existing', workspace: f.home, appSecret: 'fake-existing' })
    await f.controller.start('manual', first.id)
    const before = [...f.actions]
    assert.equal((await f.manager.execute('qr-start', { name: 'New robot', workspace: f.home, detail: 'quiet', streamPreviewIntervalMs: 8000, cardMode: 'rich', progressStyle: 'card' })).ok, true)
    f.runs[0]!.options.onQr!(Buffer.from('fake-png'))
    assert.equal((await f.manager.state()).qr.stage, 'waiting-for-scan')
    f.runs[0]!.resolve({ appId: 'cli_new', appSecret: 'fake-qr-secret', status: 'completed' })
    await waitFor(async () => (await f.manager.state()).qr.stage === 'saved')
    const state = await f.manager.state(), added = state.applications.find(app => app.appId === 'cli_new')!
    assert.equal(added.name, 'New robot'); assert.equal(added.detail, 'quiet'); assert.equal(added.streamPreviewIntervalMs, 8000)
    assert.equal(added.cardMode, 'rich'); assert.equal(added.progressStyle, 'card')
    assert.equal(state.activeApplicationId, first.id); assert.equal(state.connection.phase, 'ready')
    assert.deepEqual(f.actions, before)
    assert.equal(state.qr.applicationId, added.id)
    assert.equal(await f.store.readSecret(added.id), 'fake-qr-secret')
    assert.doesNotMatch(JSON.stringify(state), /fake-qr-secret|fake-existing|appSecret|credentials/)
    assert.equal((await f.manager.execute('start', added.id)).ok, true)
    assert.deepEqual(f.actions.slice(-2), [`stop:${first.id}`, `start:${added.id}`])
  } finally { await f.close() }
})

test('expiry, cancel, window closure and retry cannot save a stale QR or change connection intent', async () => {
  const f = await fixture()
  try {
    await f.manager.execute('qr-start', { name: 'Expired', workspace: f.home })
    f.runs[0]!.reject(new FeishuSetupError('expired'))
    await waitFor(async () => (await f.manager.state()).qr.stage === 'expired')
    assert.equal((await f.manager.execute('qr-start', { name: 'Cancelled', workspace: f.home })).ok, true)
    await f.manager.cancelQr() // same operation as closing the manager window
    f.runs[1]!.options.onQr!(Buffer.from('stale-png'))
    f.runs[1]!.resolve({ appId: 'cli_stale', appSecret: 'fake-stale', status: 'completed' })
    assert.deepEqual((await f.manager.state()).qr, { stage: 'cancelled' })
    assert.equal((await f.store.read()).applications.length, 0)
    assert.equal((await f.store.read()).enabled, false)
    assert.equal(f.runs[0]!.cleanups, 1); assert.equal(f.runs[1]!.cleanups, 1)
    assert.equal((await f.manager.execute('qr-start', { name: 'Retry', workspace: f.home })).ok, true)
    f.runs[2]!.resolve({ appId: 'cli_retry', appSecret: 'fake-retry', status: 'completed' })
    await waitFor(async () => (await f.manager.state()).qr.stage === 'saved')
    assert.equal((await f.store.read()).applications.length, 1)
    assert.equal((await f.store.read()).enabled, false, 'saving is not opening')
  } finally { await f.close() }
})

test('manager actions validate before mutation, persist preferences/close and do not expose arbitrary capabilities', async () => {
  const f = await fixture()
  try {
    for (const [action, input, reason] of [
      ['arbitrary-shell', 'echo secret', 'invalid-input'], ['auto-connect', 'true', 'invalid-input'], ['remove', {}, 'invalid-input'],
      ['qr-start', { name: 'x', workspace: f.home, detail: 'loud' }, 'invalid-input'],
      ['qr-start', { name: 'x', workspace: '/invalid' }, 'invalid-workspace'],
      ['qr-start', { name: 'x', workspace: f.home, appSecret: 'fake' }, 'invalid-input'],
    ]) assert.deepEqual(await f.manager.execute(action, input).then(result => result.ok ? undefined : result.reason), reason)
    assert.equal(f.runs.length, 0); assert.equal(f.actions.length, 0)
    const saved = await f.manager.execute('save', { name: 'Manual', appId: 'cli_manual', appSecret: 'fake-manual', workspace: f.home })
    assert.equal(saved.ok, true)
    const id = (await f.manager.state()).applications[0]!.id
    assert.equal((await f.manager.execute('start', id)).ok, true)
    assert.equal((await f.manager.execute('auto-connect', true)).ok, true)
    assert.equal((await f.manager.execute('close')).ok, true)
    assert.deepEqual({ enabled: (await f.store.read()).enabled, autoConnect: (await f.store.read()).autoConnect }, { enabled: false, autoConnect: true })
    assert.equal((await f.manager.execute('restart')).ok, false)
    assert.equal((await f.manager.execute('remove', id)).ok, true)
    assert.equal((await f.store.read()).applications.length, 0)
    f.environment.safeMode = true
    assert.equal((await f.manager.state()).safeMode, true)
  } finally { await f.close() }
})
