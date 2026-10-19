#!/usr/bin/env node
/** Refresh <lastmod> in site/sitemap.xml from each page's last git commit.
 *
 * The sitemap previously carried hand-written dates that went stale the moment
 * a page changed (the install guide still claimed August after an October
 * rewrite). Dates come from git so they cannot drift; pages with uncommitted
 * edits get today's date so a local preview is still honest.
 *
 * Usage: node scripts/gen-site-sitemap.mjs [--check]
 */
import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileP = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITEMAP = path.join(ROOT, 'site', 'sitemap.xml')

/** URL path (as written in <loc>) → file that owns it. */
export const PAGE_FILES = {
  '/': 'site/index.html',
  '/en': 'site/en/index.html',
  '/download': 'site/download/index.html',
  '/en/download': 'site/en/download/index.html',
  '/changelog': 'site/changelog/index.html',
  '/en/changelog': 'site/en/changelog/index.html',
  '/docs/install': 'site/docs/install/index.html',
  '/en/docs/install': 'site/en/docs/install/index.html',
  '/docs/faq': 'site/docs/faq/index.html',
  '/en/docs/faq': 'site/en/docs/faq/index.html',
  '/docs/why-desktop': 'site/docs/why-desktop/index.html',
  '/en/docs/why-desktop': 'site/en/docs/why-desktop/index.html',
}

async function lastModified(file, today) {
  try {
    const { stdout: committed } = await execFileP('git', ['log', '-1', '--format=%cs', '--', file], { cwd: ROOT, encoding: 'utf8' })
    const date = committed.trim()
    const { stdout: dirty } = await execFileP('git', ['status', '--porcelain', '--', file], { cwd: ROOT, encoding: 'utf8' })
    if (dirty.trim().length > 0) return today
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today
  } catch {
    return today
  }
}

/** @returns {Promise<{xml: string, changed: number}>} */
export async function refreshSitemap(xml, resolveDate) {
  const entries = [...xml.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]*)<\/lastmod>/g)]
  let changed = 0
  let next = xml
  for (const [block, loc, current] of entries) {
    const urlPath = new URL(loc).pathname
    const file = PAGE_FILES[urlPath]
    if (file === undefined) continue
    const date = await resolveDate(file)
    if (date === current) continue
    next = next.replace(block, block.replace(`<lastmod>${current}</lastmod>`, `<lastmod>${date}</lastmod>`))
    changed++
  }
  return { xml: next, changed }
}

async function main() {
  const checkOnly = process.argv.includes('--check')
  const today = new Date().toISOString().slice(0, 10)
  const xml = await readFile(SITEMAP, 'utf8')
  const { xml: next, changed } = await refreshSitemap(xml, file => lastModified(file, today))
  if (changed === 0) {
    console.log('sitemap: every lastmod already matches its page')
    return
  }
  if (checkOnly) {
    console.error(`sitemap: ${changed} lastmod value(s) are stale`)
    process.exitCode = 1
    return
  }
  await writeFile(SITEMAP, next)
  console.log(`sitemap: refreshed ${changed} lastmod value(s)`)
}

if (process.argv[1] !== undefined && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  await main()
}
