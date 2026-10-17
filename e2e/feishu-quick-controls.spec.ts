import { test, expect, type Page } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { launchTrashHarness } from './trash-harness.ts'

/**
 * Floating Feishu quick control against the real Harness UI.
 *
 * Dev-mode only: the fake cc-connect sidecar is injected through the kernel's
 * DSH_CC_CONNECT_TEST_BIN hook, which production builds ignore. The no-config
 * visual states are covered for both locales/themes by desktop-ui-review.spec.
 */
const packaged = process.env.DSH_E2E_PACKAGED === '1'

type ConnectState = {
  enabled: boolean
  phase: string
  applicationName?: string | null
  secretConfigured: boolean
  health?: { channel?: string; dsh?: string; verifiedAt?: string }
}

async function openPanel(page: Page) {
  await page.locator('[data-dsh-controls-trigger]').click()
  const panel = page.locator('[data-dsh-controls-panel]')
  await expect(panel).toBeVisible()
  return panel
}

test('floating Feishu quick control only connects on explicit input and separates process/channel @desktop-ui', async ({}, info) => {
  test.skip(packaged, 'the fake cc-connect sidecar is dev-mode only')
  info.setTimeout(240_000)
  const harness = await launchTrashHarness(packaged, { connectSidecar: true })
  const { page } = harness
  const state = () => page.evaluate(() => (window as unknown as { dshDesktop: { getConnectState(): Promise<ConnectState | null> } }).dshDesktop.getConnectState())
  const starts = async () => {
    try { return (await readFile(harness.connectModePath! + '.starts', 'utf8')).trim().split('\n').length } catch { return 0 }
  }
  try {
    // Opening the panel is a read, not a connection: no saved app, no start.
    const panel = await openPanel(page)
    const quick = panel.locator('[data-dsh-feishu-quick]')
    await expect(quick).toBeVisible()
    await expect(quick).toHaveAttribute('data-state', 'disabled')
    await expect(quick.locator('[data-dsh-feishu-quick-app]')).toContainText('未选择应用')
    await expect(quick.locator('[data-dsh-feishu-process]')).toHaveAttribute('data-state', 'disabled')
    await expect(quick.locator('[data-dsh-feishu-channel]')).toHaveAttribute('data-state', 'unknown')
    await expect(quick.locator('[data-dsh-feishu-hint]')).toContainText('不会自动连接')
    await expect(quick.locator('[data-dsh-feishu-start]')).toBeDisabled()
    await expect(quick.locator('[data-dsh-feishu-restart]')).toHaveCount(0)
    expect(await starts(), 'opening the panel must not spawn a sidecar').toBe(0)
    expect(await state()).toMatchObject({ enabled: false, phase: 'disabled' })

    // Saving settings alone is inert; the panel reflects the process state.
    expect(await page.evaluate(workspace => (window as unknown as { dshDesktop: { saveConnectSettings(input: object): Promise<unknown> } }).dshDesktop.saveConnectSettings(
      { enabled: true, appId: 'cli_quick_fake', workspace, appSecret: 'fake-quick-secret' }), harness.workspace)).toMatchObject({ ok: true })
    await expect.poll(async () => (await state())?.phase).toBe('stopped')
    await expect(quick).toHaveAttribute('data-state', 'stopped')
    await expect(quick.locator('[data-dsh-feishu-quick-app]')).toContainText('Feishu')
    await expect(quick.locator('[data-dsh-feishu-process]')).toHaveAttribute('data-state', 'stopped')
    await expect(quick.locator('[data-dsh-feishu-channel]')).toHaveAttribute('data-state', 'unknown')
    await expect(quick.locator('[data-dsh-feishu-hint]')).toContainText('尚未启动')
    expect(await starts(), 'saving settings is not a start request').toBe(0)
    expect(harness.requests).toBe(0)

    // Keyboard activation reaches the same explicit start path.
    await writeFile(harness.connectModePath!, 'health\n')
    const startButton = quick.locator('[data-dsh-feishu-start]')
    await startButton.focus()
    await page.keyboard.press('Enter')
    await expect.poll(async () => (await state())?.phase).toBe('ready')
    await expect(quick).toHaveAttribute('data-state', 'ready')
    await expect(quick.locator('[data-dsh-feishu-process]')).toHaveAttribute('data-state', 'ready')
    await expect.poll(async () => (await state())?.health?.channel).toBe('online')
    await expect(quick.locator('[data-dsh-feishu-channel]')).toHaveAttribute('data-state', 'online')
    await expect(quick.locator('[data-dsh-feishu-dsh]')).toHaveAttribute('data-state', 'unavailable')
    expect((await state())?.health?.verifiedAt).toBeUndefined()
    expect(await starts()).toBe(1)
    expect(harness.requests, 'no model call is involved in connecting').toBe(0)
    expect(await page.evaluate(() => document.body.textContent)).not.toContain('fake-quick-secret')

    await quick.locator('[data-dsh-feishu-stop]').click()
    await expect.poll(async () => (await state())?.phase).toBe('disabled')
    await expect(quick).toHaveAttribute('data-state', 'disabled')
    expect(await starts()).toBe(1)

    // Failure recovery stays explicit: a crashed sidecar surfaces its state and
    // the same panel offers an explicit stop/retry instead of a silent loop.
    await writeFile(harness.connectModePath!, 'crash\n')
    await quick.locator('[data-dsh-feishu-start]').click()
    await expect(quick.locator('[data-dsh-feishu-hint]')).toContainText('上次启动失败', { timeout: 15_000 })
    await expect(quick).toHaveAttribute('data-state', /starting|degraded|crashed/)
    await quick.locator('[data-dsh-feishu-stop]').click()
    await expect.poll(async () => (await state())?.phase).toBe('disabled')
    expect(harness.requests).toBe(0)
  } finally { await harness.close() }
})

test('floating Feishu quick control stays read-only in Safe Mode @desktop-ui', async ({}, info) => {
  test.skip(packaged, 'the fake cc-connect sidecar is dev-mode only')
  info.setTimeout(240_000)
  const harness = await launchTrashHarness(packaged, { connectSidecar: true, safeMode: true })
  const { page } = harness
  const starts = async () => {
    try { return (await readFile(harness.connectModePath! + '.starts', 'utf8')).trim().split('\n').length } catch { return 0 }
  }
  try {
    expect(await page.evaluate(workspace => (window as unknown as { dshDesktop: { saveConnectSettings(input: object): Promise<unknown> } }).dshDesktop.saveConnectSettings(
      { enabled: true, appId: 'cli_safe_fake', workspace, appSecret: 'fake-safe-secret' }), harness.workspace)).toMatchObject({ ok: true })
    expect(await starts()).toBe(0)
    const panel = await openPanel(page)
    const quick = panel.locator('[data-dsh-feishu-quick]')
    await expect(quick).toBeVisible()
    await expect(quick).toHaveAttribute('data-state', 'stopped')
    await expect(quick.locator('[data-dsh-feishu-hint]')).toContainText('安全模式已暂停连接')
    await expect(quick.locator('[data-dsh-feishu-start]')).toBeDisabled()
    await expect(quick.locator('[data-dsh-feishu-restart]')).toBeDisabled()
    expect(await starts(), 'Safe Mode never resumes a saved connection by itself').toBe(0)
    expect(harness.requests).toBe(0)
  } finally { await harness.close() }
})
