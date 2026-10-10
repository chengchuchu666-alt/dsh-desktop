/** Main-only application store. Credentials are immutable revisions; an atomic
 * manifest commit selects one. Failed saves therefore cannot overwrite a live Secret. */
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { atomicWriteFile, jsonCodec, withFileLock } from './config-file.ts'
import { connectApplicationsPath, connectSettingsPath, isConnectRecordId, normalizeConnectSettings } from './cc-connect-config.ts'
import { ConnectCredentials, credentialsPath, type SafeStorageAdapter } from './cc-connect-credentials.ts'
import type { ConnectApplication, ConnectApplicationInput, ConnectApplicationState, ConnectIntent, ConnectManagerSettings } from './cc-connect-types.ts'

interface ApplicationDocument extends ConnectManagerSettings {
  credentials: Record<string, string>
  /** Durable cleanup queue: retry on next operation if removal/write fails. */
  credentialCleanup: string[]
}

export class ConnectApplicationError extends Error {
  readonly reason: 'invalid-input' | 'not-found' | 'duplicate-app-id' | 'active-application' | 'storage'
  constructor(reason: ConnectApplicationError['reason']) {
    super(`connection application: ${reason}`)
    this.reason = reason
  }
}

function normalizeApplication(value: Record<string, unknown>): ConnectApplication {
  const { enabled: _enabled, ...settings } = normalizeConnectSettings(value)
  return { ...settings, id: value.id as string, name: value.name as string }
}

function parseDocument(raw: unknown): ApplicationDocument {
  if (typeof raw !== 'object' || raw === null) throw new ConnectApplicationError('storage')
  const value = raw as Record<string, unknown>
  if (value.version !== 2 || typeof value.enabled !== 'boolean' || typeof value.autoConnect !== 'boolean'
    || !Array.isArray(value.applications) || typeof value.credentials !== 'object' || value.credentials === null
    || Array.isArray(value.credentials) || !Array.isArray(value.credentialCleanup)) throw new ConnectApplicationError('storage')
  const applications: ConnectApplication[] = []
  for (const rawApplication of value.applications) {
    if (typeof rawApplication !== 'object' || rawApplication === null) throw new ConnectApplicationError('storage')
    const application = rawApplication as Record<string, unknown>
    if (!isConnectRecordId(application.id) || typeof application.name !== 'string' || application.name.trim() === ''
      || typeof application.appId !== 'string' || application.appId.trim() === '' || typeof application.workspace !== 'string') throw new ConnectApplicationError('storage')
    if (applications.some(item => item.id === application.id || item.appId === application.appId)) throw new ConnectApplicationError('storage')
    applications.push(normalizeApplication(application))
  }
  if (value.activeApplicationId !== null && !applications.some(item => item.id === value.activeApplicationId)) throw new ConnectApplicationError('storage')
  const credentials: Record<string, string> = {}
  for (const [id, credentialId] of Object.entries(value.credentials)) {
    if (!applications.some(item => item.id === id) || !isConnectRecordId(credentialId)
      || Object.values(credentials).includes(credentialId)) throw new ConnectApplicationError('storage')
    credentials[id] = credentialId
  }
  const credentialCleanup: string[] = []
  for (const id of value.credentialCleanup) {
    if ((id !== 'legacy' && !isConnectRecordId(id)) || Object.values(credentials).includes(id)) throw new ConnectApplicationError('storage')
    if (!credentialCleanup.includes(id)) credentialCleanup.push(id)
  }
  return { version: 2, enabled: value.enabled, autoConnect: value.autoConnect, applications,
    activeApplicationId: value.activeApplicationId as string | null, credentials, credentialCleanup }
}

