import type { CredentialProtection } from './cc-connect-credentials.ts'
import type { ConnectSettings, ConnectSettingsSource } from './cc-connect-config.ts'

export type ConnectPhase = 'disabled' | 'stopped' | 'starting' | 'ready' | 'crashed' | 'degraded'

export interface ConnectState extends ConnectSettings {
  phase: ConnectPhase
  secretConfigured: boolean
  credentialProtection: CredentialProtection
  lastError?: string
  restartAttempts?: number
  applicationId?: string | null
  autoConnect?: boolean
  health?: ConnectHealth
}

export interface ConnectSettingsInput extends ConnectSettingsSource {
  appSecret?: string
}

export type ConnectSaveResult =
  | { ok: true; state: ConnectState }
  | { ok: false; reason: 'invalid-input' | 'invalid-workspace' | 'storage' | 'stop-failed'; state: ConnectState }

/** Local records only; neither the record nor its public state contains a Secret. */
export interface ConnectApplication extends Omit<ConnectSettings, 'enabled'> {
  id: string
  name: string
}

export interface ConnectIntent {
  enabled: boolean
  autoConnect: boolean
}

/** Many saved applications, exactly one selected Sidecar configuration. */
export interface ConnectManagerSettings extends ConnectIntent {
  version: 2
  applications: ConnectApplication[]
  activeApplicationId: string | null
}

export interface ConnectApplicationState extends ConnectApplication {
  secretConfigured: boolean
  credentialProtection: CredentialProtection
}

export type ConnectErrorCode = 'credentials' | 'permissions' | 'network' | 'workspace'
  | 'model-key-missing' | 'acp' | 'storage' | 'sidecar' | 'stop-failed'

/** Process readiness is NOT proof of a live Feishu channel or a usable model. */
export interface ConnectHealth {
  channel: 'unknown' | 'connecting' | 'online' | 'offline'
  dsh: 'unknown' | 'available' | 'unavailable'
  errorCode?: ConnectErrorCode
  /** Only an explicit, successful message round trip may set this timestamp. */
  verifiedAt?: string
}

export interface ConnectManagerState extends ConnectIntent {
  applications: ConnectApplicationState[]
  activeApplicationId: string | null
  connection: ConnectState
  health: ConnectHealth
}

/** Secret is write-only; an omitted/empty value keeps the existing credential. */
export interface ConnectApplicationInput extends Omit<ConnectSettingsSource, 'enabled'> {
  id?: string
  name: string
  appSecret?: string
}

export interface FeishuQrState {
  stage: 'idle' | 'starting' | 'waiting-for-scan' | 'saving' | 'saved' | 'expired' | 'cancelled' | 'error'
  qrDataUrl?: string
  expiresAt?: number
  applicationId?: string
}

export interface FeishuManagerState extends ConnectManagerState {
  qr: FeishuQrState
  safeMode: boolean
  harnessReady: boolean
}

export type FeishuManagerResult = { ok: true; state: FeishuManagerState }
  | { ok: false; reason: 'invalid-input' | 'invalid-workspace' | 'storage' | 'stop-failed' | 'not-found' | 'duplicate-app-id' | 'active-application' | 'not-started' | 'setup'; state?: FeishuManagerState }
