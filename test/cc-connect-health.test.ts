import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseConnectHealthLine, applyConnectHealthEvent } from '../src/main/cc-connect-health.ts'

function line(event: unknown): string {
  return 'time=2026-10-11T00:00:00Z level=INFO msg="cc-connect health" event=' + JSON.stringify(JSON.stringify(event))
}

test('versioned health decoding rejects arbitrary logs, private fields, malformed values and unknown protocol versions', () => {
  for (const event of [
    { version: 1, component: 'channel', state: 'online' },
    { version: 1, component: 'channel', state: 'offline', errorCode: 'permissions' },
    { version: 1, component: 'agent', state: 'unavailable', errorCode: 'model-key-missing' },
    { version: 1, component: 'agent', state: 'available' },
  ]) assert.deepEqual(parseConnectHealthLine(line(event)), event)
  for (const text of [
    'cc-connect ready', 'connected to wss://test', 'INFO ' + line({ version: 1, component: 'channel', state: 'online' }),
    line({ version: 2, component: 'channel', state: 'online' }), line({ version: 1, component: 'channel', state: 'available' }),
    line({ version: 1, component: 'agent', state: 'online' }), line({ version: 1, component: 'agent', state: 'available', secret: 'fake-private' }),
    line({ version: 1, component: 'agent', state: 'available', errorCode: 'fake-private' }), line(null), line([]),
    line({ version: 1, component: 'channel', state: {} }), line({ version: 1, component: 'channel', state: 'online' }) + ' arbitrary=true',
    'level=INFO msg="cc-connect health" event="malformed"', 'x'.repeat(5000),
  ]) assert.equal(parseConnectHealthLine(text), undefined, text.slice(0, 120))
})

test('channel and model health are separate and execution does not claim verified delivery', () => {
  const failed = applyConnectHealthEvent({ channel: 'online', dsh: 'unknown' }, { version: 1, component: 'agent', state: 'unavailable', errorCode: 'model-key-missing' })
  assert.deepEqual(failed, { channel: 'online', dsh: 'unavailable', errorCode: 'model-key-missing' })
  const online = applyConnectHealthEvent(failed, { version: 1, component: 'channel', state: 'online' })
  assert.equal(online.errorCode, 'model-key-missing')
  const recovered = applyConnectHealthEvent(online, { version: 1, component: 'agent', state: 'available' })
  assert.deepEqual(recovered, { channel: 'online', dsh: 'available' })
  assert.equal(recovered.verifiedAt, undefined)
})
