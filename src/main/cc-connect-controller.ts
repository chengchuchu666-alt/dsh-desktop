/** One lifecycle authority for every Desktop entry point. All mutations queue;
 * failed stop retains the process owner, so another application cannot spawn. */
import { normalizeConnectSettings } from './cc-connect-config.ts'
import { ConnectApplicationStore, ConnectApplicationError, parseConnectApplicationInput } from './cc-connect-applications.ts'
import { CredentialNeedsReentryError } from './cc-connect-credentials.ts'
import { shouldStartConnect, type ConnectStartReason } from './cc-connect-policy.ts'
import type { ConnectState as RuntimeState } from './cc-connect-supervisor.ts'
import type { ConnectApplication, ConnectHealth, ConnectManagerState, ConnectSettingsInput } from './cc-connect-types.ts'

export interface ConnectProcess {
  start(): Promise<boolean>
  stop(): Promise<void>
}

export interface ConnectControllerOptions {
  store: ConnectApplicationStore
  environment(): { safeMode: boolean; harnessReady: boolean }
  validWorkspace(workspace: string): Promise<boolean>
  createProcess(application: ConnectApplication, secret: string, events: {
    onState(state: RuntimeState): void
    onHealth(health: ConnectHealth): void
  }): Promise<ConnectProcess>
}

export class ConnectOperationError extends Error {
  readonly reason: 'invalid-input' | 'invalid-workspace' | 'storage' | 'stop-failed'
  constructor(reason: ConnectOperationError['reason']) { super(`connection operation: ${reason}`); this.reason = reason }
}

export class ConnectController {
  private readonly options: ConnectControllerOptions
  private queue: Promise<void> = Promise.resolve()
  private process: ConnectProcess | undefined
  private processApplicationId: string | undefined
  private generation = 0
  private runtime: RuntimeState = { phase: 'stopped' }
  private health: ConnectHealth = { channel: 'unknown', dsh: 'unknown' }

