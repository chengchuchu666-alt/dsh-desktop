import { BrowserWindow, nativeTheme, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { shellText, type ShellLocale } from './locale.ts'
import { asDataUrl } from './shell-html.ts'
import { feishuManagerPageMarkup } from './feishu-page.ts'
import { isConnectManagerSender } from './cc-connect-policy.ts'
import { hiddenTitleBarOptions } from './window-chrome.ts'

export interface FeishuSetupWindowController {
  accepts(event: IpcMainInvokeEvent): boolean
  show(): void
  close(): void
  isOpen(): boolean
}

let setupWindow: BrowserWindow | undefined
let setupController: FeishuSetupWindowController | undefined

export function showFeishuSetupWindow(
  parent: BrowserWindow | undefined,
  locale: ShellLocale,
  onClosed: () => void,
): FeishuSetupWindowController {
  if (setupWindow !== undefined && !setupWindow.isDestroyed()) {
    setupWindow.show()
    setupWindow.focus()
    return setupController!
  }

  const window = new BrowserWindow({
    width: 800,
    height: 760,
    minWidth: 600,
    minHeight: 600,
    resizable: true,
    show: false,
    modal: false,
    parent,
    center: true,
    title: shellText(locale, 'feishu.setupTitle'),
    ...hiddenTitleBarOptions(process.platform, nativeTheme.shouldUseDarkColors),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: join(__dirname, '..', 'preload', 'feishu.cjs'),
    },
  })
  setupWindow = window
  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    if (setupWindow === window) { setupWindow = undefined; setupController = undefined }
    onClosed()
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  const pageUrl = asDataUrl(feishuManagerPageMarkup(locale))
  window.webContents.on('will-navigate', (event, url) => { if (url !== pageUrl) event.preventDefault() })
  window.webContents.on('will-redirect', event => event.preventDefault())
  const controller = controllerFor(window, pageUrl)
  setupController = controller
  void window.loadURL(pageUrl)
  return controller
}

export function closeFeishuSetupWindow(): void {
  if (setupWindow !== undefined && !setupWindow.isDestroyed()) setupWindow.close()
  setupWindow = undefined
  setupController = undefined
}

function controllerFor(window: BrowserWindow, pageUrl: string): FeishuSetupWindowController {
  return {
    accepts(event) {
      return !window.isDestroyed() && isConnectManagerSender({ sender: window.webContents, pageUrl },
        event.sender, event.senderFrame?.url, event.senderFrame === window.webContents.mainFrame)
    },
    show() {
      if (!window.isDestroyed()) {
        window.show()
        window.focus()
      }
    },
    close() {
      if (!window.isDestroyed()) {
        window.close()
      }
    },
    isOpen() {
      return !window.isDestroyed()
    },
  }
}
