import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSnapshot } from '../scripts/gen-site-download-index.mjs'
import { PAGE_FILES, refreshSitemap } from '../scripts/gen-site-sitemap.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const release = JSON.parse(readFileSync(join(root, 'site/data/release.json'), 'utf8'))

test('the download snapshot names the tag and every installer a crawler should see', () => {
  const zh = renderSnapshot(release, 'zh')
  const en = renderSnapshot(release, 'en')
  for (const asset of release.release.assets.filter((a: { kind: string }) => a.kind === 'installer')) {
    assert.ok(zh.includes(asset.name), `zh snapshot is missing ${asset.name}`)
    assert.ok(en.includes(asset.name), `en snapshot is missing ${asset.name}`)
  }
  assert.match(zh, /当前版本 <code>v[\d.]+/)
  assert.match(en, /Current release <code>v[\d.]+/)
  assert.match(zh, /GitCode/)
})

test('both download pages carry a generated snapshot inside the auto markers', () => {
  for (const page of ['site/download/index.html', 'site/en/download/index.html']) {
    const html = readFileSync(join(root, page), 'utf8')
    assert.match(html, /<!-- download:auto:start -->[\s\S]*download-snapshot[\s\S]*<!-- download:auto:end -->/, `${page} has no snapshot region`)
    assert.ok(html.includes(release.release.tag), `${page} does not mention ${release.release.tag}`)
  }
})

test('sitemap lastmod is refreshed from the page that owns each URL', async () => {
  const xml = readFileSync(join(root, 'site/sitemap.xml'), 'utf8')
  const { xml: next, changed } = await refreshSitemap(xml, async file => (file === 'site/docs/install/index.html' ? '2026-01-02' : '2026-10-19'))
  assert.ok(changed >= 1, 'expected at least one date to change')
  assert.match(next, /<loc>https:\/\/dsh-desktop\.com\/docs\/install<\/loc>\s*<lastmod>2026-01-02<\/lastmod>/)
  assert.equal(await refreshSitemap(next, async () => '2026-01-02').then(r => r.changed) >= 1, true)
})

test('every crawlable URL in the sitemap is claimed by a page file', () => {
  const xml = readFileSync(join(root, 'site/sitemap.xml'), 'utf8')
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1] ?? '').pathname)
  for (const path of paths) assert.ok(PAGE_FILES[path], `sitemap URL ${path} has no owning file`)
})
