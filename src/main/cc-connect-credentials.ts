/** Main-process-only storage for the Feishu app secret. */
import * as electron from 'electron'
import { readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { atomicWriteFile } from './config-file.ts'
import { connectDirectory, isConnectRecordId } from './cc-connect-config.ts'

export type CredentialProtection = 'none' | 'safeStorage' | 'file'

export interface CredentialState {
  secretConfigured: boolean
  credentialProtection: CredentialProtection
  needsSecretReentry?: boolean
}

/** A legacy macOS credential is retained, but never decrypted implicitly. */
export class CredentialNeedsReentryError extends Error {
  constructor() { super('credential requires App Secret re-entry') }
}

export interface SafeStorageAdapter {
  isEncryptionAvailable(): boolean
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}

interface CredentialDocument {
  version: 1
  protection: Exclude<CredentialProtection, 'none'>
  value: string
}

const electronStorage: SafeStorageAdapter = {
  isEncryptionAvailable: () => electron.safeStorage.isEncryptionAvailable(),
  encryptString: value => electron.safeStorage.encryptString(value),
  decryptString: value => electron.safeStorage.decryptString(value),
}

export function credentialsPath(userData: string, credentialId?: string): string {
  if (credentialId === undefined) return join(connectDirectory(userData), 'credentials.json')
  if (!isConnectRecordId(credentialId)) throw new Error('invalid credential identity')
  return join(connectDirectory(userData), 'credentials', `${credentialId}.json`)
}

function redactError(error: unknown, secret = ''): Error {
  const raw = error instanceof Error ? error.message : String(error)
  const message = secret === '' ? raw : raw.split(secret).join('[REDACTED]')
  return new Error(`credential storage failed: ${message}`)
}

function isCredentialDocument(value: unknown): value is CredentialDocument {
  if (typeof value !== 'object' || value === null) return false
  const document = value as Partial<CredentialDocument>
  return document.version === 1
    && (document.protection === 'safeStorage' || document.protection === 'file')
    && typeof document.value === 'string'
    && document.value !== ''
}

export class ConnectCredentials {
  private readonly path: string
  private readonly storage: SafeStorageAdapter
  private readonly platform: NodeJS.Platform

  constructor(path: string, storage: SafeStorageAdapter = electronStorage, platform: NodeJS.Platform = process.platform) {
    this.path = path
    this.storage = storage
    this.platform = platform
  }

  private encryptionAvailable(): boolean {
    try {
      return this.storage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  private async readDocument(): Promise<CredentialDocument | undefined> {
    let raw: string
    try {
      raw = await readFile(this.path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw redactError(error)
    }
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!isCredentialDocument(parsed)) throw new Error('credential document is malformed')
      return parsed
    } catch {
      // JSON parse errors can quote the document, including a fallback Secret.
      throw redactError(new Error('credential document is malformed'))
    }
  }

  async state(): Promise<CredentialState> {
    const document = await this.readDocument()
    if (document === undefined) return { secretConfigured: false, credentialProtection: 'none' }
    if (this.platform === 'darwin' && document.protection === 'safeStorage') {
      return { secretConfigured: false, credentialProtection: 'safeStorage', needsSecretReentry: true }
    }
    return { secretConfigured: true, credentialProtection: document.protection }
  }

  async readSecret(): Promise<string | undefined> {
    const document = await this.readDocument()
    if (document === undefined) return undefined
    if (document.protection === 'file') return document.value
    if (this.platform === 'darwin') throw new CredentialNeedsReentryError()
    if (!this.encryptionAvailable()) throw redactError(new Error('safeStorage is unavailable'))
    try {
      return this.storage.decryptString(Buffer.from(document.value, 'base64'))
    } catch {
      throw redactError(new Error('credential decryption is unavailable'))
    }
  }

  /** Copy an already protected document without decrypting or downgrading it.
   * Used only by main-process migration; the original is retained until commit. */
  async copyTo(path: string): Promise<boolean> {
    const document = await this.readDocument()
    if (document === undefined) return false
    await atomicWriteFile(path, `${JSON.stringify(document)}\n`, 0o600)
    return true
  }

  async setSecret(secret: string): Promise<CredentialProtection> {
    if (secret === '') {
      await this.clearSecret()
      return 'none'
    }
    // macOS ad-hoc updates change the keychain identity. Never even probe
    // safeStorage there; Windows keeps DPAPI and Linux keeps its existing backend.
    const protection: Exclude<CredentialProtection, 'none'> = this.platform !== 'darwin' && this.encryptionAvailable() ? 'safeStorage' : 'file'
    let value: string
    try {
      value = protection === 'safeStorage'
        ? this.storage.encryptString(secret).toString('base64')
        : secret
    } catch (error) {
      throw redactError(error, secret)
    }
    try {
      await atomicWriteFile(this.path, `${JSON.stringify({ version: 1, protection, value })}\n`, 0o600)
    } catch (error) {
      throw redactError(error, secret)
    }
    return protection
  }

  async clearSecret(): Promise<void> {
    try {
      await unlink(this.path)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw redactError(error)
    }
  }
}
