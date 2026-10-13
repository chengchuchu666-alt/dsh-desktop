import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { connectIntentAfterAction, shouldStartConnect, isConnectManagerSender } from '../src/main/cc-connect-policy.ts'
import type { ConnectStartReason } from '../src/main/cc-connect-policy.ts'
import type { ConnectIntent } from '../src/main/cc-connect-types.ts'

test('explicit close persists independently of window closure, pause, quit and startup preference', () => {
  for (const autoConnect of [true, false]) {
    const initial = { enabled: true, autoConnect }
    for (const action of ['window-close', 'safe-mode-enter', 'safe-mode-exit', 'quit'] as const) {
      assert.deepEqual(connectIntentAfterAction(initial, action), initial)
    }
    const closed = connectIntentAfterAction(initial, 'close')
    assert.deepEqual(closed, { enabled: false, autoConnect })
    assert.deepEqual(initial, { enabled: true, autoConnect }, 'does not mutate persisted input')
    for (const action of ['window-close', 'safe-mode-enter', 'safe-mode-exit', 'quit'] as const) {
      assert.deepEqual(connectIntentAfterAction(closed, action), closed)
    }
    assert.deepEqual(connectIntentAfterAction(closed, 'open'), initial)
  }
})

test('startup-only autoConnect never overrides explicit close, Safe Mode or unready Harness', () => {
  for (const enabled of [false, true]) for (const autoConnect of [false, true]) {
    for (const safeMode of [false, true]) for (const harnessReady of [false, true]) {
      const intent: ConnectIntent = { enabled, autoConnect }
      for (const reason of ['startup', 'manual', 'resume', 'restart'] as ConnectStartReason[]) {
        assert.equal(shouldStartConnect(intent, reason, { safeMode, harnessReady }),
          enabled && !safeMode && harnessReady && (reason !== 'startup' || autoConnect),
          JSON.stringify({ intent, reason, safeMode, harnessReady }))
      }
    }
  }
})

test('manager authorization requires the owned sender, exact loaded page and top frame', () => {
  const sender = {}
  const pageUrl = 'data:text/html;charset=utf-8,owned-manager'
  const owner = { sender, pageUrl }
  assert.equal(isConnectManagerSender(owner, sender, pageUrl, true), true)
  assert.equal(isConnectManagerSender(undefined, sender, pageUrl, true), false)
  assert.equal(isConnectManagerSender(owner, {}, pageUrl, true), false)
  for (const url of [undefined, 'https://example.com', 'data:text/html,foreign', pageUrl + '#foreign']) {
    assert.equal(isConnectManagerSender(owner, sender, url, true), false)
  }
  assert.equal(isConnectManagerSender(owner, sender, pageUrl, false), false)
})

test('the manager contract does not weaken existing Harness guards or conflate health facts', () => {
  const main = readFileSync('src/main/index.ts', 'utf8')
  for (const channel of ['get-state', 'save-settings', 'pick-workspace', 'start', 'stop', 'restart']) {
    assert.match(main, new RegExp(`ipcMain\\.handle\\('desktop:connect:${channel}'[\\s\\S]*?isMainWindowHarnessSender`))
  }
  const types = readFileSync('src/main/cc-connect-types.ts', 'utf8')
  assert.match(types, /interface ConnectApplication extends Omit<ConnectSettings, 'enabled'>/)
  const health = types.slice(types.indexOf('export interface ConnectHealth'), types.indexOf('export interface ConnectManagerState'))
  assert.match(health, /channel: 'unknown' \| 'connecting' \| 'online' \| 'offline'/)
  assert.match(health, /dsh: 'unknown' \| 'available' \| 'unavailable'/)
  assert.match(health, /verifiedAt\?: string/)
  const adr = readFileSync('docs/decisions/0037-feishu-application-manager.zh.md', 'utf8')
  for (const phrase of ['enabled=false', 'Safe Mode', 'autoConnect', '顶层 frame', 'DSH 会话', '结构化事件', '不是']) assert.ok(adr.includes(phrase), phrase)
})