/** Bounded input, no user-selected paths for credential files or arbitrary TOML. */
export function parseConnectApplicationInput(raw: unknown): ConnectApplicationInput | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const value = raw as Record<string, unknown>
  if ((value.id !== undefined && !isConnectRecordId(value.id)) || typeof value.name !== 'string' || value.name.trim() === '' || value.name.length > 120
    || typeof value.appId !== 'string' || value.appId.trim() === '' || value.appId.length > 200
    || typeof value.workspace !== 'string' || (value.appSecret !== undefined && typeof value.appSecret !== 'string')) return undefined
  if (value.detail !== undefined && !['full', 'compact', 'quiet'].includes(value.detail as string)) return undefined
  if (value.cardMode !== undefined && !['legacy', 'rich'].includes(value.cardMode as string)) return undefined
  if (value.progressStyle !== undefined && !['legacy', 'compact', 'card'].includes(value.progressStyle as string)) return undefined
  if (value.showStreamPreview !== undefined && typeof value.showStreamPreview !== 'boolean') return undefined
  if (value.streamPreviewIntervalMs !== undefined && (typeof value.streamPreviewIntervalMs !== 'number'
    || !Number.isFinite(value.streamPreviewIntervalMs) || !Number.isInteger(value.streamPreviewIntervalMs))) return undefined
  const input: ConnectApplicationInput = { name: value.name.trim(), appId: value.appId.trim(), workspace: value.workspace }
  if (value.id !== undefined) input.id = value.id as string
  if (value.appSecret !== undefined) input.appSecret = value.appSecret as string
  for (const key of ['detail', 'cardMode', 'progressStyle', 'showStreamPreview', 'streamPreviewIntervalMs'] as const) {
    if (value[key] !== undefined) Object.assign(input, { [key]: value[key] })
  }
  return input
}

export class ConnectApplicationStore {
  private readonly userData: string
  private readonly storage: SafeStorageAdapter | undefined
  private readonly write: typeof atomicWriteFile

  constructor(userData: string, options: { storage?: SafeStorageAdapter; write?: typeof atomicWriteFile } = {}) {
    this.userData = userData
    this.storage = options.storage
    this.write = options.write ?? atomicWriteFile
  }

  private credential(id?: string): ConnectCredentials {
    return new ConnectCredentials(credentialsPath(this.userData, id === 'legacy' ? undefined : id), this.storage)
  }

  private commit(document: ApplicationDocument): Promise<void> {
    return this.write(connectApplicationsPath(this.userData), jsonCodec.stringify(document), 0o600)
  }

  private async cleanup(document: ApplicationDocument): Promise<void> {
    if (document.credentialCleanup.length > 0) {
      for (const id of document.credentialCleanup) await this.credential(id).clearSecret()
      document.credentialCleanup = []
      await this.commit(document)
    }
    // An unclean exit between staging and manifest commit can leave an orphan.
    // All operations hold the same lock, so no live writer's staging is swept.
    const directory = join(this.userData, 'cc-connect', 'credentials')
    let entries: string[]
    try { entries = await readdir(directory) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    for (const name of entries) {
      const id = name.endsWith('.json') ? name.slice(0, -5) : ''
      if (isConnectRecordId(id) && !Object.values(document.credentials).includes(id)) await this.credential(id).clearSecret()
    }
  }

  private async load(): Promise<ApplicationDocument> {
    let raw: string
    try { raw = await readFile(connectApplicationsPath(this.userData), 'utf8') } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      return this.migrate()
    }
    const document = parseDocument(JSON.parse(raw) as unknown)
    await this.cleanup(document)
    return document
  }

  private async migrate(): Promise<ApplicationDocument> {
    let raw: unknown = {}
    try { raw = JSON.parse(await readFile(connectSettingsPath(this.userData), 'utf8')) as unknown } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new ConnectApplicationError('storage')
    const legacy = raw as Record<string, unknown>
    if ((legacy.enabled !== undefined && typeof legacy.enabled !== 'boolean')
      || (legacy.appId !== undefined && typeof legacy.appId !== 'string')
      || (legacy.workspace !== undefined && typeof legacy.workspace !== 'string')) throw new ConnectApplicationError('storage')
    const settings = normalizeConnectSettings(raw)
    const document: ApplicationDocument = { version: 2, enabled: settings.enabled, autoConnect: settings.enabled,
      activeApplicationId: null, applications: [], credentials: {}, credentialCleanup: [] }
    let staged: string | undefined
    if (settings.appId.trim() !== '') {
      const id = randomUUID()
      document.applications.push(normalizeApplication({ ...settings, appId: settings.appId.trim(), id, name: 'Feishu' }))
      document.activeApplicationId = id
      staged = randomUUID()
      if (await this.credential().copyTo(credentialsPath(this.userData, staged))) {
        document.credentials[id] = staged
        document.credentialCleanup.push('legacy')
      } else staged = undefined
    }
    try { await this.commit(document) } catch (error) {
      if (staged !== undefined) await this.credential(staged).clearSecret()
      throw error
    }
    await this.cleanup(document)
    return document
  }