  constructor(options: ConnectControllerOptions) { this.options = options }
  get hasProcess(): boolean { return this.process !== undefined }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.queue.then(operation)
    this.queue = task.then(() => {}, () => {})
    return task
  }

  async state(): Promise<ConnectManagerState> {
    const settings = await this.options.store.snapshot()
    const applications = settings.applications
    const selected = applications.find(item => item.id === settings.activeApplicationId)
    const phase = this.process !== undefined ? this.runtime.phase
      : !settings.enabled ? 'disabled' : this.runtime.phase === 'crashed' ? 'crashed' : 'stopped'
    const connection = {
      ...normalizeConnectSettings(selected), enabled: settings.enabled,
      phase, secretConfigured: selected?.secretConfigured ?? false,
      credentialProtection: selected?.credentialProtection ?? 'none',
      ...(selected?.needsSecretReentry === true ? { needsSecretReentry: true } : {}),
      autoConnect: settings.autoConnect, applicationId: settings.activeApplicationId, health: { ...this.health },
      ...('lastError' in this.runtime && this.runtime.lastError !== undefined ? { lastError: this.runtime.lastError } : {}),
      ...('restartAttempts' in this.runtime ? { restartAttempts: this.runtime.restartAttempts } : {}),
    }
    return { applications, activeApplicationId: settings.activeApplicationId,
      enabled: settings.enabled, autoConnect: settings.autoConnect, connection, health: { ...this.health } }
  }

  private async stop(): Promise<void> {
    if (this.process === undefined) {
      this.runtime = { phase: 'stopped' }
      this.health = { channel: 'offline', dsh: 'unknown' }
      return
    }
    try { await this.process.stop() } catch {
      this.health = { ...this.health, errorCode: 'stop-failed' }
      this.runtime = { phase: 'degraded', restartAttempts: 0, retryDelayMs: 0, lastError: 'cc-connect stop failed' }
      throw new ConnectOperationError('stop-failed')
    }
    this.generation++
    this.process = undefined
    this.processApplicationId = undefined
    this.runtime = { phase: 'stopped' }
    this.health = { channel: 'offline', dsh: 'unknown' }
  }

  private async startEligible(reason: ConnectStartReason): Promise<boolean> {
    const settings = await this.options.store.read()
    if (!shouldStartConnect(settings, reason, this.options.environment())) return false
    if (this.process !== undefined && this.processApplicationId === settings.activeApplicationId && this.runtime.phase === 'ready') return true
    // Never replace an existing process slot, including an unready/failed-stop owner.
    await this.stop()
    const application = settings.applications.find(item => item.id === settings.activeApplicationId)
    if (application === undefined) { this.health.errorCode = 'credentials'; return false }
    if (!await this.options.validWorkspace(application.workspace)) { this.health.errorCode = 'workspace'; return false }
    let secret: string | undefined
    try { secret = await this.options.store.readSecret(application.id) } catch (error) {
      this.health.errorCode = error instanceof CredentialNeedsReentryError ? 'credentials' : 'storage'
      return false
    }
    if (!secret) { this.health.errorCode = 'credentials'; return false }
    const generation = ++this.generation
    this.health = { channel: 'unknown', dsh: 'unknown' }
    try {
      this.process = await this.options.createProcess(application, secret, {
        onState: state => { if (generation === this.generation) this.runtime = state },
        onHealth: health => { if (generation === this.generation) this.health = { ...health } },
      })
      this.processApplicationId = application.id
      if (await this.process.start()) return true
    } catch {
      this.runtime = { phase: 'crashed', restartAttempts: 0, lastError: 'cc-connect could not start', logTail: '' }
      this.health = { ...this.health, errorCode: 'sidecar' }
    }
    const failed = this.runtime
    await this.stop()
    this.runtime = failed
    this.health.errorCode = 'sidecar'
    return false
  }

  start(reason: ConnectStartReason = 'manual', id?: string): Promise<boolean> {
    return this.serial(async () => {
      const settings = await this.options.store.read()
      if (id !== undefined && id !== settings.activeApplicationId) {
        if (!settings.applications.some(item => item.id === id)) throw new ConnectOperationError('invalid-input')
        await this.stop()
        await this.options.store.select(id)
      }
      if (reason === 'manual') {
        await this.options.store.setIntent({ enabled: true, autoConnect: settings.autoConnect })
      } else if (reason === 'restart') await this.stop()
      return this.startEligible(reason)
    })
  }

  /** Explicit close persists first, so restart/Safe Mode exit cannot resurrect it. */
  close(): Promise<void> {
    return this.serial(async () => {
      const settings = await this.options.store.read()
      await this.options.store.setIntent({ enabled: false, autoConnect: settings.autoConnect })
      await this.stop()
    })
  }

  /** Safe Mode, kernel shutdown and quit pause without changing saved intent. */
  pause(): Promise<void> { return this.serial(() => this.stop()) }

  setAutoConnect(autoConnect: boolean): Promise<void> {
    return this.serial(async () => {
      if (typeof autoConnect !== 'boolean') throw new ConnectOperationError('invalid-input')
      const settings = await this.options.store.read()
      await this.options.store.setIntent({ enabled: settings.enabled, autoConnect })
    })
  }

  private async validateApplication(raw: unknown): Promise<NonNullable<ReturnType<typeof parseConnectApplicationInput>>> {
    const input = parseConnectApplicationInput(raw)
    if (input === undefined) throw new ConnectOperationError('invalid-input')
    if (!await this.options.validWorkspace(input.workspace)) throw new ConnectOperationError('invalid-workspace')
    return input
  }

  saveApplication(raw: unknown): Promise<ConnectApplication> {
    return this.serial(async () => {
      const input = await this.validateApplication(raw)
      const settings = await this.options.store.read()
      const id = input.id ?? settings.applications.find(item => item.appId === input.appId)?.id
      const running = this.process !== undefined && this.processApplicationId === id
      if (running) await this.stop()
      const application = await this.options.store.save(input)
      if (running) await this.startEligible('restart')
      return application
    })
  }

  /** Compatibility bridge for the old settings form, scoped to its selected app.
   * A different App ID must use the manager, not silently replace a live robot. */
  saveLegacy(input: ConnectSettingsInput): Promise<void> {
    return this.serial(async () => {
      const settings = await this.options.store.read()
      const selected = settings.applications.find(item => item.id === settings.activeApplicationId)
      if (selected !== undefined && input.appId !== selected.appId) throw new ConnectOperationError('invalid-input')
      if (input.appId.trim() !== '') await this.validateApplication({ ...input, name: selected?.name ?? 'Feishu' })
      else if (input.enabled) throw new ConnectOperationError('invalid-input')
      const running = this.process !== undefined
      if (!input.enabled) await this.options.store.setIntent({ enabled: false, autoConnect: settings.autoConnect })
      if (running) await this.stop()
      if (input.appId.trim() !== '') await this.options.store.save({ ...input, name: selected?.name ?? 'Feishu', ...(selected === undefined ? {} : { id: selected.id }) })
      await this.options.store.setIntent({ enabled: input.enabled, autoConnect: selected === undefined && input.enabled ? true : settings.autoConnect })
      if (input.enabled && running) await this.startEligible('restart')
    })
  }

  remove(id: string): Promise<void> {
    return this.serial(async () => {
      const settings = await this.options.store.read()
      if (!settings.applications.some(item => item.id === id)) throw new ConnectApplicationError('not-found')
      if (settings.activeApplicationId === id) {
        await this.options.store.setIntent({ enabled: false, autoConnect: settings.autoConnect })
        await this.stop()
      }
      await this.options.store.remove(id)
    })
  }
}
