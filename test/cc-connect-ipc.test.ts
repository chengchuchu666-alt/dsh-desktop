import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { transformSync } from 'esbuild'
import { normalizeConnectSettings, connectApplicationsPath, CONNECT_DISPLAY_DEFAULTS } from '../src/main/cc-connect-config.ts'
import { credentialsPath } from '../src/main/cc-connect-credentials.ts'
import { ConnectApplicationStore } from '../src/main/cc-connect-applications.ts'
import { ConnectController, ConnectOperationError } from '../src/main/cc-connect-controller.ts'
import { atomicWriteFile } from '../src/main/config-file.ts'
import type { ConnectState } from '../src/main/cc-connect-types.ts'
import type { ConnectSaveResult, ConnectSettingsInput } from '../src/main/cc-connect-types.ts'

const preload = readFileSync('src/preload/index.ts', 'utf8')
const main = readFileSync('src/main/index.ts', 'utf8')

test('preload exposes only the narrow cc-connect bridge', () => {
  for (const [method, channel] of [
    ['getConnectState', 'desktop:connect:get-state'],
    ['saveConnectSettings', 'desktop:connect:save-settings'],
    ['pickConnectWorkspace', 'desktop:connect:pick-workspace'],
    ['startConnect', 'desktop:connect:start'],
    ['stopConnect', 'desktop:connect:stop'],
    ['restartConnect', 'desktop:connect:restart'],
  ]) {
    assert.match(preload, new RegExp(`${method}:[\\s\\S]*?ipcRenderer\\.invoke\\('${channel}'`))
  }
  assert.doesNotMatch(preload, /readSecret/)
})

test('cc-connect IPC handlers guard the Harness sender and use a native workspace picker', () => {
  for (const channel of [
    'desktop:connect:get-state',
    'desktop:connect:save-settings',
    'desktop:connect:pick-workspace',
    'desktop:connect:start',
    'desktop:connect:stop',
    'desktop:connect:restart',
  ]) {
    assert.match(main, new RegExp(`ipcMain\\.handle\\('${channel}'[\\s\\S]*?isMainWindowHarnessSender`))
  }
  assert.match(main, /dialog\.showOpenDialog[\s\S]*openDirectory/)
  assert.match(main, /isAbsolute\(.*workspace|workspace.*isAbsolute\(/)
  assert.match(main, /secretConfigured/)
})

/** Execute the actual registered save/get handlers with real temporary config
 * and credential storage. Only Electron/lifecycle capabilities are faked. */
async function settingsIPC(active = false, platform: NodeJS.Platform = process.platform) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-connect-ipc-'))
  let restarts = 0
  let stops = 0
  const store = new ConnectApplicationStore(home, { platform, storage: { isEncryptionAvailable: () => false,
    encryptString: () => { throw new Error('unused') }, decryptString: () => { throw new Error('unused') } } })
  const controller = new ConnectController({ store, environment: () => ({ safeMode: false, harnessReady: true }),
    validWorkspace: async workspace => isAbsolute(workspace) && (await stat(workspace)).isDirectory(),
    createProcess: async (_app, _secret, events) => ({
      start: async () => { restarts++; events.onState({ phase: 'ready', restartAttempts: 0 }); return true },
      stop: async () => { stops++ },
    }) })
  if (active) {
    const application = await store.save({ name: 'Feishu', appId: 'cli_fake', workspace: home, appSecret: 'fake-initial' })
    await controller.start('manual', application.id)
    restarts = 0; stops = 0
  }
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()
  const functions = main.slice(main.indexOf('async function readConnectState('), main.indexOf('function getConnectController('))
  const registrations = main.slice(main.indexOf("ipcMain.handle('desktop:connect:get-state'"), main.indexOf("ipcMain.handle('desktop:connect:pick-workspace'"))
  assert.ok(functions && registrations)
  const startRegistration = main.slice(main.indexOf("ipcMain.handle('desktop:connect:start'"), main.indexOf("ipcMain.handle('desktop:connect:stop'"))
  runInNewContext(transformSync(functions + registrations + startRegistration, { loader: 'ts', format: 'cjs' }).code, {
    getConnectController: () => controller, normalizeConnectSettings, ConnectOperationError, isAbsolute, stat, console,
    startConnectAfterHarness: () => controller.start('manual'),
    windowContext: { mainWindow: {}, allowedOrigin: 'test-harness' },
    isMainWindowHarnessSender: (_window: unknown, sender: unknown) => sender === 'authorized',
    ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => handlers.set(channel, handler) },
  })
  return {
    home, store, controller, get restarts() { return restarts }, get stops() { return stops },
    credentialDocument: async () => {
      const manifest = JSON.parse(await readFile(connectApplicationsPath(home), 'utf8'))
      return readFile(credentialsPath(home, manifest.credentials[manifest.activeApplicationId]), 'utf8')
    },
    save: (input: unknown, authorized = true) => handlers.get('desktop:connect:save-settings')!({ sender: authorized ? 'authorized' : 'untrusted' }, input) as Promise<ConnectSaveResult | null>,
    state: () => handlers.get('desktop:connect:get-state')!({ sender: 'authorized' }),
    start: (authorized = true) => handlers.get('desktop:connect:start')!({ sender: authorized ? 'authorized' : 'untrusted' }),
    close: () => rm(home, { recursive: true, force: true }),
  }
}

