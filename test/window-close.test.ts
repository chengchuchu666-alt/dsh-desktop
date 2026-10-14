import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('main-window close uses the application shutdown path, never hides to tray', async () => {
  const window = await readFile(new URL('../src/main/window.ts', import.meta.url), 'utf8')
  const index = await readFile(new URL('../src/main/index.ts', import.meta.url), 'utf8')
  const close = window.slice(window.indexOf("window.on('close'"), window.indexOf("window.on('show'"))
  assert.match(close, /saveWindowState\(window\)/)
  assert.match(close, /if \(!context.quitInProgress\)/)
  assert.match(close, /event.preventDefault\(\)[\s\S]*setImmediate\(\(\) => app.quit\(\)\)/)
  assert.doesNotMatch(close, /window.hide\(|hideOnClose|onCloseToTray/)
  assert.doesNotMatch(index, /hideOnClose|explainCloseToTray/)
  assert.match(index, /stopConnectSupervisor\(\).then\(\(\) => shellApp.stopHarness\(\)\)/)
  assert.match(index, /lanService.stop\(\)/)
  assert.match(index, /runtimeManager\?\.stopAll\(\)/)
})
