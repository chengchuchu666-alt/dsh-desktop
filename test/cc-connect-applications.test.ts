import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { ConnectApplicationStore, ConnectApplicationError, parseConnectApplicationInput } from '../src/main/cc-connect-applications.ts'
import { ConnectCredentials, credentialsPath } from '../src/main/cc-connect-credentials.ts'
import { connectApplicationsPath, connectSettingsPath, writeConnectSettings, CONNECT_DISPLAY_DEFAULTS } from '../src/main/cc-connect-config.ts'
import { atomicWriteFile } from '../src/main/config-file.ts'

function storage(available = false) {
  return { isEncryptionAvailable: () => available,
    encryptString: (value: string) => Buffer.from(`protected:${value}`),
    decryptString: (value: Buffer) => value.toString().replace(/^protected:/, '') }
}

async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'dsh-connect-applications-'))
  const adapter = storage()
  return { home, adapter, store: new ConnectApplicationStore(home, { storage: adapter }),
    close: () => rm(home, { recursive: true, force: true }) }
}

function reason(expected: ConnectApplicationError['reason']) {
  return (error: unknown) => error instanceof ConnectApplicationError && error.reason === expected
}

test('legacy migration preserves intent, all display preferences and protected credential bytes without decryption', async () => {
  const f = await fixture()
  try {
    for (const protectedStorage of [true, false]) {
      const home = join(f.home, String(protectedStorage))
      const settings = { enabled: true, appId: 'cli_legacy', workspace: f.home,
        detail: 'quiet' as const, showStreamPreview: false, streamPreviewIntervalMs: 8000, cardMode: 'rich' as const, progressStyle: 'card' as const }
      await writeConnectSettings(home, settings)
      const credential = new ConnectCredentials(credentialsPath(home), storage(protectedStorage))
      await credential.setSecret('fake-migration-secret')
      const before = await readFile(credentialsPath(home), 'utf8')
      const oldSettings = await readFile(connectSettingsPath(home), 'utf8')
      const unavailable = { ...storage(false), decryptString: () => { throw new Error('must not decrypt during migration') } }
      const store = new ConnectApplicationStore(home, { storage: unavailable })
      const manager = await store.read()
      assert.equal(manager.enabled, true); assert.equal(manager.autoConnect, true)
      assert.equal(manager.applications.length, 1)
      const application = manager.applications[0]
      assert.ok(application)
      assert.equal(manager.activeApplicationId, application.id)
      assert.equal(await store.dataDirectory(application.id), join(home, 'cc-connect', 'data'), 'legacy chat sessions stay in place')
      const { enabled: _enabled, ...expected } = settings
      assert.deepEqual(application, { ...expected, id: application.id, name: 'Feishu' })
      const manifest = JSON.parse(await readFile(connectApplicationsPath(home), 'utf8'))
      const path = credentialsPath(home, manifest.credentials[application.id])
      assert.equal(await readFile(path, 'utf8'), before, 'copy does not downgrade encryption')
      assert.equal((await stat(path)).mode & 0o777, 0o600)
      assert.equal((await stat(connectApplicationsPath(home))).mode & 0o777, 0o600)
      await assert.rejects(stat(credentialsPath(home)), { code: 'ENOENT' })
      assert.equal(await readFile(connectSettingsPath(home), 'utf8'), oldSettings)
      assert.doesNotMatch(JSON.stringify(await store.applications()), /fake-migration-secret|appSecret|protected:/)
      const reopened = new ConnectApplicationStore(home, { storage: storage(protectedStorage) })
      assert.deepEqual(await reopened.read(), manager)
      assert.equal(await reopened.readSecret(application.id), 'fake-migration-secret')
    }
  } finally { await f.close() }
})

