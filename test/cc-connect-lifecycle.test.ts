import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/main/index.ts', 'utf8')

test('cc-connect lifecycle is wired after Harness readiness and before quit completes', () => {
  assert.match(source, /const url = await boot\(\)[\s\S]*?await startConnectAfterHarness\('startup'\)/)
  assert.match(source, /app.on\('before-quit'[\s\S]*?Promise.allSettled\(\[connectController\?\.shutdown\(\), shellApp.stopHarness\(\)/)
})

test('Safe Mode and kernel changes refresh the sidecar configuration', () => {
  assert.match(source, /applySafeMode[\s\S]*?stopConnectSupervisor\(\)/)
  assert.match(source, /applySafeMode[\s\S]*?startConnectAfterHarness\('resume'\)/)
  assert.match(source, /switchKernel[\s\S]*?restartConnectForCurrentKernel\(\)/)
  assert.match(source, /kernelRestore[\s\S]*?restartConnectForCurrentKernel\(\)/)
  assert.match(source, /DSH_CC_CONNECT_FEISHU_SECRET/)
  assert.match(source, /beforeHarnessRestart: stopConnectSupervisor/)
  assert.match(source, /afterHarnessRestart: restartConnectForCurrentKernel/)
  assert.match(source, /desktop:connect:stop[\s\S]*?getConnectController\(\)\.close\(\)/)
})

test('the fake Sidecar command override is development-only and never renderer-controlled', () => {
  assert.match(source, /!app\.isPackaged[\s\S]*DSH_CC_CONNECT_TEST_BIN/)
  assert.match(source, /command:\s*!app\.isPackaged[\s\S]*ccConnectBin\(\)/)
})
