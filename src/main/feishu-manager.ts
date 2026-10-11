/** QR creation and application actions share the existing lifecycle authority.
 * Only bounded public state leaves main; QR credentials never enter the page. */
import { parseConnectApplicationInput, ConnectApplicationError } from './cc-connect-applications.ts'
import { ConnectController, ConnectOperationError } from './cc-connect-controller.ts'
import { FeishuSetupError, type FeishuSetupRun, type FeishuSetupRunOptions } from './feishu-setup.ts'
import type { FeishuManagerResult, FeishuManagerState, FeishuQrState } from './cc-connect-types.ts'

interface Options {
  controller: ConnectController
  environment(): { safeMode: boolean; harnessReady: boolean }
  validWorkspace(workspace: string): Promise<boolean>
  createRun(options: Pick<FeishuSetupRunOptions, 'workspace' | 'onQr' | 'onStage'>): Pick<FeishuSetupRun, 'start' | 'cancel' | 'cleanup'>
  timeoutMs?: number
}

export class FeishuManager {
  private readonly options: Options
  private qr: FeishuQrState = { stage: 'idle' }
  private run: ReturnType<Options['createRun']> | undefined
  private job: Promise<void> | undefined
  private generation = 0
  private qrQueue: Promise<void> = Promise.resolve()

  constructor(options: Options) { this.options = options }
  async state(): Promise<FeishuManagerState> {
    return { ...await this.options.controller.state(), ...this.options.environment(), qr: { ...this.qr } }
  }

  private async cancel(): Promise<void> {
    ++this.generation
    this.run?.cancel()
    await this.job
    // Retry cleanup if a previous SIGKILL deadline failed; do not spawn another owner.
    await this.run?.cleanup()
    this.run = undefined
    this.job = undefined
    this.qr = { stage: 'cancelled' }
  }

  cancelQr(): Promise<void> {
    const task = this.qrQueue.then(() => this.cancel())
    this.qrQueue = task.catch(() => {})
    return task
  }

  private startQr(raw: unknown): Promise<void> {
    const task = this.qrQueue.then(async () => {
      const input = parseConnectApplicationInput({ ...(typeof raw === 'object' && raw !== null ? raw : {}), appId: 'pending-qr' })
      if (input === undefined || input.id !== undefined || input.appSecret !== undefined) throw new ConnectOperationError('invalid-input')
      if (!await this.options.validWorkspace(input.workspace)) throw new ConnectOperationError('invalid-workspace')
      await this.cancel()
      const generation = ++this.generation
      this.qr = { stage: 'starting', expiresAt: Date.now() + (this.options.timeoutMs ?? 600_000) }
      const run = this.options.createRun({ workspace: input.workspace,
        onQr: image => {
          if (generation === this.generation) this.qr = { ...this.qr, stage: 'waiting-for-scan', qrDataUrl: `data:image/png;base64,${image.toString('base64')}` }
        } })
      this.run = run
      this.job = (async () => {
        try {
          const result = await run.start()
          if (generation !== this.generation) return
          this.qr = { ...this.qr, stage: 'saving' }
          const application = await this.options.controller.saveApplication({ ...input, appId: result.appId, appSecret: result.appSecret })
          // Saving never switches/starts another application, even after window close.
          if (generation === this.generation) this.qr = { stage: 'saved', applicationId: application.id }
        } catch (error) {
          if (generation !== this.generation) return
          this.qr = { stage: error instanceof FeishuSetupError && error.reason === 'expired' ? 'expired' : 'error' }
        }
      })()
    })
    this.qrQueue = task.catch(() => {})
    return task
  }

  async execute(action: unknown, input?: unknown): Promise<FeishuManagerResult> {
    try {
      switch (action) {
        case 'state': break
        case 'qr-start': await this.startQr(input); break
        case 'qr-cancel': await this.cancelQr(); break
        case 'save': await this.options.controller.saveApplication(input); break
        case 'start':
          if (typeof input !== 'string') throw new ConnectOperationError('invalid-input')
          if (!await this.options.controller.start('manual', input)) return { ok: false, reason: 'not-started', state: await this.state() }
          break
        case 'close': await this.options.controller.close(); break
        case 'restart':
          if (!await this.options.controller.start('restart')) return { ok: false, reason: 'not-started', state: await this.state() }
          break
        case 'remove':
          if (typeof input !== 'string') throw new ConnectOperationError('invalid-input')
          await this.options.controller.remove(input); break
        case 'auto-connect':
          if (typeof input !== 'boolean') throw new ConnectOperationError('invalid-input')
          await this.options.controller.setAutoConnect(input); break
        default: throw new ConnectOperationError('invalid-input')
      }
      return { ok: true, state: await this.state() }
    } catch (error) {
      const reason = error instanceof ConnectOperationError || error instanceof ConnectApplicationError ? error.reason
        : error instanceof FeishuSetupError && error.reason === 'stop-failed' ? 'stop-failed' : 'storage'
      return { ok: false, reason, ...await this.state().then(state => ({ state }), () => ({})) }
    }
  }
}
