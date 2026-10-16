import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { parse } from 'yaml'

// Verify the deployed closure the app ships, not a potentially stale or
// differently-hoisted manifest node_modules directory.
const account = await readFile('resources/harness/node_modules/@deepseek-ai/dsh-client-ui-settings-account/lib/client.js', 'utf8')
const harnessRequire = createRequire(resolve('resources/harness/node_modules/@deepseek-ai/dsh/package.json'))
const start = account.indexOf('var BrowserLogin = class {')
const end = account.indexOf('\n\t\t//#endregion', start)
assert.ok(start >= 0 && end > start, 'review the pinned account browser lifecycle if its boundary changes')

test('the community Web shell namespace does not select the official desktop-only login path', () => {
  const detection = account.match(/const desktop = (.*);/)
  assert.ok(detection, 'review desktop capability detection on a kernel upgrade')
  const isDesktop = (globals: object) => runInNewContext(detection[1]!, globals)
  assert.equal(isDesktop({}), false)
  assert.equal(isDesktop({ dshDesktop: { getDesktopPreferences() {} } }), false)
  assert.equal(isDesktop({ dshDesktop: {}, dshOnboarding: {} }), false)
  assert.equal(isDesktop({ dshDesktop: {}, dshOnboarding: { hasApiKey() {} } }), true)
})

test('kernel account login opens the system-browser URL once when Electron denies the preopened blank tab', () => {
  const opened: unknown[][] = []
  const BrowserLogin = runInNewContext(account.slice(start, end) + '\nBrowserLogin', {
    window: { open: (...args: unknown[]) => { opened.push(args); return null } },
  })
  const browser = new BrowserLogin((url: string) => url)
  browser.begin()
  const view = { attempt: { id: 'fake-attempt', phase: 'waiting-browser', authorizeUrl: 'https://auth.invalid/authorize' } }
  browser.follow(view)
  browser.update(view)
  assert.deepEqual(opened, [
    ['about:blank', '_blank'],
    ['https://auth.invalid/authorize', '_blank', 'noopener,noreferrer'],
  ])
})

test('kernel account login preserves the upstream owned-popup route and cancellation cleanup', () => {
  const navigated: string[] = []
  let opened = 0
  let closed = 0
  const popup = { opener: {}, closed: false, location: { replace: (url: string) => navigated.push(url) }, close: () => { closed++ } }
  const BrowserLogin = runInNewContext(account.slice(start, end) + '\nBrowserLogin', {
    window: { open: () => { opened++; return popup } },
  })
  const browser = new BrowserLogin((url: string) => url)
  browser.begin()
  const view = { attempt: { id: 'fake-attempt', phase: 'waiting-browser', authorizeUrl: 'https://auth.invalid/authorize' } }
  browser.follow(view)
  browser.update(view)
  assert.equal(opened, 1)
  assert.equal(popup.opener, null)
  assert.deepEqual(navigated, ['https://auth.invalid/authorize'])
  browser.update({ attempt: { ...view.attempt, phase: 'cancelled' } })
  assert.equal(closed, 1)
})

test('ACP keeps the saved Models credential composition; the new headless-only override is not applied to the bot', async () => {
  // Inspect composition data, never execute the upstream !!js expressions.
  const options = { customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: (value: string) => value }] }
  // Resolve from the owning runtime: clean platform installs may legitimately
  // nest transitive bundles instead of hoisting them to node_modules' root.
  const base = parse(await readFile(harnessRequire.resolve('@deepseek-ai/dsh-base/cordis.patch.yml'), 'utf8'), options)
  const acp = parse(await readFile(harnessRequire.resolve('@deepseek-ai/dsh-acp-app/cordis.patch.yml'), 'utf8'), options)
  const headless = parse(await readFile(harnessRequire.resolve('@deepseek-ai/dsh-headless/cordis.patch.yml'), 'utf8'), options)
  const entries = base.flatMap((entry: { insert?: unknown[] }) => entry.insert ?? [])
  assert.ok(entries.some((entry: { id?: string; name?: string }) => entry.id === 'credentials' && entry.name === '@deepseek-ai/dsh-credentials-local'))
  assert.equal(acp.some((entry: { id?: string }) => entry.id === 'credentials'), false)
  assert.equal(headless.some((entry: { id?: string; disabled?: boolean }) => entry.id === 'credentials' && entry.disabled === true), true)
})
