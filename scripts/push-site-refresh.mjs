#!/usr/bin/env node
/** Generated data must be regenerated on the latest main, not conflict-merged. */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const GENERATED = ['site/data/release.json', 'site/data/stars.json', 'site/changelog/index.html', 'site/en/changelog/index.html', 'site/download/index.html', 'site/en/download/index.html', 'site/sitemap.xml']
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

export async function pushSiteRefresh({ root = process.cwd(), attempts = 3, generate = async cwd => {
  for (const script of ['gen-site-data.mjs', 'gen-site-changelog.mjs', 'gen-site-stars.mjs', 'gen-site-download-index.mjs', 'gen-site-sitemap.mjs']) {
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
      // A generator may not have produced its file yet (a fresh fixture, or a
      // skipped step): commit what exists instead of failing `git add`.
      const generated = GENERATED.filter(file => existsSync(join(checkout, file)))
      if (generated.length === 0) return false
      if (!git(checkout, 'status', '--porcelain', '--', ...generated)) return false
      const { release } = JSON.parse(await readFile(join(checkout, GENERATED[0]), 'utf8'))
      git(checkout, 'add', '--', ...generated)
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
