import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pushSiteRefresh } from '../scripts/push-site-refresh.mjs'

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
async function fixture(t: test.TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-site-push-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const remote = join(root, 'remote.git')
  const bot = join(root, 'bot')
  const peer = join(root, 'peer')
  git(root, 'init', '--bare', '--initial-branch=main', remote)
  git(root, 'clone', remote, bot)
  git(bot, 'config', 'user.name', 'Test Bot')
  git(bot, 'config', 'user.email', 'test@example.invalid')
  for (const dir of ['site/data', 'site/changelog', 'site/en/changelog']) await mkdir(join(bot, dir), { recursive: true })
  await writeFile(join(bot, 'site/data/release.json'), JSON.stringify({ release: { tag: 'v1.shell.1' } }))
  for (const file of ['site/changelog/index.html', 'site/en/changelog/index.html']) await writeFile(join(bot, file), 'old notes')
  await writeFile(join(bot, 'README.md'), 'original')
  git(bot, 'add', 'site', 'README.md')
  git(bot, 'commit', '-m', 'fixture')
  git(bot, 'push', 'origin', 'main')
  git(root, 'clone', remote, peer)
  git(peer, 'config', 'user.name', 'Test Peer')
  git(peer, 'config', 'user.email', 'peer@example.invalid')
  return { root, remote, bot, peer }
}

test('site refresh retries a rejected push by regenerating on the competing commit', async t => {
  const { bot, peer, remote } = await fixture(t)
  let calls = 0
  const original = git(bot, 'rev-parse', 'HEAD')
  assert.equal(await pushSiteRefresh({ root: bot, generate: async (cwd: string) => {
    calls++
    if (calls === 1) {
      await writeFile(join(peer, 'README.md'), 'new main')
      await writeFile(join(peer, 'site/data/release.json'), JSON.stringify({ release: { tag: 'v1.shell.2' } }))
      git(peer, 'add', 'README.md', 'site/data/release.json')
      git(peer, 'commit', '-m', 'competing release')
      git(peer, 'push', 'origin', 'main')
    }
    const tag = JSON.parse(await readFile(join(cwd, 'site/data/release.json'), 'utf8')).release.tag
    await writeFile(join(cwd, 'site/changelog/index.html'), `notes for ${tag}`)
  } }), true)
  assert.equal(calls, 2)
  assert.equal(git(remote, 'show', 'main:README.md'), 'new main')
  assert.equal(git(remote, 'show', 'main:site/changelog/index.html'), 'notes for v1.shell.2')
  assert.equal(git(bot, 'rev-parse', 'HEAD'), original, 'calling checkout is untouched')
  assert.equal(git(bot, 'worktree', 'list', '--porcelain').match(/worktree /g)?.length, 1)
})

test('site refresh publishes changelog-only changes and no-op does not commit', async t => {
  const { bot, remote } = await fixture(t)
  const before = git(remote, 'rev-parse', 'main')
  assert.equal(await pushSiteRefresh({ root: bot, generate: async () => {} }), false)
  assert.equal(git(remote, 'rev-parse', 'main'), before)
  assert.equal(await pushSiteRefresh({ root: bot, generate: async (cwd: string) => {
    await writeFile(join(cwd, 'site/en/changelog/index.html'), 'updated English notes')
  } }), true)
  assert.equal(git(remote, 'show', 'main:site/en/changelog/index.html'), 'updated English notes')
})

test('site refresh fails after bounded rejected pushes and cleans its worktree', async t => {
  const { bot, peer } = await fixture(t)
  let calls = 0
  await assert.rejects(pushSiteRefresh({ root: bot, attempts: 2, generate: async (cwd: string) => {
    calls++
    await writeFile(join(peer, 'README.md'), `competitor ${calls}`)
    git(peer, 'add', 'README.md')
    git(peer, 'commit', '-m', `competing ${calls}`)
    git(peer, 'push', 'origin', 'main')
    await writeFile(join(cwd, 'site/changelog/index.html'), 'new notes')
  } }))
  assert.equal(calls, 2)
  assert.equal(git(bot, 'worktree', 'list', '--porcelain').match(/worktree /g)?.length, 1)
})