test('missing legacy fields get quieter defaults; saved applications are isolated and duplicate App IDs update one record', async () => {
  const f = await fixture()
  try {
    await writeConnectSettings(f.home, { enabled: false, appId: 'cli_old', workspace: f.home })
    const initial = await f.store.read()
    assert.equal(initial.autoConnect, false)
    const first = initial.applications[0]
    assert.ok(first)
    for (const [key, value] of Object.entries(CONNECT_DISPLAY_DEFAULTS)) assert.equal(first[key as keyof typeof first], value)
    const second = await f.store.save({ name: 'Second', appId: 'cli_second', workspace: f.home, appSecret: 'fake-second', detail: 'full' })
    assert.equal(await f.store.dataDirectory(first.id), join(f.home, 'cc-connect', 'data'))
    assert.equal(await f.store.dataDirectory(second.id), join(f.home, 'cc-connect', 'applications', second.id, 'data'))
    await assert.rejects(f.store.dataDirectory('../../escape'), reason('not-found'))
    const snapshot = await f.store.snapshot()
    assert.equal(snapshot.activeApplicationId, first.id)
    assert.equal(snapshot.applications.find(item => item.id === second.id)!.secretConfigured, true)
    assert.doesNotMatch(JSON.stringify(snapshot), /fake-second|credentials|legacyDataApplicationId/)
    assert.equal((await f.store.read()).activeApplicationId, first.id, 'save does not switch')
    assert.equal(await f.store.readSecret(first.id), undefined)
    assert.equal(await f.store.readSecret(second.id), 'fake-second')
    const firstState = (await f.store.applications())[0]
    assert.ok(firstState)
    assert.equal(firstState.secretConfigured, false)
    const duplicate = await f.store.save({ name: 'Renamed', appId: 'cli_second', workspace: f.home, appSecret: '', progressStyle: 'card' })
    assert.equal(duplicate.id, second.id)
    assert.equal(duplicate.detail, 'full', 'omitted preferences retained')
    assert.equal(duplicate.progressStyle, 'card')
    assert.equal((await f.store.read()).applications.length, 2)
    assert.equal(await f.store.readSecret(second.id), 'fake-second', 'blank credential retains existing')
    await assert.rejects(f.store.save({ id: first.id, name: 'Collision', appId: 'cli_second', workspace: f.home }), reason('duplicate-app-id'))
    await assert.rejects(f.store.save({ id: second.id, name: 'Other ID', appId: 'cli_other', workspace: f.home }), reason('invalid-input'))
    const changed = await f.store.save({ id: second.id, name: 'Other ID', appId: 'cli_other', workspace: f.home, appSecret: 'fake-other' })
    assert.equal(changed.id, second.id)
    assert.equal(await f.store.readSecret(second.id), 'fake-other')
    assert.doesNotMatch(await readFile(connectApplicationsPath(f.home), 'utf8'), /fake-second|fake-other|appSecret/)
    assert.equal((await readdir(join(f.home, 'cc-connect', 'credentials'))).length, 1, 'old revision removed after commit')
  } finally { await f.close() }
})

test('failed migration and failed credential replacement retain the only usable old configuration', async () => {
  const f = await fixture()
  try {
    await writeConnectSettings(f.home, { enabled: true, appId: 'cli_old', workspace: f.home, detail: 'quiet' })
    await new ConnectCredentials(credentialsPath(f.home), f.adapter).setSecret('fake-old')
    const before = await readFile(credentialsPath(f.home), 'utf8')
    const fail = new ConnectApplicationStore(f.home, { storage: f.adapter, write: async () => { throw new Error('fake-secret-error') } })
    await assert.rejects(fail.read(), error => { assert.ok(reason('storage')(error)); assert.doesNotMatch(String(error), /fake-secret-error|fake-old/); return true })
    assert.equal(await readFile(credentialsPath(f.home), 'utf8'), before)
    await assert.rejects(stat(connectApplicationsPath(f.home)), { code: 'ENOENT' })
    const manager = await f.store.read()
    const application = manager.applications[0]
    assert.ok(application)
    const manifest = await readFile(connectApplicationsPath(f.home), 'utf8')
    await assert.rejects(fail.save({ id: application.id, name: 'New', appId: application.appId, workspace: f.home, appSecret: 'fake-new', detail: 'full' }), reason('storage'))
    assert.equal(await readFile(connectApplicationsPath(f.home), 'utf8'), manifest)
    assert.equal(await f.store.readSecret(application.id), 'fake-old')
    assert.deepEqual(await f.store.read(), manager)
    assert.equal((await readdir(join(f.home, 'cc-connect', 'credentials'))).length, 1)
  } finally { await f.close() }
})

