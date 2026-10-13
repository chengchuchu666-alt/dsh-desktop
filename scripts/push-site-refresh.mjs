#!/usr/bin/env node
/** Generated data must be regenerated on the latest main, not conflict-merged. */
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const GENERATED = ['site/data/release.json', 'site/changelog/index.html', 'site/en/changelog/index.html']
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

export async function pushSiteRefresh({ root = process.cwd(), attempts = 3, generate = async cwd => {
  for (const script of ['gen-site-data.mjs', 'gen-site-changelog.mjs']) {
    execFileSync(process.execPath, ['scripts/' + script], { cwd, stdio: 'inherit' })
  }
} } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    git(root, 'fetch', 'origin', 'main')
    const scratch = await mkdtemp(join(tmpdir(), 'dsh-site-refresh-'))
    const checkout = join(scratch, 'checkout')
    let added = false
    try {
      git(root, 'worktree', 'add', '--detach', checkout, 'FETCH_HEAD')
      added = true
      await generate(checkout)
      if (!git(checkout, 'status', '--porcelain', '--', ...GENERATED)) return false
      const { release } = JSON.parse(await readFile(join(checkout, GENERATED[0]), 'utf8'))
      git(checkout, 'add', '--', ...GENERATED)
      git(checkout, 'commit', '-m', `site: sync release data ${release.tag}`)
      try {
        git(checkout, 'push', 'origin', 'HEAD:main')
        console.log(`site-refresh: pushed ${release.tag} (attempt ${attempt})`)
        return true
      } catch (error) {
        if (attempt === attempts) throw error
        console.warn('site-refresh: push rejected; regenerating on latest main')
      }
    } finally {
      // Only this invocation's disposable checkout; never the calling checkout.
      if (added) git(root, 'worktree', 'remove', '--force', checkout)
      await rm(scratch, { recursive: true, force: true })
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await pushSiteRefresh()
}
