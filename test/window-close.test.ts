import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { transformSync } from 'esbuild'

test('main-window close uses the application shutdown path, never hides to tray', async () => {
  const window = await readFile(new URL('../src/main/window.ts', import.meta.url), 'utf8')
  const index = await readFile(new URL('../src/main/index.ts', import.meta.url), 'utf8')
  const close = window.slice(window.indexOf("window.on('close'"), window.indexOf("window.on('show'"))
  assert.match(close, /saveWindowState\(window\)/)
  assert.match(close, /if \(!context.quitInProgress\)/)
  assert.match(close, /event.preventDefault\(\)[\s\S]*setImmediate\(\(\) => app.quit\(\)\)/)
  assert.doesNotMatch(close, /window.hide\(|hideOnClose|onCloseToTray/)
  assert.doesNotMatch(index, /hideOnClose|explainCloseToTray/)
  assert.match(index, /Promise.allSettled\(\[connectController\?\.shutdown\(\), shellApp.stopHarness\(\)/)
  assert.match(index, /lanService.stop\(\)/)
  assert.match(index, /runtimeManager\?\.stopAll\(\)/)
})

test('application quit attempts all service stops even if one rejects', async () => {
  const source = await readFile(new URL('../src/main/index.ts', import.meta.url), 'utf8')
  const registration = source.slice(source.indexOf("app.on('before-quit'"), source.indexOf("app.on('window-all-closed'"))
  let handler: (event: { preventDefault(): void }) => void = () => {}
  let resolveQuit: () => void = () => {}
  const quit = new Promise<void>(resolve => { resolveQuit = resolve })
  const stopped: string[] = []
  let prevented = 0
  runInNewContext(transformSync(registration, { loader: 'ts', format: 'cjs' }).code, {
    app: { on: (_event: string, callback: typeof handler) => { handler = callback }, quit: resolveQuit },
    windowContext: { quitInProgress: false },
    shutdownComplete: false,
    releaseDesktopShortcut: () => {}, closeLanPairingWindow: () => {}, closeFeishuSetupWindow: () => {},
    localeController: undefined, destroyTray: () => {}, runtimeWindows: new Map(),
    connectController: { hasProcess: true, shutdown: async () => { stopped.push('connect'); throw new Error('simulated stop failure') } },
    shellApp: { supervisorInstance: {}, stopHarness: async () => { stopped.push('harness') } },
    feishuManager: { cancelQr: async () => { stopped.push('qr') } },
    lanService: { isRunning: true, stop: async () => { stopped.push('lan') } },
    runtimeManager: { hasRunningProcesses: () => true, stopAll: async () => { stopped.push('runtimes') } },
    setTimeout: () => ({ unref: () => {} }), clearTimeout: () => {}, console: { warn: () => {} },
  })
  handler({ preventDefault: () => { prevented++ } })
  handler({ preventDefault: () => { prevented++ } })
  await quit
  assert.equal(prevented, 2, 'a repeated quit must wait for service cleanup')
  assert.deepEqual(stopped.sort(), ['connect', 'harness', 'lan', 'qr', 'runtimes'])
})