test('replacement and removal cleanup survive a failed final manifest write and retry after reopening', async () => {
  const f = await fixture()
  try {
    const first = await f.store.save({ name: 'First', appId: 'cli_first', workspace: f.home, appSecret: 'fake-first' })
    const second = await f.store.save({ name: 'Second', appId: 'cli_second', workspace: f.home, appSecret: 'fake-second' })
    let writes = 0
    const interrupted = new ConnectApplicationStore(f.home, { storage: f.adapter, write: async (...args) => {
      if (++writes === 2) throw new Error('cleanup interruption')
      await atomicWriteFile(...args)
    } })
    await assert.rejects(interrupted.save({ id: first.id, name: 'Updated', appId: first.appId, workspace: f.home, appSecret: 'fake-updated' }), reason('storage'))
    const dirty = JSON.parse(await readFile(connectApplicationsPath(f.home), 'utf8'))
    assert.equal(dirty.credentialCleanup.length, 1)
    assert.equal(await f.store.readSecret(first.id), 'fake-updated')
    assert.equal(JSON.parse(await readFile(connectApplicationsPath(f.home), 'utf8')).credentialCleanup.length, 0)
    writes = 0
    await assert.rejects(interrupted.remove(second.id), reason('storage'))
    assert.equal(JSON.parse(await readFile(connectApplicationsPath(f.home), 'utf8')).credentialCleanup.length, 1)
    const reopened = new ConnectApplicationStore(f.home, { storage: f.adapter })
    assert.deepEqual((await reopened.read()).applications.map(item => item.id), [first.id])
    assert.equal(await reopened.readSecret(first.id), 'fake-updated')
    await assert.rejects(reopened.readSecret(second.id), reason('not-found'))
    assert.equal((await readdir(join(f.home, 'cc-connect', 'credentials'))).length, 1)
  } finally { await f.close() }
})

test('selection and explicit close persist; removal targets only one local record and refuses enabled selection', async () => {
  const f = await fixture()
  try {
    const first = await f.store.save({ name: 'First', appId: 'cli_first', workspace: f.home, appSecret: 'fake-first' })
    const second = await f.store.save({ name: 'Second', appId: 'cli_second', workspace: f.home, appSecret: 'fake-second' })
    await f.store.select(second.id)
    await f.store.setIntent({ enabled: true, autoConnect: false })
    await assert.rejects(f.store.remove(second.id), reason('active-application'))
    await f.store.setIntent({ enabled: false, autoConnect: false })
    const before = await f.store.read()
    const fail = new ConnectApplicationStore(f.home, { storage: f.adapter, write: async () => { throw new Error('write refused') } })
    await assert.rejects(fail.remove(second.id), reason('storage'))
    assert.deepEqual(await f.store.read(), before)
    assert.equal(await f.store.readSecret(second.id), 'fake-second')
    await f.store.remove(second.id)
    const reopened = await new ConnectApplicationStore(f.home, { storage: f.adapter }).read()
    assert.equal(reopened.enabled, false); assert.equal(reopened.autoConnect, false)
    assert.equal(reopened.activeApplicationId, null, 'no implicit switch/start on removal')
    assert.deepEqual(reopened.applications.map(item => item.id), [first.id])
    assert.equal(await f.store.readSecret(first.id), 'fake-first')
    await assert.rejects(f.store.select(second.id), reason('not-found'))
    await assert.rejects(f.store.remove(second.id), reason('not-found'))
    assert.equal((await stat(f.home)).isDirectory(), true, 'workspace is untouched')
  } finally { await f.close() }
})

