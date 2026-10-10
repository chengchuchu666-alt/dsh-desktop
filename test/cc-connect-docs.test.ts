import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('cc-connect user documentation covers setup, lifecycle, storage, and removal', async () => {
  const guide = await readFile('docs/cc-connect.md', 'utf8')
  const cliGuide = await readFile('docs/feishu-cli.md', 'utf8')
  const index = await readFile('docs/README.md', 'utf8')
  const releaseNotes = await readFile('docs/release-notes/v0.2.1-alpha.1.shell.4.md', 'utf8')
  const siteHome = await readFile('site/index.html', 'utf8')
  const siteHomeEn = await readFile('site/en/index.html', 'utf8')
  const siteInstall = await readFile('site/docs/install/index.html', 'utf8')
  const siteInstallEn = await readFile('site/en/docs/install/index.html', 'utf8')

  for (const phrase of [
    '飞书开放平台',
    'im.message.receive_v1',
    'WebSocket 长连接',
    '启动',
    '停止',
    'Safe Mode',
    'credentials.json',
    '脱敏',
    '彻底禁用',
    '删除凭证',
    'DSH_CC_CONNECT_FEISHU_SECRET',
    '配置飞书机器人',
    '二维码',
    '消息详细度',
    '流式预览',
    '刷新间隔',
    '卡片样式',
    '进度展示',
    'compact',
    'quiet',
    '3000ms',
    '[stream_preview]',
    '[projects.display]',
    '最终答复',
    '未保存编辑',
    '多项目/多平台',
  ]) {
    assert.match(guide, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.match(index, /cc-connect\.md/)
  assert.match(cliGuide, /lark-cli whoami/)
  assert.match(cliGuide, /skills/i)
  assert.match(releaseNotes, /cc-connect|飞书消息连接/i)
  assert.match(siteHome, /配置飞书机器人/)
  assert.match(siteHomeEn, /Set up Feishu bot/)
  assert.match(siteInstall, /pnpm run feishu:setup/)
  assert.match(siteInstallEn, /pnpm run feishu:setup/)
  const decision = await readFile('docs/decisions/0036-bounded-message-preferences.zh.md', 'utf8')
  assert.match(decision, /缺省字段.*compact/)
  assert.match(decision, /显式偏好/)
  assert.match(decision, /静默不是不回复/)
})
