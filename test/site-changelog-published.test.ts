import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

test('website changelog excludes committed but unpublished release notes', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-changelog-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const dir of ['docs/release-notes', 'site/data', 'site/changelog', 'site/en/changelog']) await mkdir(join(root, dir), { recursive: true })
  await writeFile(join(root, 'site/data/release.json'), JSON.stringify({ release: { tag: 'v0.2.1-alpha.2.shell.2' } }))
  for (const [version, text] of [[1, 'previous'], [2, 'published'], [3, 'unpublished']] as const) {
    await writeFile(join(root, `docs/release-notes/v0.2.1-alpha.2.shell.${version}.md`), `## 本次更新\n- ${text} zh\n\n## English Summary\n- ${text} en\n`)
  }
  const pages = ['site/changelog/index.html', 'site/en/changelog/index.html']
  for (const page of pages) await writeFile(join(root, page), 'before <!-- changelog:auto:start -->old<!-- changelog:auto:end --> after')
  execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/gen-site-changelog.mjs', import.meta.url))], { cwd: root })
  for (const [index, page] of pages.entries()) {
    const html = await readFile(join(root, page), 'utf8')
    assert.match(html, new RegExp(`published ${index === 0 ? 'zh' : 'en'}`))
    assert.match(html, /previous/)
    assert.doesNotMatch(html, /unpublished|shell\.3/)
    assert.ok(html.indexOf('shell.2') < html.indexOf('shell.1'))
    assert.match(html, /^before .* after$/s, 'hand-maintained page scaffold stays intact')
  }
})