test('concurrent stores serialize additions and duplicate updates without lost records', async () => {
  const f = await fixture()
  try {
    await f.store.read()
    const stores = Array.from({ length: 12 }, () => new ConnectApplicationStore(f.home, { storage: f.adapter }))
    await Promise.all(stores.map((store, index) => store.save({ name: `App ${index}`, appId: `cli_${index}`, workspace: f.home, appSecret: `fake-${index}` })))
    assert.equal((await f.store.read()).applications.length, 12)
    const duplicate = await Promise.all(stores.slice(0, 4).map((store, index) => store.save({ name: `Same ${index}`, appId: 'cli_same', workspace: f.home, appSecret: 'fake-same' })))
    assert.equal(new Set(duplicate.map(item => item.id)).size, 1)
    assert.equal((await f.store.read()).applications.length, 13)
    for (const app of (await f.store.read()).applications) assert.equal(await f.store.readSecret(app.id), app.appId === 'cli_same' ? 'fake-same' : app.appId.replace('cli_', 'fake-'))
  } finally { await f.close() }
})

test('reopen cleans only unreferenced managed credential revisions left by an unclean exit', async () => {
  const f = await fixture()
  try {
    const application = await f.store.save({ name: 'Kept', appId: 'cli_kept', workspace: f.home, appSecret: 'fake-kept' })
    const orphan = credentialsPath(f.home, randomUUID())
    await new ConnectCredentials(orphan, f.adapter).setSecret('fake-uncommitted')
    const unmanaged = join(f.home, 'cc-connect', 'credentials', 'user-note.json')
    await atomicWriteFile(unmanaged, 'not a managed credential')
    const store = new ConnectApplicationStore(f.home, { storage: f.adapter })
    assert.equal((await store.read()).applications.length, 1)
    assert.equal(await store.readSecret(application.id), 'fake-kept')
    await assert.rejects(stat(orphan), { code: 'ENOENT' })
    assert.equal(await readFile(unmanaged, 'utf8'), 'not a managed credential')
  } finally { await f.close() }
})

test('malformed documents and invalid fields fail closed without rewriting or exposing credentials', async () => {
  const f = await fixture()
  try {
    for (const input of [null, [], {}, { name: ' ', appId: 'id', workspace: '' },
      { name: 'x', appId: 'id', workspace: '', id: '../../escape' }, { name: 'x', appId: '', workspace: '' },
      ...[{ detail: 'invalid' }, { cardMode: 'invalid' }, { progressStyle: 'invalid' }, { showStreamPreview: 1 }, { streamPreviewIntervalMs: Infinity }, { streamPreviewIntervalMs: 1.5 }, { appSecret: 1 }].map(fields => ({ name: 'x', appId: 'id', workspace: '', ...fields }))]) {
      assert.equal(parseConnectApplicationInput(input), undefined)
      await assert.rejects(f.store.save(input), reason('invalid-input'))
    }
    assert.throws(() => credentialsPath(f.home, '../../escape'), /invalid credential identity/)
    await mkdir(join(f.home, 'cc-connect'), { recursive: true })
    const invalid = '{"fake-secret-in-malformed-json":'
    await atomicWriteFile(connectApplicationsPath(f.home), invalid)
    await assert.rejects(f.store.read(), error => { assert.ok(reason('storage')(error)); assert.doesNotMatch(String(error), /fake-secret/); return true })
    assert.equal(await readFile(connectApplicationsPath(f.home), 'utf8'), invalid)
    for (const document of [
      { version: 3 }, { version: 2, enabled: false, autoConnect: false, applications: [], activeApplicationId: null, credentials: {}, credentialCleanup: ['../../escape'] },
      { version: 2, enabled: false, autoConnect: false, applications: [], activeApplicationId: 'unknown', credentials: {}, credentialCleanup: [] },
    ]) {
      const text = JSON.stringify(document)
      await atomicWriteFile(connectApplicationsPath(f.home), text)
      await assert.rejects(f.store.read(), reason('storage'))
      assert.equal(await readFile(connectApplicationsPath(f.home), 'utf8'), text)
    }
  } finally { await f.close() }
})
