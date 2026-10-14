import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, rm, stat } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConnectCredentials, CredentialNeedsReentryError, credentialsPath } from '../src/main/cc-connect-credentials.ts'
import { atomicWriteFile } from '../src/main/config-file.ts'

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'cc-connect-credentials-test-'))
}

function fakeSafeStorage(available: boolean) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`, 'utf8'),
    decryptString: (value: Buffer) => value.toString('utf8').replace(/^encrypted:/, ''),
  }
}

test('Windows retains protected credentials without writing the secret in plaintext', async () => {
  const userData = await tempDir()
  const secret = 'fake-feishu-secret'
  try {
    const credentials = new ConnectCredentials(credentialsPath(userData), fakeSafeStorage(true), 'win32')
    assert.equal(await credentials.setSecret(secret), 'safeStorage')
    assert.deepEqual(await credentials.state(), { secretConfigured: true, credentialProtection: 'safeStorage' })
    assert.equal(await credentials.readSecret(), secret)
    assert.doesNotMatch(await readFile(credentialsPath(userData), 'utf8'), new RegExp(secret))
    await credentials.clearSecret()
    assert.deepEqual(await credentials.state(), { secretConfigured: false, credentialProtection: 'none' })
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})
test('unavailable safeStorage falls back to a 0600 local credential file', async () => {
  const userData = await tempDir()
  try {
    const credentials = new ConnectCredentials(credentialsPath(userData), fakeSafeStorage(false))
    assert.equal(await credentials.setSecret('fake-file-secret'), 'file')
    assert.deepEqual(await credentials.state(), { secretConfigured: true, credentialProtection: 'file' })
    assert.equal(await credentials.readSecret(), 'fake-file-secret')
    assert.equal((await stat(credentialsPath(userData))).mode & 0o777, 0o600)
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})

test('credential errors redact the supplied Secret', async () => {
  const userData = await tempDir()
  const secret = 'fake-error-secret'
  try {
    const storage = {
      ...fakeSafeStorage(true),
      encryptString: () => { throw new Error(`provider rejected ${secret}`) },
    }
    const credentials = new ConnectCredentials(credentialsPath(userData), storage, 'win32')
    await assert.rejects(credentials.setSecret(secret), error => {
      assert.ok(error instanceof Error)
      assert.doesNotMatch(error.message, new RegExp(secret))
      assert.match(error.message, /credential storage failed/)
      return true
    })
  } finally {
    await rm(userData, { recursive: true, force: true })
  }
})

test('malformed documents and decrypt-provider errors cannot echo fallback Secrets', async () => {
  const userData = await tempDir()
  const secret = 'fake-malformed-secret'
  try {
    const path = credentialsPath(userData)
    await atomicWriteFile(path, `{"value":"${secret}"`)
    const credentials = new ConnectCredentials(path, fakeSafeStorage(true), 'win32')
    await assert.rejects(credentials.state(), error => {
      assert.doesNotMatch(String(error), new RegExp(secret))
      assert.match(String(error), /malformed/)
      return true
    })
    await credentials.setSecret(secret)
    const broken = new ConnectCredentials(path, { ...fakeSafeStorage(true), decryptString: () => { throw new Error(secret) } }, 'win32')
    await assert.rejects(broken.readSecret(), error => {
      assert.doesNotMatch(String(error), new RegExp(secret))
      assert.match(String(error), /decryption is unavailable/)
      return true
    })
  } finally { await rm(userData, { recursive: true, force: true }) }
})

test('macOS file credentials and retained legacy documents never probe, encrypt or decrypt through safeStorage', async () => {
  const userData = await tempDir()
  let calls = 0
  const deny = () => { calls++; throw new Error('must not access system storage') }
  try {
    const path = credentialsPath(userData)
    const credentials = new ConnectCredentials(path, { isEncryptionAvailable: deny, encryptString: deny, decryptString: deny }, 'darwin')
    assert.equal(await credentials.setSecret('fake-mac-secret'), 'file')
    assert.equal(await credentials.readSecret(), 'fake-mac-secret')
    assert.deepEqual(await credentials.state(), { secretConfigured: true, credentialProtection: 'file' })
    assert.equal((await stat(path)).mode & 0o777, 0o600)
    const legacy = JSON.stringify({ version: 1, protection: 'safeStorage', value: 'ZmFrZS1jaXBoZXJ0ZXh0' }) + '\n'
    await atomicWriteFile(path, legacy, 0o600)
    assert.deepEqual(await credentials.state(), { secretConfigured: false, credentialProtection: 'safeStorage', needsSecretReentry: true })
    await assert.rejects(credentials.readSecret(), CredentialNeedsReentryError)
    const copy = join(userData, 'copy.json')
    assert.equal(await credentials.copyTo(copy), true)
    assert.equal(await readFile(copy, 'utf8'), legacy)
    assert.equal(await readFile(path, 'utf8'), legacy, 'legacy bytes are retained until explicit replacement')
    assert.equal(await credentials.setSecret('fake-reentered-secret'), 'file')
    assert.equal(await credentials.readSecret(), 'fake-reentered-secret')
    assert.deepEqual(await credentials.state(), { secretConfigured: true, credentialProtection: 'file' })
    assert.equal(calls, 0)
  } finally { await rm(userData, { recursive: true, force: true }) }
})
