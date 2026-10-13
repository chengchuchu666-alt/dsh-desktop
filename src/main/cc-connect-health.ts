import type { ConnectErrorCode, ConnectHealth } from './cc-connect-types.ts'

export type ConnectHealthEvent =
  | { version: 1; component: 'channel'; state: ConnectHealth['channel']; errorCode?: ConnectErrorCode }
  | { version: 1; component: 'agent'; state: ConnectHealth['dsh']; errorCode?: ConnectErrorCode }

/** Decode only the adapter-owned, versioned slog event, never arbitrary logs. */
export function parseConnectHealthLine(line: string): ConnectHealthEvent | undefined {
  if (line.length > 4096) return undefined
  const match = line.match(/^(?:time=\S+ )?level=INFO msg="cc-connect health" event=("(?:\\.|[^"\\])*")$/)
  if (match?.[1] === undefined) return undefined
  try {
    const value = JSON.parse(JSON.parse(match[1])) as Record<string, unknown>
    if (typeof value !== 'object' || value === null || Array.isArray(value) || value.version !== 1
      || Object.keys(value).some(key => !['version', 'component', 'state', 'errorCode'].includes(key))) return undefined
    if (value.errorCode !== undefined && !['credentials', 'permissions', 'network', 'model-key-missing', 'acp'].includes(value.errorCode as string)) return undefined
    if (value.component === 'channel' && ['connecting', 'online', 'offline'].includes(value.state as string)) return value as ConnectHealthEvent
    if (value.component === 'agent' && ['available', 'unavailable'].includes(value.state as string)) return value as ConnectHealthEvent
  } catch { /* malformed/foreign records are not evidence */ }
  return undefined
}

export function applyConnectHealthEvent(health: ConnectHealth, event: ConnectHealthEvent): ConnectHealth {
  const next = { ...health }
  if (event.component === 'channel') next.channel = event.state
  else next.dsh = event.state
  if (event.errorCode !== undefined) next.errorCode = event.errorCode
  else if ((event.component === 'channel' && ['credentials', 'permissions', 'network'].includes(next.errorCode ?? ''))
    || (event.component === 'agent' && ['acp', 'model-key-missing'].includes(next.errorCode ?? ''))) delete next.errorCode
  // Successful ACP execution is not evidence that an outgoing reply was delivered.
  return next
}