test('IPC reports macOS credential re-entry and refuses legacy starts without spawning', async () => {
  const ipc = await settingsIPC(false, 'darwin')
  try {
    const saved = await ipc.save({ enabled: true, appId: 'cli_legacy_ipc', workspace: ipc.home, appSecret: 'fake-ipc-secret' })
    assert.equal(saved?.ok, true)
    const manifest = JSON.parse(await readFile(connectApplicationsPath(ipc.home), 'utf8'))
    const path = credentialsPath(ipc.home, manifest.credentials[manifest.activeApplicationId])
    const legacy = JSON.stringify({ version: 1, protection: 'safeStorage', value: 'ZmFrZS1sZWdhY3k=' }) + '\n'
    await atomicWriteFile(path, legacy, 0o600)
    assert.equal(await ipc.start(), false)
    assert.equal(await ipc.start(false), false, 'unauthorized sender remains rejected')
    const state = await ipc.state() as ConnectState
    assert.equal(state.needsSecretReentry, true)
    assert.equal(state.secretConfigured, false)
    assert.equal(state.health?.errorCode, 'credentials')
    assert.equal(ipc.restarts, 0)
    assert.equal(await readFile(path, 'utf8'), legacy)
    assert.doesNotMatch(JSON.stringify(state), /fake-ipc-secret|ZmFrZS1sZWdhY3k=/)
  } finally { await ipc.close() }
})

test('save-settings accepts display preferences, returns resolved state and preserves them for legacy callers', async () => {
  const ipc = await settingsIPC(true)
  try {
    const input: ConnectSettingsInput = { enabled: true, appId: 'cli_fake', workspace: ipc.home, appSecret: 'fake-ipc-secret', detail: 'quiet', cardMode: 'rich', progressStyle: 'card', showStreamPreview: false, streamPreviewIntervalMs: 90000 }
    const result = await ipc.save(input)
    assert.equal(result?.ok, true)
    assert.equal(result!.state.detail, 'quiet')
    assert.equal(result!.state.streamPreviewIntervalMs, 30000)
    assert.equal(result!.state.cardMode, 'rich')
    assert.equal(result!.state.progressStyle, 'card')
    assert.equal(result!.state.showStreamPreview, false)
    assert.equal(ipc.restarts, 1)
    assert.equal(await ipc.store.readSecret(result!.state.applicationId!), 'fake-ipc-secret')
    const oldCall = await ipc.save({ enabled: true, appId: 'cli_fake', workspace: ipc.home, appSecret: '' })
    assert.equal(oldCall?.ok, true)
    assert.equal(oldCall!.state.detail, 'quiet')
    assert.equal(oldCall!.state.streamPreviewIntervalMs, 30000)
    assert.equal(oldCall!.state.secretConfigured, true)
    assert.doesNotMatch(JSON.stringify(await ipc.state()), /fake-ipc-secret|appSecret/)
    assert.doesNotMatch(await readFile(connectApplicationsPath(ipc.home), 'utf8'), /fake-ipc-secret|appSecret/)
    const closed = await ipc.save({ ...input, enabled: false, appSecret: '' })
    assert.equal(closed?.ok, true)
    assert.equal(closed!.state.enabled, false)
    assert.equal(closed!.state.phase, 'disabled')
    assert.equal(ipc.stops, 3, 'each live save stops its previous owner, including explicit disable')
  } finally { await ipc.close() }
})

test('save-settings rejects each invalid field before changing settings or credentials and guards the sender', async () => {
  const ipc = await settingsIPC()
  try {
    const base = { enabled: true, appId: 'cli_fake', workspace: ipc.home, appSecret: 'fake-before' }
    assert.equal((await ipc.save(base))?.ok, true)
    const settings = await readFile(connectApplicationsPath(ipc.home), 'utf8')
    const credentials = await ipc.credentialDocument()
    for (const fields of [
      { detail: 'loud' }, { detail: null }, { cardMode: 'unknown' }, { cardMode: false },
      { progressStyle: 'unknown' }, { progressStyle: 1 }, { showStreamPreview: 'false' },
      { streamPreviewIntervalMs: '3000' }, { streamPreviewIntervalMs: NaN }, { streamPreviewIntervalMs: Infinity },
      { streamPreviewIntervalMs: 1000.5 }, { streamPreviewIntervalMs: null },
    ]) {
      const result = await ipc.save({ ...base, appSecret: 'fake-after', ...fields })
      assert.equal(result?.ok, false)
      assert.equal(result && 'reason' in result ? result.reason : '', 'invalid-input')
      assert.equal(await readFile(connectApplicationsPath(ipc.home), 'utf8'), settings)
      assert.equal(await ipc.credentialDocument(), credentials)
    }
    assert.equal(await ipc.save(base, false), null)
    assert.equal(await readFile(connectApplicationsPath(ipc.home), 'utf8'), settings)
    assert.equal(ipc.restarts, 0)
  } finally { await ipc.close() }
})

test('display saves without a running supervisor do not implicitly start, and disabling still stops', async () => {
  const ipc = await settingsIPC()
  try {
    const legacy = await ipc.save({ enabled: false, appId: '', workspace: '' })
    assert.equal(legacy?.ok, true)
    for (const [key, value] of Object.entries(CONNECT_DISPLAY_DEFAULTS)) assert.equal(legacy!.state[key as keyof typeof legacy.state], value)
    const result = await ipc.save({ enabled: true, appId: 'cli_fake', workspace: ipc.home, detail: 'full', streamPreviewIntervalMs: -1 })
    assert.equal(result?.ok, true)
    assert.equal(result!.state.phase, 'stopped')
    assert.equal(result!.state.streamPreviewIntervalMs, 500)
    assert.equal(ipc.restarts, 0)
    assert.equal(ipc.stops, 0, 'no process exists to stop; live disable is covered above')
  } finally { await ipc.close() }
})
