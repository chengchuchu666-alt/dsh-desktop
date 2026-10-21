/** Dedicated manager bridge: no files, shell commands, Secrets or main-window APIs. */
import { contextBridge, ipcRenderer } from 'electron'
import type { FeishuManagerResult, WorkspacePickResult } from '../main/cc-connect-types.ts'

contextBridge.exposeInMainWorld('dshFeishu', {
  execute: (action: string, input?: unknown): Promise<FeishuManagerResult | null> =>
    ipcRenderer.invoke('desktop:connect:manager', action, input),
  pickWorkspace: (): Promise<WorkspacePickResult> => ipcRenderer.invoke('desktop:connect:manager:pick-workspace'),
  openPlatform: (): Promise<boolean> => ipcRenderer.invoke('desktop:connect:manager:open-platform'),
})
