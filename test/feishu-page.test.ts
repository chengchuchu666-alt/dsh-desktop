import { test } from 'node:test'
import assert from 'node:assert/strict'
import { feishuSetupPageMarkup, feishuManagerPageMarkup } from '../src/main/feishu-page.ts'
import { createHash } from 'node:crypto'

test('Feishu setup page renders the QR and never renders credentials', () => {
  const page = feishuSetupPageMarkup('zh', { stage: 'waiting-for-scan', qrDataUrl: 'data:image/png;base64,ZmFrZQ==' })
  assert.match(page, /飞书连接管理/)
  assert.match(page, /data:image\/png;base64,ZmFrZQ==/)
  assert.match(page, /等待手机确认授权/)
  assert.doesNotMatch(page, /fake-secret|cli_fake_id/)
})

test('manager uses a hash-only script policy, localized complete controls and no remote assets or general Desktop bridge', () => {
  for (const locale of ['zh', 'en'] as const) {
    const page = feishuManagerPageMarkup(locale)
    const script = page.match(/<script>([\s\S]*)<\/script>/)![1]!
    const hash = createHash('sha256').update(script).digest('base64')
    assert.ok(page.includes(`script-src 'sha256-${hash}'`))
    assert.ok(page.includes("default-src 'none'"))
    assert.ok(page.includes("frame-src 'none'"))
    assert.doesNotMatch(page, /script-src 'unsafe-inline'|unsafe-eval|onclick=|https?:\/\/|dshDesktop|innerHTML|readSecret/)
    for (const id of ['applications','generate','cancel','save','save-open','close','restart','auto','detail','cardMode','progressStyle','showStreamPreview','streamPreviewIntervalMs','process','channel','dsh']) assert.ok(page.includes(`id="${id}"`), id)
    assert.match(page, /Models/)
    assert.match(page, /type="password"/)
    assert.match(page, /id="manual"[\s\S]*?<\/details>\s*<details id="display"/)
    assert.match(page, /quietHelp/)
    assert.match(page, /<\/details><div class="actions"><button id="save"/)
    assert.doesNotMatch(page, /value="fake|fake-secret/)
    const copy = JSON.parse(page.match(/<script id="copy" type="application\/json">([\s\S]*?)<\/script>/)![1]!)
    assert.equal(Object.values(copy).every(value => typeof value === 'string' && value.length > 0), true)
  }
})

test('Feishu setup page renders a safe failure state without process details', () => {
  const page = feishuSetupPageMarkup('en', { stage: 'error' })
  assert.match(page, /Feishu bot setup failed/)
  assert.doesNotMatch(page, /exit|secret|app_id/i)
})

test('manager explains an empty workspace at the field instead of silently ignoring the click (#124/#126)', () => {
  for (const locale of ['zh', 'en'] as const) {
    const page = feishuManagerPageMarkup(locale)
    // Required field + a dedicated alert next to the workspace input.
    assert.match(page, /id="workspace"[^>]*aria-required="true"/)
    assert.match(page, /id="workspace-error"[^>]*role="alert"[^>]*hidden/)
    // Both create and save refuse to call IPC with an empty workspace.
    assert.match(page, /const requireWorkspace = \(\) => \{/)
    assert.match(page, /setWorkspaceError\(copy\['error\.invalid-workspace'\]\)/)
    assert.match(page, /if \(!requireWorkspace\(\)\) return;/)
    // The picker result is discriminated: cancel is silent, invalid explains.
    assert.match(page, /picked\?\.canceled === true/)
    assert.match(page, /picked\.workspace !== ''/)
  }
})
