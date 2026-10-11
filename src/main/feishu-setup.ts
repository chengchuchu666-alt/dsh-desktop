import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nodeBin } from './paths.ts'
import { ManagedChild } from './process-lifecycle.ts'

export class FeishuSetupError extends Error {
  readonly reason: 'cancelled' | 'expired' | 'start' | 'credentials' | 'exit' | 'stop-failed'
  constructor(reason: FeishuSetupError['reason']) {
    super(`Feishu setup ${reason === 'expired' ? 'timed out' : reason}`)
    this.reason = reason
  }
}

export type FeishuSetupStage = 'starting' | 'waiting-for-scan' | 'completed' | 'cancelled'

export interface FeishuSetupPaths {
  directory: string
  configPath: string
  qrImagePath: string
}

export interface FeishuSetupResult {
  appId: string
  appSecret: string
  status: 'completed'
}

export interface FeishuSetupRunOptions {
  command: string
  workspace: string
  projectName?: string
  tempDirectory?: string
  timeoutMs?: number
  args?: (paths: FeishuSetupPaths, timeoutSeconds: number, projectName: string) => readonly string[]
  onQr?: (image: Buffer) => void
  onStage?: (stage: FeishuSetupStage) => void
}

export function feishuSetupSpawnCommand(
  command: string,
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
  nodeCommand?: string,
): { command: string; args: readonly string[] } {
  if (platform === 'win32' && /\.(?:c|m)?js$/i.test(command)) {
    return { command: nodeCommand ?? bundledNodeCommand(), args: [command, ...args] }
  }
  return { command, args }
}

function bundledNodeCommand(): string {
  try {
    return nodeBin()
  } catch {
    // Unit tests and development utilities may call this helper without an
    // Electron app. The production path is the bundled Node executable.
    return process.execPath
  }
}

export function extractFeishuCredentials(config: string): { appId: string; appSecret: string } {
  const appId = readTomlString(config, 'app_id')
  const appSecret = readTomlString(config, 'app_secret')
  if (appId === undefined || appSecret === undefined || appId === '' || appSecret === '') {
    throw new FeishuSetupError('credentials')
  }
  return { appId, appSecret }
}

function readTomlString(config: string, key: string): string | undefined {
  const match = config.match(new RegExp(`^${key}\\s*=\\s*("(?:\\\\.|[^"])*")\\s*$`, 'm'))
  if (match?.[1] === undefined) return undefined
  try {
    return JSON.parse(match[1]) as string
  } catch {
    return undefined
  }
}

export class FeishuSetupRun {
  private readonly options: FeishuSetupRunOptions
  private readonly timeoutMs: number
  private readonly managed = new ManagedChild()
  private temporaryDirectory: string | undefined
  private started = false
  private cancelled = false
  private finishReject: ((error: Error) => void) | undefined

  constructor(options: FeishuSetupRunOptions) {
    this.options = options
    this.timeoutMs = options.timeoutMs ?? 10 * 60 * 1_000
  }

  async start(): Promise<FeishuSetupResult> {
    if (this.started) throw new Error('Feishu setup already started')
    this.started = true
    if (this.cancelled) throw new FeishuSetupError('cancelled')
    this.emit('starting')
    const directory = await mkdtemp(join(this.options.tempDirectory ?? tmpdir(), 'dsh-feishu-setup-'))
    this.temporaryDirectory = directory
    const paths: FeishuSetupPaths = {
      directory,
      configPath: join(directory, 'config.toml'),
      qrImagePath: join(directory, 'feishu-qr.png'),
    }
    const projectName = this.options.projectName ?? 'dsh-desktop'
    const timeoutSeconds = Math.max(1, Math.ceil(this.timeoutMs / 1_000))
    const args = this.options.args?.(paths, timeoutSeconds, projectName) ?? [
      'feishu', 'new', '--config', paths.configPath, '--project', projectName,
      '--qr-image', paths.qrImagePath, '--timeout', String(timeoutSeconds),
    ]

    try {
      if (this.cancelled) throw new FeishuSetupError('cancelled')
      const result = await this.waitForProcess(paths, args)
      this.emit('completed')
      return { ...result, status: 'completed' }
    } finally {
      await this.cleanup()
    }
  }