  private async locked<T>(operation: (document: ApplicationDocument) => Promise<T>): Promise<T> {
    try {
      return await withFileLock(`${connectApplicationsPath(this.userData)}.lock`, async () => operation(await this.load()), { timeoutMs: 10_000 })
    } catch (error) {
      if (error instanceof ConnectApplicationError) throw error
      // Do not propagate filesystem, parse, encryption or input text into UI/logs.
      throw new ConnectApplicationError('storage')
    }
  }

  async read(): Promise<ConnectManagerSettings> {
    return this.locked(async document => {
      const { credentials: _credentials, credentialCleanup: _cleanup, ...settings } = document
      return settings
    })
  }

  async applications(): Promise<ConnectApplicationState[]> {
    return this.locked(async document => Promise.all(document.applications.map(async application => {
      const credentialId = document.credentials[application.id]
      const state = credentialId === undefined
        ? { secretConfigured: false, credentialProtection: 'none' as const }
        : await this.credential(credentialId).state()
      return { ...application, ...state }
    })))
  }

  async readSecret(id: string): Promise<string | undefined> {
    return this.locked(async document => {
      if (!document.applications.some(item => item.id === id)) throw new ConnectApplicationError('not-found')
      const credentialId = document.credentials[id]
      return credentialId === undefined ? undefined : this.credential(credentialId).readSecret()
    })
  }

  async save(raw: unknown): Promise<ConnectApplication> {
    const input = parseConnectApplicationInput(raw)
    if (input === undefined) throw new ConnectApplicationError('invalid-input')
    return this.locked(async document => {
      const matching = document.applications.find(item => item.appId === input.appId)
      const previous = input.id === undefined ? matching : document.applications.find(item => item.id === input.id)
      if (input.id !== undefined && previous === undefined) throw new ConnectApplicationError('not-found')
      if (matching !== undefined && previous !== undefined && matching.id !== previous.id) throw new ConnectApplicationError('duplicate-app-id')
      // Retaining a Secret while changing App ID could authenticate the wrong robot.
      if (previous !== undefined && previous.appId !== input.appId && !input.appSecret) throw new ConnectApplicationError('invalid-input')
      const application = normalizeApplication({ ...previous, ...input, id: previous?.id ?? randomUUID() })
      const next = structuredClone(document)
      const index = next.applications.findIndex(item => item.id === application.id)
      if (index < 0) next.applications.push(application)
      else next.applications[index] = application
      if (next.activeApplicationId === null) next.activeApplicationId = application.id
      let staged: string | undefined
      if (input.appSecret) {
        staged = randomUUID()
        await this.credential(staged).setSecret(input.appSecret)
        const previousCredential = next.credentials[application.id]
        if (previousCredential !== undefined) next.credentialCleanup.push(previousCredential)
        next.credentials[application.id] = staged
      }
      try { await this.commit(next) } catch (error) {
        if (staged !== undefined) await this.credential(staged).clearSecret()
        throw error
      }
      await this.cleanup(next)
      return application
    })
  }

  async setIntent(intent: ConnectIntent): Promise<void> {
    if (typeof intent.enabled !== 'boolean' || typeof intent.autoConnect !== 'boolean') throw new ConnectApplicationError('invalid-input')
    await this.locked(async document => { await this.commit({ ...document, enabled: intent.enabled, autoConnect: intent.autoConnect }) })
  }

  /** Lifecycle owner must stop the previous process before changing selection. */
  async select(id: string): Promise<void> {
    await this.locked(async document => {
      if (!document.applications.some(item => item.id === id)) throw new ConnectApplicationError('not-found')
      await this.commit({ ...document, activeApplicationId: id })
    })
  }

  /** Main must also verify that no live process owns this record before removal. */
  async remove(id: string): Promise<void> {
    await this.locked(async document => {
      if (!document.applications.some(item => item.id === id)) throw new ConnectApplicationError('not-found')
      if (document.activeApplicationId === id && document.enabled) throw new ConnectApplicationError('active-application')
      const next = structuredClone(document)
      next.applications = next.applications.filter(item => item.id !== id)
      if (next.activeApplicationId === id) next.activeApplicationId = null
      const credentialId = next.credentials[id]
      if (credentialId !== undefined) next.credentialCleanup.push(credentialId)
      delete next.credentials[id]
      await this.commit(next)
      await this.cleanup(next)
    })
  }
}
