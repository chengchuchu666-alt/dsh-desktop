import type { ConnectIntent } from './cc-connect-types.ts'

export type ConnectStartReason = 'startup' | 'manual' | 'resume' | 'restart'
export type ConnectIntentAction = 'open' | 'close' | 'window-close' | 'safe-mode-enter' | 'safe-mode-exit' | 'quit'

/** Pause/quit/window closure never rewrite the user's persisted connection intent. */
export function connectIntentAfterAction(intent: ConnectIntent, action: ConnectIntentAction): ConnectIntent {
  return { ...intent, enabled: action === 'open' ? true : action === 'close' ? false : intent.enabled }
}

export function shouldStartConnect(
  intent: ConnectIntent,
  reason: ConnectStartReason,
  environment: { safeMode: boolean; harnessReady: boolean },
): boolean {
  return intent.enabled && !environment.safeMode && environment.harnessReady
    && (reason !== 'startup' || intent.autoConnect)
}

/** The manager receives only connection capabilities, never the main-window bridge.
 * Match the actual owner, exact loaded page, and top frame; a URL alone is not authority. */
export function isConnectManagerSender(
  owner: { sender: unknown; pageUrl: string } | undefined,
  sender: unknown,
  frameUrl: string | undefined,
  isMainFrame: boolean,
): boolean {
  return owner !== undefined && sender === owner.sender && frameUrl === owner.pageUrl && isMainFrame
}