  cancel(): void {
    if (this.cancelled) return
    this.cancelled = true
    this.emit('cancelled')
    this.managed.process?.kill('SIGTERM')
    this.finishReject?.(new FeishuSetupError('cancelled'))
  }

  private emit(stage: FeishuSetupStage): void {
    this.options.onStage?.(stage)
  }

  private async waitForProcess(paths: FeishuSetupPaths, args: readonly string[]): Promise<{ appId: string; appSecret: string }> {
    return await new Promise<{ appId: string; appSecret: string }>((resolve, reject) => {
      let settled = false
      let qrSeen = false
      let qrTimer: NodeJS.Timeout | undefined
      let qrPollInFlight: Promise<void> | undefined
      const timeout = setTimeout(() => finishReject(new FeishuSetupError('expired')), this.timeoutMs)
      timeout.unref()
      const finishResolve = (value: { appId: string; appSecret: string }): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (qrTimer !== undefined) clearInterval(qrTimer)
        resolve(value)
      }
      const finishReject = (error: Error): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (qrTimer !== undefined) clearInterval(qrTimer)
        reject(error)
      }
      this.finishReject = finishReject
      const pollQr = (): Promise<void> => {
        if (settled || qrSeen) return Promise.resolve()
        if (qrPollInFlight !== undefined) return qrPollInFlight
        qrPollInFlight = (async () => {
          try {
            await access(paths.qrImagePath)
            const image = await readFile(paths.qrImagePath)
            if (image.length > 0) {
              qrSeen = true
              this.emit('waiting-for-scan')
              this.options.onQr?.(image)
            }
          } catch {
            // The sidecar writes the QR asynchronously; keep polling until it exits.
          } finally {
            qrPollInFlight = undefined
          }
        })()
        return qrPollInFlight
      }
      qrTimer = setInterval(() => { void pollQr() }, 80)
      void pollQr()
      try {
        const spawnCommand = feishuSetupSpawnCommand(this.options.command, args)
        this.managed.spawn({
          command: spawnCommand.command, args: spawnCommand.args,
          cwd: this.options.workspace,
          env: { ...process.env, HOME: this.temporaryDirectory, USERPROFILE: this.temporaryDirectory },
          windowsHide: true,
        })
      } catch {
        finishReject(new FeishuSetupError('start'))
        return
      }
      const child = this.managed.process!
      // Drain, never log potentially credential-bearing CLI output.
      child.stdout?.resume(); child.stderr?.resume()
      child.once('error', () => finishReject(new FeishuSetupError('start')))
      child.once('close', async code => {
        if (settled) return
        if (this.cancelled) {
          finishReject(new FeishuSetupError('cancelled'))
          return
        }
        if (code !== 0) {
          finishReject(new FeishuSetupError('exit'))
          return
        }
        try {
          // A test or very fast local sidecar may write the QR and exit before
          // the polling interval fires. Capture it once more before resolving
          // so the success page can retain the QR as an audit aid.
          await pollQr()
          const config = await readFile(paths.configPath, 'utf8')
          finishResolve(extractFeishuCredentials(config))
        } catch {
          finishReject(new FeishuSetupError('credentials'))
        }
      })
    })
  }

  async cleanup(): Promise<void> {
    this.finishReject = undefined
    let timer: NodeJS.Timeout | undefined
    try {
      await Promise.race([this.managed.stop(1000), new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new FeishuSetupError('stop-failed')), 2500)
      })])
    } finally { if (timer !== undefined) clearTimeout(timer) }
    if (this.temporaryDirectory !== undefined) {
      await rm(this.temporaryDirectory, { recursive: true, force: true })
      this.temporaryDirectory = undefined
    }
  }
}
